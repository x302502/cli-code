import { spawn } from "node:child_process"
import { randomBytes } from "node:crypto"
import * as fs from "node:fs"
import * as net from "node:net"
import * as os from "node:os"
import * as vscode from "vscode"
import { CLI_TOOLS, type CliTool } from "./config.js"
import { connectSession, daemonSocketPath, type SessionConnection } from "./daemon-client.js"
import { parsePathLink, pathCandidates } from "./path-resolve.js"
import { createPromptTracker } from "./prompt-tracker.js"
import type { AgentState } from "./protocol.js"
import { decorateTitle } from "./status-glyph.js"
import { buildEnv, randomPort } from "./terminal.js"
import { resolveTabTitle } from "./tab-title.js"

export const VIEW_TYPE = "cliCode.terminal"
const DAEMON_ID_KEY = "cliCode.daemonId"
const FONT_ZOOM_KEY = "cliCode.fontZoom"

export type PanelState = { sessionId: string; toolId: string; customTitle?: string; promptTitle?: string }

// Registries for rename (Task 10) and Task 11 (focus tracking, writing at-mentions
// into the active session).
const activePanels = new Set<vscode.WebviewPanel>()
const panelTools = new WeakMap<vscode.WebviewPanel, CliTool>()
const panelConnections = new WeakMap<vscode.WebviewPanel, SessionConnection>()
const customTitles = new WeakMap<vscode.WebviewPanel, string>()
// The last panel to have editor focus, so addFilepathToTerminal (invoked from a text
// editor, where no panel is `active`) still knows which session to write into.
let lastFocusedPanel: vscode.WebviewPanel | undefined

type Wiring = { ready: boolean; pending: unknown[]; listener?: vscode.Disposable }
const panelWiring = new WeakMap<vscode.WebviewPanel, Wiring>()
const panelCwds = new WeakMap<vscode.WebviewPanel, string>()
const panelOscTitles = new WeakMap<vscode.WebviewPanel, string>()
const panelStatus = new WeakMap<vscode.WebviewPanel, { state: AgentState; prompt?: string }>()
const panelPromptTitles = new WeakMap<vscode.WebviewPanel, string>()
const panelUnread = new WeakSet<vscode.WebviewPanel>()
const panelTrackers = new WeakMap<vscode.WebviewPanel, (input: string) => string | undefined>()

/** Single place that turns the registries into what the tab shows. */
function updateTitle(panel: vscode.WebviewPanel): void {
  const tool = panelTools.get(panel)
  if (!tool) return
  const base = resolveTabTitle({
    customTitle: customTitles.get(panel),
    oscTitle: panelOscTitles.get(panel),
    promptTitle: panelPromptTitles.get(panel),
    toolLabel: tool.label,
  })
  panel.title = decorateTitle(base, panelStatus.get(panel)?.state, panelUnread.has(panel))
}

/** A cwd is only usable as a spawn cwd if it exists locally as a directory. OSC 7 drops the
 * host, so an ssh session (or a deleted directory) can report a path that is not here —
 * node-pty would then throw inside the daemon and the user would see a misleading
 * "daemon không phản hồi" instead of a running CLI. */
function usableCwd(p: string | undefined): string | undefined {
  return p && fs.existsSync(p) && fs.statSync(p).isDirectory() ? p : undefined
}

/** cwd reported (OSC 7) by the active/last-focused CLI panel, if it exists locally. */
export function activePanelCwd(): string | undefined {
  const panel = activeTerminalPanel() ?? lastFocusedPanel
  return usableCwd(panel ? panelCwds.get(panel) : undefined)
}

function sendTo(panel: vscode.WebviewPanel, msg: unknown): void {
  const wiring = panelWiring.get(panel)
  if (!wiring) return
  if (wiring.ready) void panel.webview.postMessage(msg)
  else wiring.pending.push(msg)
}

/** Sends a message to the active (or last-focused) CLI panel, if any. */
export function sendToActivePanel(msg: unknown): void {
  const p = activeTerminalPanel() ?? lastFocusedPanel
  if (p) sendTo(p, msg)
}

function baseFontSize(): number {
  const terminalConfig = vscode.workspace.getConfiguration("terminal.integrated")
  const editorConfig = vscode.workspace.getConfiguration("editor")
  return terminalConfig.get<number>("fontSize") || editorConfig.get<number>("fontSize") || 14
}

export function currentFontSize(context: vscode.ExtensionContext): number {
  return baseFontSize() + (context.workspaceState.get<number>(FONT_ZOOM_KEY) ?? 0)
}

/** Steps every open panel's font size; clamped so a runaway keypress cannot make text unreadable. */
export async function applyFontZoom(context: vscode.ExtensionContext, delta: number | "reset"): Promise<void> {
  const current = context.workspaceState.get<number>(FONT_ZOOM_KEY) ?? 0
  const next = delta === "reset" ? 0 : Math.max(-5, Math.min(10, current + delta))
  await context.workspaceState.update(FONT_ZOOM_KEY, next)
  const size = baseFontSize() + next
  for (const panel of activePanels) sendTo(panel, { type: "font", size })
}

/** Sets a panel's custom title, updates the tab, and persists it across Reload Window. */
export function setCustomTitle(panel: vscode.WebviewPanel, title: string): void {
  customTitles.set(panel, title)
  updateTitle(panel)
  postState(panel)
}

/** First terminal panel that currently has editor focus, if any. */
export function activeTerminalPanel(): vscode.WebviewPanel | undefined {
  for (const panel of activePanels) {
    if (panel.active) return panel
  }
  return undefined
}

/** First open panel for a given tool, if any. */
export function findExistingPanel(tool: CliTool): vscode.WebviewPanel | undefined {
  for (const panel of activePanels) {
    if (panelTools.get(panel) === tool) return panel
  }
  return undefined
}

/** Writes text into the active (or last-focused) panel's session. Returns false if there is none. */
export function writeToActivePanel(text: string): boolean {
  const panel = activeTerminalPanel() ?? lastFocusedPanel
  if (!panel) return false
  const connection = panelConnections.get(panel)
  if (!connection) return false
  connection.write(text)
  panel.reveal()
  return true
}

// In-flight ensureDaemon, shared by concurrent callers (N panels restored at once): without
// it every caller would probe, see nothing listening, rmSync the socket and spawn its own
// daemon — all but one would then die with EADDRINUSE and their callers time out.
let ensuring: Promise<string> | undefined

/** Returns the socket path of this window's daemon, spawning one if nobody is listening yet. */
export function ensureDaemon(context: vscode.ExtensionContext): Promise<string> {
  if (!ensuring) {
    ensuring = ensureDaemonUncached(context).finally(() => {
      ensuring = undefined
    })
  }
  return ensuring
}

async function ensureDaemonUncached(context: vscode.ExtensionContext): Promise<string> {
  let id = context.workspaceState.get<string>(DAEMON_ID_KEY)
  if (!id) {
    id = randomBytes(4).toString("hex")
    await context.workspaceState.update(DAEMON_ID_KEY, id)
  }
  const socketPath = daemonSocketPath(id)
  if (await isListening(socketPath)) return socketPath

  // The probe above proved nothing is listening. The daemon exits via process.exit(0) on
  // idle without unlinking its socket file, so a stale file can still be sitting at this
  // path — leaving it there would make the new daemon's listen() fail with EADDRINUSE.
  if (process.platform !== "win32") fs.rmSync(socketPath, { force: true })

  const daemon = spawn(process.execPath, [context.asAbsolutePath("dist/daemon.js"), socketPath], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    detached: true,
    stdio: "ignore",
  })
  // A spawn failure (e.g. EACCES/EMFILE) must not become an uncaught exception in the
  // extension host; the poll loop below already reports "daemon didn't come up" on its own.
  daemon.on("error", () => {})
  daemon.unref()

  // Wait for the daemon to open its socket. 20 × 50ms is generous for a node process to start.
  for (let i = 0; i < 20; i++) {
    if (await isListening(socketPath)) return socketPath
    await new Promise((r) => setTimeout(r, 50))
  }
  throw new Error("Không khởi động được daemon terminal của CLI Code.")
}

/**
 * Keeps this window's daemon from idle-exiting while restored tabs are still hidden.
 * VS Code only calls deserializeWebviewPanel when a restored tab first becomes visible,
 * so if another editor sits on top of every CLI tab after a reload, no panel connects and
 * the daemon's 60 s idle timer would kill every session. A bare connection (no Hello) is
 * enough: the server counts any open socket as activity. Disposed on deactivate.
 */
export async function holdDaemonAlive(context: vscode.ExtensionContext): Promise<vscode.Disposable> {
  const id = context.workspaceState.get<string>(DAEMON_ID_KEY)
  if (!id) return { dispose: () => {} }
  const socketPath = daemonSocketPath(id)
  if (!(await isListening(socketPath))) return { dispose: () => {} }
  const socket = net.createConnection(socketPath)
  socket.on("error", () => {})
  socket.on("close", () => {})
  return { dispose: () => socket.destroy() }
}

function isListening(socketPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createConnection(socketPath)
    // A hung pipe (neither connect, error, nor close) must not stall ensureDaemon forever.
    probe.setTimeout(500, () => probe.destroy(new Error("timeout")))
    probe.on("connect", () => {
      resolve(true)
      probe.destroy()
    })
    probe.on("error", () => resolve(false))
    // destroy() with no error argument (the timeout path) emits close but not error, so
    // isListening must also resolve here or it would hang forever on a stuck pipe.
    probe.on("close", () => resolve(false))
  })
}

export async function openTerminalPanel(
  context: vscode.ExtensionContext,
  tool: CliTool,
  options: { cwd?: string; command?: string; title?: string } = {},
): Promise<void> {
  const socketPath = await ensureDaemon(context)
  const cwd = usableCwd(options.cwd) ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd()
  const port = tool.hasHttpApi ? randomPort() : undefined
  const baseCommand = options.command ?? tool.command

  const connection = await connectSession(socketPath, {
    op: "spawn",
    toolId: tool.id,
    command: port ? baseCommand.replace("{port}", String(port)) : baseCommand,
    cwd,
    env: buildEnv(tool, port),
    cols: 80,
    rows: 24,
  })
  if (!connection) {
    void vscode.window.showErrorMessage("Không mở được terminal: daemon không phản hồi.")
    return
  }

  // Stack CLIs as tabs in one editor group: reuse the column of an existing CLI panel.
  const column = [...activePanels][0]?.viewColumn ?? vscode.ViewColumn.Beside
  const panel = vscode.window.createWebviewPanel(VIEW_TYPE, tool.label, column, {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [vscode.Uri.file(context.extensionPath)],
  })
  if (options.title) customTitles.set(panel, options.title)
  panelCwds.set(panel, cwd)
  wirePanel(context, panel, tool, connection)
}

export async function restoreTerminalPanel(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  state: PanelState,
): Promise<void> {
  const tool = CLI_TOOLS.find((t) => t.id === state.toolId)
  if (!tool) {
    panel.dispose()
    return
  }

  const socketPath = await ensureDaemon(context)
  const connection = await connectSession(socketPath, { op: "attach", sessionId: state.sessionId })
  if (!connection) {
    // The session is gone (the app quit, or the daemon cleaned it up itself). Be honest with the user.
    panel.iconPath = iconFor(context, tool)
    panel.title = tool.label
    showGone(context, panel, tool)
    return
  }
  // Restore the custom/prompt title before wiring so the first title/state posted is already correct.
  if (state.customTitle) customTitles.set(panel, state.customTitle)
  if (state.promptTitle) panelPromptTitles.set(panel, state.promptTitle)
  wirePanel(context, panel, tool, connection)
}

/** Renders the "session gone" view and wires its restart button. Shared by a failed
 * attach (restoreTerminalPanel) and a live connection closing (daemon died/evicted).
 * Disposes the panel's wiring listener so a stale input/resize/ack handler doesn't linger. */
function showGone(context: vscode.ExtensionContext, panel: vscode.WebviewPanel, tool: CliTool): void {
  panelWiring.get(panel)?.listener?.dispose()
  panelConnections.delete(panel)
  // A "gone" panel has no session, so it must not be picked by cli-code.open (reuse)
  // or addFilepath — they should open/target a working CLI instead.
  activePanels.delete(panel)
  if (lastFocusedPanel === panel) lastFocusedPanel = undefined
  panel.webview.html = goneHtml(tool.label)
  panel.webview.onDidReceiveMessage(async (m) => {
    if (m.type !== "restart") return
    const cwd = panelCwds.get(panel)
    const title = customTitles.get(panel)
    panel.dispose()
    try {
      await openTerminalPanel(context, tool, { cwd, title })
    } catch (err) {
      void vscode.window.showErrorMessage(String(err))
    }
  })
}

/** One-time panel setup: icon, title, html, registries, and lifecycle listeners.
 * Delegates connection wiring (which can happen again for the same panel, e.g. a
 * future restart) to attachConnection. */
function wirePanel(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  tool: CliTool,
  connection: SessionConnection,
): void {
  panel.iconPath = iconFor(context, tool)
  panel.webview.html = terminalHtml(context, panel.webview)

  activePanels.add(panel)
  panelTools.set(panel, tool)
  updateTitle(panel)
  lastFocusedPanel = panel

  // Host -> webview messages must queue until the webview signals it is ready (its
  // terminal is open and focused) — otherwise the daemon's Snapshot on attach, which
  // can arrive before the page finishes loading, would be posted into the void.
  panelWiring.set(panel, { ready: false, pending: [] })

  panel.onDidChangeViewState((e) => {
    if (e.webviewPanel.active) lastFocusedPanel = panel
  })

  // The user closing the tab kills the CLI (spec §7.2): a closed tab must not leave
  // an orphan process running in the daemon. If the connection is already gone
  // (showGone ran: daemon died or evicted us) there is nothing to kill. The connection
  // is read at dispose time (not captured) because a restart can have replaced it.
  // The panel is deliberately NOT pushed into context.subscriptions: on Reload Window
  // VS Code runs deactivate() and disposes every subscription, which would fire this
  // handler and kill every session — the very thing the daemon exists to prevent.
  panel.onDidDispose(() => {
    activePanels.delete(panel)
    const connection = panelConnections.get(panel)
    if (connection) {
      connection.kill()
      connection.dispose()
    }
    if (lastFocusedPanel === panel) lastFocusedPanel = undefined
  })

  attachConnection(context, panel, tool, connection)
}

/** Wires a connection into an already-set-up panel. Runs once per attach — including a
 * future restart, which calls this again for the same panel with a fresh connection. */
function attachConnection(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  tool: CliTool,
  connection: SessionConnection,
): void {
  const wiring = panelWiring.get(panel)
  if (!wiring) return
  wiring.listener?.dispose()
  panelConnections.set(panel, connection)
  const tracker = createPromptTracker()
  panelTrackers.set(panel, tracker)

  connection.onSnapshot((text) => sendTo(panel, { type: "snapshot", text }))
  connection.onData((bytes) => sendTo(panel, { type: "data", bytes }))
  connection.onExit((e) => sendTo(panel, { type: "exit", code: e.code }))
  connection.onMeta((e) => {
    if (e.kind === "cwd") panelCwds.set(panel, e.cwd)
    else if (e.kind === "title") {
      panelOscTitles.set(panel, e.title)
      updateTitle(panel)
    } else panelStatus.set(panel, { state: e.state, prompt: e.prompt })
  })

  wiring.listener = panel.webview.onDidReceiveMessage((message) => {
    if (message.type === "input") {
      connection.write(message.data)
      const title = tracker(message.data)
      if (title) {
        panelPromptTitles.set(panel, title)
        updateTitle(panel)
        postState(panel)
      }
    } else if (message.type === "resize") connection.resize(message.cols, message.rows)
    else if (message.type === "ack") connection.ack(message.bytes)
    else if (message.type === "ready") {
      wiring.ready = true
      for (const msg of wiring.pending) void panel.webview.postMessage(msg)
      wiring.pending.length = 0
      postState(panel)
    } else if (message.type === "restart") void restartPanel(context, panel)
    else if (message.type === "clipboard" && typeof message.text === "string" && message.text.length <= 1024 * 1024) {
      void vscode.env.clipboard.writeText(message.text)
    }
    else if (message.type === "openLink" && typeof message.uri === "string") {
      // A hostile CLI must not be able to trigger file:/custom-scheme handlers via a printed "link" —
      // only http(s) and mailto are allowed through to the OS.
      const uri = vscode.Uri.parse(message.uri)
      if (uri.scheme === "http" || uri.scheme === "https" || uri.scheme === "mailto") void vscode.env.openExternal(uri)
    }
    else if (message.type === "context" && typeof message.text === "string" && typeof message.lines === "number") {
      void vscode.env.clipboard.writeText(message.text)
      void vscode.window.showInformationMessage(`Đã chép ${message.lines} dòng ngữ cảnh.`)
    } else if (message.type === "openPath" && typeof message.text === "string") void openPathFromPanel(panel, message.text)
    else if (message.type === "pasteConfirm" && typeof message.size === "number") {
      void vscode.window
        .showWarningMessage(`Dán ${Math.round(message.size / 1024)} KB vào terminal?`, { modal: true }, "Dán")
        .then((choice) => sendTo(panel, { type: choice === "Dán" ? "pasteApproved" : "pasteRejected" }))
    }
  })

  connection.onClose(() => showGone(context, panel, tool))

  // The `ready` handler above posts state only once, on the webview's first load. After a
  // restart the panel holds a new sessionId while the webview's saved state still names the
  // killed one — on Reload Window the serializer would attach to the dead session ("gone"
  // page) and the restarted CLI would keep running unowned. Re-post now if already ready.
  if (wiring.ready) postState(panel)
}

/** Resolves a file-path link from the terminal (relative to the panel's cwd, then each
 * workspace folder) and opens it, jumping to the parsed line/column if any. */
async function openPathFromPanel(panel: vscode.WebviewPanel, text: string): Promise<void> {
  const parsed = parsePathLink(text)
  if (!parsed) return
  const folders = (vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath)
  for (const candidate of pathCandidates(parsed.path, panelCwds.get(panel), folders, os.homedir())) {
    if (!fs.existsSync(candidate) || fs.statSync(candidate).isDirectory()) continue
    const doc = await vscode.workspace.openTextDocument(candidate)
    const line = Math.max(0, (parsed.line ?? 1) - 1)
    const col = Math.max(0, (parsed.col ?? 1) - 1)
    await vscode.window.showTextDocument(doc, { selection: new vscode.Range(line, col, line, col), preview: true })
    return
  }
  void vscode.window.showInformationMessage(`Không tìm thấy tệp: ${parsed.path}`)
}

// Guards against a second restart request (e.g. a doubled click, or the palette command
// firing while a "restart" webview message is still in flight) racing the same panel.
const restarting = new WeakSet<vscode.WebviewPanel>()

/** Spawns a fresh session for the panel's tool and re-attaches it to the same tab. */
export async function restartPanel(context: vscode.ExtensionContext, panel: vscode.WebviewPanel): Promise<void> {
  if (restarting.has(panel)) return
  restarting.add(panel)
  try {
    const tool = panelTools.get(panel)
    if (!tool) return
    // A client close only detaches in the daemon; the old session keeps running until it is
    // explicitly killed. Without this it leaks an orphan CLI process on every restart.
    const old = panelConnections.get(panel)
    if (old) {
      old.kill()
      old.dispose()
    }
    panelConnections.delete(panel)
    const socketPath = await ensureDaemon(context)
    const port = tool.hasHttpApi ? randomPort() : undefined
    const connection = await connectSession(socketPath, {
      op: "spawn",
      toolId: tool.id,
      command: port ? tool.command.replace("{port}", String(port)) : tool.command,
      cwd: usableCwd(panelCwds.get(panel)) ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd(),
      env: buildEnv(tool, port),
      cols: 80,
      rows: 24,
    })
    if (!connection) {
      void vscode.window.showErrorMessage("Không khởi động lại được: daemon không phản hồi.")
      return
    }
    // The panel may have been closed while awaiting connectSession above; a disposed panel
    // must not adopt a fresh session (it would leak, since nothing would ever kill it).
    if (!activePanels.has(panel)) {
      connection.kill()
      connection.dispose()
      return
    }
    panelStatus.delete(panel)
    panelOscTitles.delete(panel)
    panelPromptTitles.delete(panel)
    panelUnread.delete(panel)
    // A connection that died before the webview signaled ready may have left a stale
    // snapshot/data queued; drop it before the new connection posts its own.
    const wiring = panelWiring.get(panel)
    if (wiring) wiring.pending.length = 0
    sendTo(panel, { type: "reset" })
    attachConnection(context, panel, tool, connection)
    updateTitle(panel)
  } finally {
    restarting.delete(panel)
  }
}

/** Posts the state VS Code hands back to the serializer after a Reload Window. */
function postState(panel: vscode.WebviewPanel): void {
  const connection = panelConnections.get(panel)
  const tool = panelTools.get(panel)
  if (!connection || !tool) return
  void panel.webview.postMessage({
    type: "state",
    state: {
      sessionId: connection.sessionId,
      toolId: tool.id,
      customTitle: customTitles.get(panel),
      promptTitle: panelPromptTitles.get(panel),
    },
  })
}

function iconFor(context: vscode.ExtensionContext, tool: CliTool): { light: vscode.Uri; dark: vscode.Uri } {
  return {
    light: vscode.Uri.file(context.asAbsolutePath(`images/agents-light/${tool.icon}`)),
    dark: vscode.Uri.file(context.asAbsolutePath(`images/agents-dark/${tool.icon}`)),
  }
}

function terminalHtml(context: vscode.ExtensionContext, webview: vscode.Webview): string {
  const asset = (...p: string[]) => webview.asWebviewUri(vscode.Uri.file(context.asAbsolutePath(p.join("/"))))
  const xtermCss = asset("node_modules", "@xterm", "xterm", "css", "xterm.css")
  const css = asset("media", "terminal.css")
  const main = asset("dist", "webview.js")
  const csp = `default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource}; font-src ${webview.cspSource};`

  const terminalConfig = vscode.workspace.getConfiguration("terminal.integrated")
  const editorConfig = vscode.workspace.getConfiguration("editor")
  const fontFamily =
    terminalConfig.get<string>("fontFamily") || editorConfig.get<string>("fontFamily") || "monospace"
  const fontSize = currentFontSize(context)
  const escapedFamily = fontFamily.replace(/"/g, "&quot;")

  return `<!DOCTYPE html><html lang="vi"><head>
<meta http-equiv="Content-Security-Policy" content="${csp}">
<link rel="stylesheet" href="${xtermCss}"><link rel="stylesheet" href="${css}">
</head><body style="--cli-code-font-family:${escapedFamily};--cli-code-font-size:${fontSize}">
<div id="term" data-vscode-context='{"preventDefaultContextMenuItems": true}'></div>
<script src="${main}"></script>
</body></html>`
}

function goneHtml(label: string): string {
  const nonce = randomBytes(16).toString("base64")
  const csp = `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';`
  return `<!DOCTYPE html><html lang="vi"><head>
<meta http-equiv="Content-Security-Policy" content="${csp}">
</head><body style="font-family: var(--vscode-font-family); padding: 24px">
<p>Phiên <strong>${escapeHtml(label)}</strong> đã kết thúc.</p>
<button id="restart">Khởi động lại</button>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi()
  document.getElementById("restart").addEventListener("click", () => vscode.postMessage({ type: "restart" }))
</script></body></html>`
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}
