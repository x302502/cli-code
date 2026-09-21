import * as vscode from "vscode"
import * as os from "node:os"
import { CLAUDE_SETTINGS_PATH, hooksInstalledOnDisk, installHooksToDisk, uninstallHooksFromDisk } from "./lib/claude-hooks.js"
import { STATUS_HOOK_INSTALLERS } from "./lib/hooks/registry.js"
import { binaryOnPath, summarize, syncStatusHooks } from "./lib/hooks/sync.js"
import { addFilepathToTerminal, addQuickCommand, openCli, resumeSession, runQuickCommand } from "./lib/commands.js"
import {
  activeTerminalPanel,
  applyFontZoom,
  baseTitle,
  currentFontSize,
  daemonPid,
  holdDaemonAlive,
  inspectPanel,
  listActivePanels,
  openTerminalPanel,
  pasteToActivePanel,
  restartFromGone,
  restartPanel,
  restoreTerminalPanel,
  sendToActivePanel,
  setCustomTitle,
  VIEW_TYPE,
  writeToActivePanel,
  openNewSessionLikeActive,
  openLinkTextInActivePanel,
  insertPathInActivePanel,
  type PanelState,
} from "./lib/panel.js"

/** Handed to integration tests via `extension.exports`. Re-exports only; no test-only behaviour. */
export type TestApi = {
  context: vscode.ExtensionContext
  openTerminalPanel: typeof openTerminalPanel
  restoreTerminalPanel: typeof restoreTerminalPanel
  restartPanel: typeof restartPanel
  setCustomTitle: typeof setCustomTitle
  applyFontZoom: typeof applyFontZoom
  currentFontSize: typeof currentFontSize
  pasteToActivePanel: typeof pasteToActivePanel
  writeToActivePanel: typeof writeToActivePanel
  activePanels(): vscode.WebviewPanel[]
  installHooksToDisk: typeof installHooksToDisk
  uninstallHooksFromDisk: typeof uninstallHooksFromDisk
  hooksInstalledOnDisk: typeof hooksInstalledOnDisk
  claudeSettingsPath: string
  daemonPid: typeof daemonPid
  inspectPanel: typeof inspectPanel
  restartFromGone: typeof restartFromGone
}

/** Shape of the `data-vscode-context` object the terminal webview sets before a right-click. */
type MenuContext = { cliCodeLinkKind?: string; cliCodeLinkText?: string; cliCodeHasSelection?: boolean; cliCodeSelection?: string }
function linkText(ctx?: MenuContext): string | undefined {
  return typeof ctx?.cliCodeLinkText === "string" && ctx.cliCodeLinkText ? ctx.cliCodeLinkText : undefined
}

function statusHooksEnabled(): boolean {
  return vscode.workspace.getConfiguration("cliCode").get<boolean>("statusHooks", true)
}

/** Installs/removes the status hooks of every supported CLI; the summary is shown unless quiet
 * (then only failures are). */
async function runStatusHookSync(enabled: boolean, opts: { quiet?: boolean } = {}): Promise<void> {
  const results = syncStatusHooks({ installers: STATUS_HOOK_INSTALLERS, home: os.homedir(), enabled, onPath: binaryOnPath })
  const failed = results.some((r) => r.action === "error")
  if (failed) void vscode.window.showWarningMessage(`CLI Code status hooks — ${summarize(results)}`)
  else if (!opts.quiet) void vscode.window.showInformationMessage(`CLI Code status hooks — ${summarize(results)}`)
}

export function activate(context: vscode.ExtensionContext): TestApi {
  // Restored CLI tabs only connect once they become visible; hold the daemon open in the
  // meantime so its idle-exit does not kill their sessions. Must not block activation.
  void holdDaemonAlive(context).then((d) => context.subscriptions.push(d))
  // Status hooks follow the setting silently, like Orca: installed for every supported CLI on
  // PATH, removed everywhere when turned off. Never from the integration-test host (it runs
  // against the real home) and never on Windows (the hook line needs `sh`).
  if (context.extensionMode !== vscode.ExtensionMode.Test && process.platform !== "win32") void runStatusHookSync(statusHooksEnabled(), { quiet: true })
  context.subscriptions.push(
    vscode.commands.registerCommand("cli-code.open", () => openCli(context, { reuseExisting: true })),
    vscode.commands.registerCommand("cli-code.openNew", () => openCli(context, { reuseExisting: false })),
    vscode.commands.registerCommand("cli-code.addFilepath", addFilepathToTerminal),
    vscode.commands.registerCommand("cli-code.resume", () => resumeSession(context)),
    vscode.commands.registerCommand("cli-code.quickCommand", () => runQuickCommand(context)),
    vscode.commands.registerCommand("cli-code.addQuickCommand", () => addQuickCommand()),
    vscode.commands.registerCommand("cli-code.newSession", async () => {
      // Outside a CLI tab there is nothing to copy the tool from: fall back to the picker.
      if (!(await openNewSessionLikeActive(context))) await openCli(context, { reuseExisting: false })
    }),
    vscode.commands.registerCommand("cli-code.renameTab", async () => {
      const panel = activeTerminalPanel()
      if (!panel) return
      const title = await vscode.window.showInputBox({ prompt: "New tab name", value: baseTitle(panel) })
      if (title?.trim()) setCustomTitle(panel, title.trim())
    }),
    vscode.commands.registerCommand("cli-code.restart", () => {
      const panel = activeTerminalPanel()
      if (panel) void restartPanel(context, panel)
    }),
    vscode.commands.registerCommand("cli-code.fontZoomIn", () => void applyFontZoom(context, 1)),
    vscode.commands.registerCommand("cli-code.fontZoomOut", () => void applyFontZoom(context, -1)),
    vscode.commands.registerCommand("cli-code.fontZoomReset", () => void applyFontZoom(context, "reset")),
    vscode.commands.registerCommand("cli-code.find", () => sendToActivePanel({ type: "find" })),
    vscode.commands.registerCommand("cli-code.copyContext", () => sendToActivePanel({ type: "copyContext", maxLines: 200 })),
    vscode.commands.registerCommand("cli-code.paste", async () => {
      const text = await vscode.env.clipboard.readText()
      sendToActivePanel({ type: "pasteText", text })
    }),
    vscode.commands.registerCommand("cli-code.copySelection", () => sendToActivePanel({ type: "copySelection" })),
    vscode.commands.registerCommand("cli-code.selectAll", () => sendToActivePanel({ type: "selectAll" })),
    // Content-aware right-click entries: VS Code passes the webview's data-vscode-context as the argument.
    vscode.commands.registerCommand("cli-code.openLinkAt", (ctx?: MenuContext) => linkText(ctx) && openLinkTextInActivePanel(linkText(ctx)!, false)),
    vscode.commands.registerCommand("cli-code.openFileAt", (ctx?: MenuContext) => linkText(ctx) && openLinkTextInActivePanel(linkText(ctx)!, false)),
    vscode.commands.registerCommand("cli-code.openDirAt", (ctx?: MenuContext) => linkText(ctx) && openLinkTextInActivePanel(linkText(ctx)!, false)),
    vscode.commands.registerCommand("cli-code.openWithDefaultAppAt", (ctx?: MenuContext) => linkText(ctx) && openLinkTextInActivePanel(linkText(ctx)!, true)),
    vscode.commands.registerCommand("cli-code.copyLinkAt", (ctx?: MenuContext) => linkText(ctx) && vscode.env.clipboard.writeText(linkText(ctx)!)),
    vscode.commands.registerCommand("cli-code.insertPathAt", (ctx?: MenuContext) => linkText(ctx) && insertPathInActivePanel(linkText(ctx)!)),
    vscode.commands.registerCommand("cli-code.findSelection", (ctx?: MenuContext) =>
      sendToActivePanel({ type: "find", query: typeof ctx?.cliCodeSelection === "string" ? ctx.cliCodeSelection.split("\n")[0] : undefined }),
    ),
    vscode.commands.registerCommand("cli-code.installStatusHooks", () => runStatusHookSync(true)),
    vscode.commands.registerCommand("cli-code.removeStatusHooks", () => runStatusHookSync(false)),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("cliCode.statusHooks")) void runStatusHookSync(statusHooksEnabled(), { quiet: true })
    }),
    vscode.window.registerWebviewPanelSerializer(VIEW_TYPE, {
      async deserializeWebviewPanel(panel: vscode.WebviewPanel, state: PanelState | undefined) {
        if (!state?.sessionId) {
          panel.dispose()
          return
        }
        try {
          await restoreTerminalPanel(context, panel, state)
        } catch (err) {
          void vscode.window.showErrorMessage(String(err))
        }
      },
    }),
  )
  return {
    context,
    openTerminalPanel,
    restoreTerminalPanel,
    restartPanel,
    setCustomTitle,
    applyFontZoom,
    currentFontSize,
    pasteToActivePanel,
    writeToActivePanel,
    activePanels: listActivePanels,
    installHooksToDisk,
    uninstallHooksFromDisk,
    hooksInstalledOnDisk,
    claudeSettingsPath: CLAUDE_SETTINGS_PATH,
    daemonPid,
    inspectPanel,
    restartFromGone,
  }
}

export function deactivate() {}
