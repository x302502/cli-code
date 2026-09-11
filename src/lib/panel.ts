import { spawn } from "node:child_process"
import { randomBytes } from "node:crypto"
import * as fs from "node:fs"
import * as net from "node:net"
import * as vscode from "vscode"
import { CLI_TOOLS, type CliTool } from "./config.js"
import { connectSession, daemonSocketPath, type SessionConnection } from "./daemon-client.js"
import { buildEnv } from "./terminal.js"
import { resolveTabTitle } from "./tab-title.js"

export const VIEW_TYPE = "cliCode.terminal"
const DAEMON_ID_KEY = "cliCode.daemonId"

export type PanelState = { sessionId: string; toolId: string; customTitle?: string }

// Registries for rename (Task 10) and Task 11 (focus tracking, writing at-mentions
// into the active session).
const activePanels = new Set<vscode.WebviewPanel>()
const panelTools = new WeakMap<vscode.WebviewPanel, CliTool>()
const panelConnections = new WeakMap<vscode.WebviewPanel, SessionConnection>()
const customTitles = new WeakMap<vscode.WebviewPanel, string>()
// Each panel's message sender from wirePanel, so setCustomTitle can push the updated
// state to the webview (which persists it via vscode.setState for the next Reload Window).
const panelSenders = new WeakMap<vscode.WebviewPanel, (msg: unknown) => void>()

/** Sets a panel's custom title, updates the tab, and persists it across Reload Window. */
export function setCustomTitle(panel: vscode.WebviewPanel, title: string): void {
  customTitles.set(panel, title)
  panel.title = resolveTabTitle({ customTitle: title, toolLabel: panelTools.get(panel)?.label ?? panel.title })

  const send = panelSenders.get(panel)
  const connection = panelConnections.get(panel)
  if (send && connection) {
    const toolId = panelTools.get(panel)?.id
    send({ type: "state", state: { sessionId: connection.sessionId, toolId, customTitle: title } })
  }
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

/** Writes text into the active panel's session. Returns false if there is no active panel. */
export function writeToActivePanel(text: string): boolean {
  const panel = activeTerminalPanel()
  if (!panel) return false
  const connection = panelConnections.get(panel)
  if (!connection) return false
  connection.write(text)
  return true
}

/** Returns the socket path of this window's daemon, spawning one if nobody is listening yet. */
export async function ensureDaemon(context: vscode.ExtensionContext): Promise<string> {
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

export async function openTerminalPanel(context: vscode.ExtensionContext, tool: CliTool): Promise<void> {
  const socketPath = await ensureDaemon(context)
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd()

  const connection = await connectSession(socketPath, {
    op: "spawn",
    toolId: tool.id,
    command: tool.command,
    cwd,
    env: buildEnv(tool, undefined),
    cols: 80,
    rows: 24,
  })
  if (!connection) {
    void vscode.window.showErrorMessage("Không mở được terminal: daemon không phản hồi.")
    return
  }

  const panel = vscode.window.createWebviewPanel(VIEW_TYPE, tool.label, vscode.ViewColumn.Beside, {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [vscode.Uri.file(context.extensionPath)],
  })
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
  // Restore the custom title before wiring so the first title/state posted is already correct.
  if (state.customTitle) customTitles.set(panel, state.customTitle)
  wirePanel(context, panel, tool, connection)
}

/** Renders the "session gone" view and wires its restart button. Shared by a failed
 * attach (restoreTerminalPanel) and a live connection closing (daemon died/evicted).
 * `existingListener`, when given, is the panel's previous onDidReceiveMessage registration
 * from wirePanel — it must be disposed so a stale input/resize/ack handler doesn't linger. */
function showGone(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  tool: CliTool,
  existingListener?: vscode.Disposable,
): void {
  existingListener?.dispose()
  panelConnections.delete(panel)
  panel.webview.html = goneHtml(tool.label)
  panel.webview.onDidReceiveMessage(async (m) => {
    if (m.type !== "restart") return
    panel.dispose()
    try {
      await openTerminalPanel(context, tool)
    } catch (err) {
      void vscode.window.showErrorMessage(String(err))
    }
  })
}

function wirePanel(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  tool: CliTool,
  connection: SessionConnection,
): void {
  panel.iconPath = iconFor(context, tool)
  panel.title = resolveTabTitle({ customTitle: customTitles.get(panel), toolLabel: tool.label })
  panel.webview.html = terminalHtml(context, panel.webview)

  activePanels.add(panel)
  panelTools.set(panel, tool)
  panelConnections.set(panel, connection)

  // Host -> webview messages must queue until the webview signals it is ready (its
  // terminal is open and focused) — otherwise the daemon's Snapshot on attach, which
  // can arrive before the page finishes loading, would be posted into the void.
  let ready = false
  const pending: unknown[] = []
  const send = (msg: unknown) => {
    if (ready) void panel.webview.postMessage(msg)
    else pending.push(msg)
  }
  panelSenders.set(panel, send)

  connection.onSnapshot((text) => send({ type: "snapshot", text }))
  connection.onData((bytes) => send({ type: "data", bytes }))
  connection.onExit((e) => send({ type: "exit", code: e.code }))

  const messageListener = panel.webview.onDidReceiveMessage((message) => {
    if (message.type === "input") connection.write(message.data)
    else if (message.type === "resize") connection.resize(message.cols, message.rows)
    else if (message.type === "ack") connection.ack(message.bytes)
    else if (message.type === "ready") {
      ready = true
      for (const msg of pending) void panel.webview.postMessage(msg)
      pending.length = 0
      // This state is what VS Code hands back to the serializer after a Reload Window.
      void panel.webview.postMessage({
        type: "state",
        state: { sessionId: connection.sessionId, toolId: tool.id, customTitle: customTitles.get(panel) },
      })
    }
  })

  connection.onClose(() => showGone(context, panel, tool, messageListener))

  // Closing the tab in this phase does NOT kill the CLI: the daemon keeps the session
  // alive until its own idle-exit timer fires, so the process survives a reload. The
  // "ask before closing a live session" UX is a later phase.
  panel.onDidDispose(() => {
    activePanels.delete(panel)
    connection.dispose()
  })
  context.subscriptions.push(panel)
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
  const fontSize = terminalConfig.get<number>("fontSize") || editorConfig.get<number>("fontSize") || 14
  const escapedFamily = fontFamily.replace(/"/g, "&quot;")

  return `<!DOCTYPE html><html lang="vi"><head>
<meta http-equiv="Content-Security-Policy" content="${csp}">
<link rel="stylesheet" href="${xtermCss}"><link rel="stylesheet" href="${css}">
</head><body style="--cli-code-font-family:${escapedFamily};--cli-code-font-size:${fontSize}">
<div id="term"></div>
<script src="${main}"></script>
</body></html>`
}

function goneHtml(label: string): string {
  return `<!DOCTYPE html><html lang="vi"><body style="font-family: var(--vscode-font-family); padding: 24px">
<p>Phiên <strong>${label}</strong> đã kết thúc.</p>
<button id="restart">Khởi động lại</button>
<script>
  const vscode = acquireVsCodeApi()
  document.getElementById("restart").addEventListener("click", () => vscode.postMessage({ type: "restart" }))
</script></body></html>`
}
