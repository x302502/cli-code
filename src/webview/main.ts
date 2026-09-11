import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import { WebglAddon } from "@xterm/addon-webgl"
import { SearchAddon } from "@xterm/addon-search"
import { WebLinksAddon } from "@xterm/addon-web-links"
import { Unicode11Addon } from "@xterm/addon-unicode11"
import { buildXtermTheme } from "../lib/webview-theme.js"

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

const vscode = acquireVsCodeApi()

/** Reads the font family/size the panel injected on <body style>, falling back to VS Code's editor font. */
function readFont(): { fontFamily: string; fontSize: number } {
  const style = getComputedStyle(document.body)
  const fontFamily =
    style.getPropertyValue("--cli-code-font-family").trim() ||
    style.getPropertyValue("--vscode-editor-font-family").trim() ||
    "monospace"
  const fontSizeRaw =
    style.getPropertyValue("--cli-code-font-size").trim() || style.getPropertyValue("--vscode-editor-font-size").trim()
  const fontSize = Number(fontSizeRaw) || 13
  return { fontFamily, fontSize }
}

function readTheme(): Record<string, string> {
  return buildXtermTheme((name) => getComputedStyle(document.documentElement).getPropertyValue(name))
}

const { fontFamily, fontSize } = readFont()

const term = new Terminal({
  fontFamily,
  fontSize,
  cursorBlink: true,
  allowProposedApi: true,
  scrollback: 5000,
  theme: readTheme(),
})

const fit = new FitAddon()
term.loadAddon(fit)

const unicode11 = new Unicode11Addon()
term.loadAddon(unicode11)
term.unicode.activeVersion = "11"

term.loadAddon(new SearchAddon())
term.loadAddon(new WebLinksAddon())

// WebGL renders faster, but if the context is lost it must be torn down instead of used again.
try {
  const webgl = new WebglAddon()
  webgl.onContextLoss(() => webgl.dispose())
  term.loadAddon(webgl)
} catch {
  // No WebGL available: xterm falls back to its DOM renderer.
}

const termElement = document.getElementById("term")
if (!termElement) throw new Error("missing #term element")
term.open(termElement)

// Re-apply the theme whenever VS Code switches themes (reflected as a class change on <body>).
new MutationObserver(() => {
  term.options.theme = readTheme()
}).observe(document.body, { attributes: true, attributeFilter: ["class"] })

fit.fit()

term.onData((data) => vscode.postMessage({ type: "input", data }))
term.onBinary((data) => vscode.postMessage({ type: "input", data }))

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
  } else if (message.type === "state") {
    vscode.setState(message.state)
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
