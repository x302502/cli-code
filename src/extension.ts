import * as vscode from "vscode"
import * as os from "node:os"
import { CLAUDE_SETTINGS_PATH, hooksInstalledOnDisk, installHooksToDisk, uninstallHooksFromDisk } from "./lib/claude-hooks.js"
import { STATUS_HOOK_INSTALLERS } from "./lib/hooks/registry.js"
import { summarize, syncStatusHooks } from "./lib/hooks/sync.js"
import { binaryOnPath } from "./lib/detect.js"
import { shellEnv } from "./lib/shell-env.js"
import { addFilepathToTerminal, addQuickCommand, openCli, resumeSession, runQuickCommand } from "./lib/commands.js"
import {
  activeTerminalPanel,
  checkAllStale,
  restartAllPanels,
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
async function runStatusHookSync(context: vscode.ExtensionContext, enabled: boolean, opts: { quiet?: boolean } = {}): Promise<void> {
  // The hook line needs `sh`, so never write it on Windows — not even from the explicit commands.
  if (process.platform === "win32") {
    if (!opts.quiet) void vscode.window.showWarningMessage("CLI Code status hooks are not supported on Windows.")
    return
  }
  // The CLIs' bin dirs usually come from .zshrc, which the extension host's PATH may lack.
  const env = await shellEnv()
  const envPath = env?.PATH ?? process.env.PATH
  // Codex reads CODEX_HOME from the shell it runs in (often set in .zshrc, which the extension
  // host never sourced); installing hooks and reading history must use the same folder.
  if (env?.CODEX_HOME && !process.env.CODEX_HOME) process.env.CODEX_HOME = env.CODEX_HOME
  const results = syncStatusHooks({ installers: STATUS_HOOK_INSTALLERS, home: os.homedir(), enabled, onPath: (b) => binaryOnPath(b, envPath) })
  // A file of the user's under our name is reported when asked (the explicit commands), not on
  // every activation: it stays the user's until they rename or remove it.
  const failed = results.some((r) => r.action === "error")
  if (results.some((r) => r.action === "installed" || r.action === "removed")) checkAllStale(context)
  if (failed) void vscode.window.showWarningMessage(`CLI Code status hooks — ${summarize(results)}`)
  else if (!opts.quiet) void vscode.window.showInformationMessage(`CLI Code status hooks — ${summarize(results)}`)
}

/** The explicit commands: sync now (with the summary toast), then flip the setting, or the next
 * activation's silent sync would undo them. Sync first so the toast reports what this call did;
 * the config listener's follow-up sync then finds everything unchanged and stays quiet. */
async function setStatusHooks(context: vscode.ExtensionContext, enabled: boolean): Promise<void> {
  await runStatusHookSync(context, enabled)
  await vscode.workspace.getConfiguration("cliCode").update("statusHooks", enabled, vscode.ConfigurationTarget.Global)
}

export function activate(context: vscode.ExtensionContext): TestApi {
  // Restored CLI tabs only connect once they become visible; hold the daemon open in the
  // meantime so its idle-exit does not kill their sessions. Must not block activation.
  void holdDaemonAlive(context).then((d) => context.subscriptions.push(d))
  // Status hooks follow the setting silently, like Orca: installed for every supported CLI on
  // PATH, removed everywhere when turned off. Never from the integration-test host (it runs
  // against the real home).
  if (context.extensionMode !== vscode.ExtensionMode.Test) void runStatusHookSync(context, statusHooksEnabled(), { quiet: true })
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
    vscode.commands.registerCommand("cli-code.restartAllSessions", () => restartAllPanels(context)),
    vscode.commands.registerCommand("cli-code.installStatusHooks", () => setStatusHooks(context, true)),
    vscode.commands.registerCommand("cli-code.removeStatusHooks", () => setStatusHooks(context, false)),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("cliCode.statusHooks")) void runStatusHookSync(context, statusHooksEnabled(), { quiet: true })
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
