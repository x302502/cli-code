import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import { WebglAddon } from "@xterm/addon-webgl"
import { SearchAddon } from "@xterm/addon-search"
import { Unicode11Addon } from "@xterm/addon-unicode11"
import { ClipboardAddon, type IClipboardProvider, ClipboardSelectionType } from "@xterm/addon-clipboard"
import { buildXtermTheme } from "../lib/webview-theme.js"
import { createActionMenu } from "./action-menu.js"
import { createExitOverlay } from "./exit-overlay.js"
import { createTerminalLinkProvider, selectRange, type LinkKind, type ProbeResult } from "./links.js"
import { createSearchBar } from "./search-bar.js"
import { tailText } from "./buffer-text.js"
import { classifyOscLink } from "../lib/osc-link.js"

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void
  setState(state: unknown): void
  getState(): unknown
}

// Host -> webview messages, sent via panel.webview.postMessage.
type HostMessage =
  | { type: "data"; bytes: Uint8Array }
  | { type: "snapshot"; text: string }
  | { type: "exit"; code: number }
  | { type: "state"; state: unknown }
  | { type: "font"; size: number }
  | { type: "reset" }
  | { type: "find"; query?: string }
  | { type: "copyContext"; maxLines: number }
  | { type: "pasteApproved" }
  | { type: "pasteRejected" }
  | { type: "pasteText"; text: string; submit?: boolean }
  | { type: "copySelection" }
  | { type: "selectAll" }
  | { type: "probeResult"; id: number; results: ProbeResult }

const vscode = acquireVsCodeApi()

// Pastes above this size are held back and confirmed with the host before reaching the
// terminal — a multi-MB accidental paste into a TUI is hard to undo.
const PASTE_CONFIRM_BYTES = 100 * 1024
let heldPaste: string | undefined

/** Reads the font family/size the panel injected on <body style>, falling back to VS Code's editor font. */
function readFont(): { fontFamily: string; fontSize: number } {
  const style = getComputedStyle(document.body)
  const fontFamily =
    style.getPropertyValue("--cli-code-font-family").trim() ||
    style.getPropertyValue("--vscode-editor-font-family").trim() ||
    "monospace"
  const fontSizeRaw =
    style.getPropertyValue("--cli-code-font-size").trim() || style.getPropertyValue("--vscode-editor-font-size").trim()
  // VS Code's --vscode-editor-font-size carries a "px" suffix (e.g. "14px"), so parseFloat is required —
  // Number() would return NaN and always fall through to the default.
  const fontSize = parseFloat(fontSizeRaw) || 13
  return { fontFamily, fontSize }
}

/** Links open only on meta (macOS) / ctrl click, matching VS Code's integrated terminal. */
function isOpenClick(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey
}

function readTheme(): Record<string, string> {
  return buildXtermTheme((name) => getComputedStyle(document.documentElement).getPropertyValue(name))
}

const { fontFamily, fontSize } = readFont()
// The link under the pointer, if any — feeds the right-click menu's context keys.
let hoveredLink: { text: string; kind: LinkKind } | undefined

const term = new Terminal({
  fontFamily,
  fontSize,
  cursorBlink: true,
  allowProposedApi: true,
  scrollback: 5000,
  theme: readTheme(),
  // OSC 8 hyperlinks (Claude Code and other Ink-based CLIs print links this way) are handled
  // by xterm's built-in provider, which takes precedence over the addons below. Without a
  // handler xterm falls back to confirm() + window.open(), both dead inside a VS Code webview,
  // so clicks would silently do nothing. Same semantics as the addons: meta/ctrl+click opens.
  linkHandler: {
    allowNonHttpProtocols: true,
    hover: (_e, uri) => {
      const t = classifyOscLink(uri)
      hoveredLink = t.kind === "link" ? { text: t.uri, kind: "url" } : t.kind === "path" ? { text: t.path, kind: "file" } : undefined
    },
    leave: () => (hoveredLink = undefined),
    activate: (event, uri, range) => {
      // A plain click selects the link so a normal Cmd/Ctrl+C copies all of it.
      if (!isOpenClick(event)) return selectRange(term, range)
      const target = classifyOscLink(uri)
      if (target.kind === "link") vscode.postMessage({ type: "openLink", uri: target.uri })
      else if (target.kind === "path") {
        vscode.postMessage({ type: "openFile", path: target.path, line: target.line, col: target.col, alt: event.shiftKey })
      }
    },
  },
})

const fit = new FitAddon()
term.loadAddon(fit)

term.loadAddon(new Unicode11Addon())
term.unicode.activeVersion = "11"

const searchAddon = new SearchAddon()
term.loadAddon(searchAddon)
// OSC 52 write goes through the extension host (vscode.env.clipboard): reliable in a
// sandboxed webview, and it keeps reads closed — a program in the terminal must not be
// able to pull the user's clipboard contents.
const clipboardProvider: IClipboardProvider = {
  readText: (_selection: ClipboardSelectionType) => Promise.resolve(""),
  writeText: (_selection: ClipboardSelectionType, text: string) => {
    if (text.length <= 1024 * 1024) vscode.postMessage({ type: "clipboard", text })
    return Promise.resolve()
  },
}
term.loadAddon(new ClipboardAddon(clipboardProvider))

// WebGL renders faster, but if the context is lost it must be torn down instead of used again.
// This only guards a constructor throw (e.g. very old browsers); if WebGL2 itself is unsupported,
// xterm raises that later inside term.open() and silently falls back to its DOM renderer on its own.
try {
  const webgl = new WebglAddon()
  webgl.onContextLoss(() => webgl.dispose())
  term.loadAddon(webgl)
} catch {
  // Constructor threw: no WebGL available at all.
}

const termElement = document.getElementById("term")
if (!termElement) throw new Error("missing #term element")
term.open(termElement)

// xterm handles paste through its hidden textarea; intercept only oversized pastes so the
// host can ask first.
termElement.addEventListener(
  "paste",
  (e) => {
    const text = e.clipboardData?.getData("text") ?? ""
    if (new TextEncoder().encode(text).length <= PASTE_CONFIRM_BYTES) return
    e.preventDefault()
    e.stopPropagation()
    heldPaste = text
    vscode.postMessage({ type: "pasteConfirm", size: text.length })
  },
  true,
)

// URLs and file/directory paths. meta/ctrl+click opens, like VS Code's own terminal; a plain
// click selects the link so a normal Cmd/Ctrl+C copies all of it (and a stray click never
// yanks the user out of the terminal). Path tokens are only underlined once the host confirms
// they exist; the probe is a request/response pair over postMessage keyed by an id.
const probes = new Map<number, (r: ProbeResult) => void>()
let nextProbe = 1
function probePaths(texts: string[]): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const id = nextProbe++
    probes.set(id, resolve)
    vscode.postMessage({ type: "probePaths", id, texts })
  })
}
// shift = "alternate" action (default app for a file — a directory always opens in Finder/Explorer).
term.registerLinkProvider(
  createTerminalLinkProvider(
    term,
    probePaths,
    (event, text, kind, range) => {
      if (!isOpenClick(event)) return selectRange(term, range)
      if (kind === "url") vscode.postMessage({ type: "openLink", uri: text })
      else vscode.postMessage({ type: "openPath", text, alt: event.shiftKey })
    },
    (link) => (hoveredLink = link),
  ),
)

// VS Code reads data-vscode-context when the context menu opens; refresh it on every
// mousedown so the menu's `when` clauses see the link under the pointer and the selection.
termElement.addEventListener(
  "mousedown",
  () => {
    const selection = term.getSelection()
    termElement.dataset.vscodeContext = JSON.stringify({
      preventDefaultContextMenuItems: true,
      cliCodeLinkKind: hoveredLink?.kind ?? "",
      cliCodeLinkText: hoveredLink?.text ?? "",
      cliCodeHasSelection: selection.length > 0,
      cliCodeSelection: selection.slice(0, 500),
    })
  },
  true,
)

// Tab-level actions live behind the floating button; each is an existing command.
createActionMenu(
  [
    { id: "newSession", label: "Phiên mới" },
    { id: "renameTab", label: "Đổi tên tab" },
    { id: "restart", label: "Khởi động lại phiên" },
    { id: "copyContext", label: "Sao chép ngữ cảnh" },
    { id: "resume", label: "Mở lại phiên cũ" },
    { id: "quickCommand", label: "Lệnh nhanh" },
  ],
  (id) => vscode.postMessage({ type: "command", id }),
)

// Re-apply the theme whenever VS Code switches themes (reflected as a class change on <body>).
new MutationObserver(() => {
  term.options.theme = readTheme()
}).observe(document.body, { attributes: true, attributeFilter: ["class"] })

fit.fit()

term.onData((data) => vscode.postMessage({ type: "input", data }))
term.onBinary((data) => vscode.postMessage({ type: "input", data }))

const overlay = createExitOverlay(() => vscode.postMessage({ type: "restart" }))
const searchBar = createSearchBar(term, searchAddon)

// Claude Code's /terminal-setup teaches terminals to send ESC CR for Shift+Enter; do the
// same here so multi-line prompts work without any per-user setup. Returning false only on
// "keydown" is not enough: xterm's custom handler also runs on the "keypress" that Chromium
// fires right after, and if that call returns true xterm falls through to its default Enter
// handling and emits "\r" — submitting the prompt right after the newline. So the handler
// must return false (swallow) for every event type, and only post the input on keydown.
term.attachCustomKeyEventHandler((e) => {
  if (e.key === "Enter" && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (e.type === "keydown") vscode.postMessage({ type: "input", data: "\x1b\r" })
    return false
  }
  return true
})

window.addEventListener("message", (event: MessageEvent<HostMessage>) => {
  const message = event.data
  if (message.type === "data") {
    const bytes = message.bytes
    // Only ack once xterm has fully consumed the data, so the daemon knows when to throttle the PTY.
    term.write(bytes, () => vscode.postMessage({ type: "ack", bytes: bytes.length }))
  } else if (message.type === "snapshot") {
    term.reset()
    term.write(message.text)
  } else if (message.type === "exit") {
    term.write(`\r\n\x1b[2m[process exited, code ${message.code}]\x1b[0m\r\n`)
    overlay.show(message.code)
  } else if (message.type === "state") {
    vscode.setState(message.state)
  } else if (message.type === "font") {
    term.options.fontSize = message.size
    fit.fit()
    vscode.postMessage({ type: "resize", cols: term.cols, rows: term.rows })
  } else if (message.type === "reset") {
    overlay.hide()
    term.reset()
    fit.fit()
    vscode.postMessage({ type: "resize", cols: term.cols, rows: term.rows })
    term.focus()
  } else if (message.type === "find") {
    searchBar.show(message.query)
  } else if (message.type === "copyContext") {
    const r = tailText(term.buffer.active, message.maxLines)
    vscode.postMessage({ type: "context", ...r })
  } else if (message.type === "pasteApproved") {
    if (heldPaste !== undefined) term.paste(heldPaste)
    heldPaste = undefined
  } else if (message.type === "pasteRejected") {
    heldPaste = undefined
  } else if (message.type === "pasteText") {
    if (new TextEncoder().encode(message.text).length > PASTE_CONFIRM_BYTES) {
      heldPaste = message.text
      vscode.postMessage({ type: "pasteConfirm", size: message.text.length })
    } else {
      term.paste(message.text)
      // Enter after the paste (quick commands): as user input so it reaches the PTY via onData.
      if (message.submit) term.input("\r")
    }
  } else if (message.type === "copySelection") {
    const selection = term.getSelection()
    if (selection) vscode.postMessage({ type: "clipboard", text: selection })
  } else if (message.type === "selectAll") {
    term.selectAll()
  } else if (message.type === "probeResult") {
    probes.get(message.id)?.(message.results)
    probes.delete(message.id)
  }
})

let resizeTimer: ReturnType<typeof setTimeout> | undefined
new ResizeObserver(() => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    fit.fit()
    vscode.postMessage({ type: "resize", cols: term.cols, rows: term.rows })
  }, 50)
}).observe(termElement)

term.focus()
vscode.postMessage({ type: "ready" })
