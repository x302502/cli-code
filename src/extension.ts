import * as vscode from "vscode"
import * as os from "node:os"
import { claudeSettingsPath, hooksInstalledOnDisk, installHooksToDisk, uninstallHooksFromDisk } from "./lib/claude-hooks.js"
import { STATUS_HOOK_INSTALLERS } from "./lib/hooks/registry.js"
import { summarize, syncStatusHooks } from "./lib/hooks/sync.js"
import { binaryOnPath } from "./lib/detect.js"
import { codexHomeFromShell, shellEnv } from "./lib/shell-env.js"
import { addStatusBarButton } from "./lib/status-button.js"
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
  onFirstTab,
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
  // Installing hooks and reading history must use the folder Codex does.
  await codexHomeFromShell()
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
  // Written where the effective value comes from: a workspace setting would otherwise outrank a
  // Global write, and the config listener would silently undo what was just done. (The setting
  // is window-scoped: there is no folder value.)
  const config = vscode.workspace.getConfiguration("cliCode")
  const inWorkspace = config.inspect<boolean>("statusHooks")?.workspaceValue !== undefined
  await config.update("statusHooks", enabled, inWorkspace ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global)
}

export function activate(context: vscode.ExtensionContext): TestApi {
  // The integration-test host gets a home and a temp dir of its own (the runner cannot give the
  // whole Electron process another HOME: Chromium breaks). Set here, for this process only —
  // os.homedir()/os.tmpdir() read them on every call — so no code path can reach the developer's
  // real CLI configs, and every daemon's socket sits where the runner can clean it up.
  if (context.extensionMode === vscode.ExtensionMode.Test) {
    if (process.env.CLI_CODE_ITEST_HOME) process.env.HOME = process.env.CLI_CODE_ITEST_HOME
    if (process.env.CLI_CODE_ITEST_TMP) process.env.TMPDIR = process.env.CLI_CODE_ITEST_TMP
  }
  // Restored CLI tabs only connect once they become visible; hold the daemon open in the
  // meantime so its idle-exit does not kill their sessions. Must not block activation.
  void holdDaemonAlive(context).then((d) => context.subscriptions.push(d))
  // Status hooks follow the setting silently, like Orca: installed for every supported CLI on
  // PATH, removed everywhere when turned off — once a CLI tab is first opened or restored in this
  // window, not at activation: that takes a login-shell probe and a pass over a dozen config
  // files, which a window that never opens a CLI should not pay (nor race other windows on).
  // Hooks only matter inside CLI Code's tabs, and stay installed once written. Never from the
  // integration-test host (it runs against the real home).
  onFirstTab(async () => {
    if (context.extensionMode !== vscode.ExtensionMode.Test) await runStatusHookSync(context, statusHooksEnabled(), { quiet: true })
  })
  addStatusBarButton(context)
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
    // Open Link / File / Folder differ only in the menu entry that shows them; the host decides
    // by what the text resolves to. Only "default app" changes what happens.
    ...(
      [
        ["cli-code.openLinkAt", false],
        ["cli-code.openFileAt", false],
        ["cli-code.openDirAt", false],
        ["cli-code.openWithDefaultAppAt", true],
      ] as const
    ).map(([id, withDefaultApp]) =>
      vscode.commands.registerCommand(id, (ctx?: MenuContext) => linkText(ctx) && openLinkTextInActivePanel(linkText(ctx)!, withDefaultApp)),
    ),
    vscode.commands.registerCommand("cli-code.copyLinkAt", (ctx?: MenuContext) => linkText(ctx) && vscode.env.clipboard.writeText(linkText(ctx)!)),
    vscode.commands.registerCommand("cli-code.insertPathAt", (ctx?: MenuContext) => linkText(ctx) && insertPathInActivePanel(linkText(ctx)!)),
    vscode.commands.registerCommand("cli-code.findSelection", (ctx?: MenuContext) =>
      sendToActivePanel({ type: "find", query: typeof ctx?.cliCodeSelection === "string" ? ctx.cliCodeSelection.split("\n")[0] : undefined }),
    ),
    vscode.commands.registerCommand("cli-code.restartAllSessions", () => restartAllPanels(context)),
    vscode.commands.registerCommand("cli-code.installStatusHooks", () => setStatusHooks(context, true)),
    vscode.commands.registerCommand("cli-code.removeStatusHooks", () => setStatusHooks(context, false)),
    vscode.workspace.onDidChangeConfiguration((e) => {
      // Never from the integration-test host, which runs against the real home (as at activation).
      if (e.affectsConfiguration("cliCode.statusHooks") && context.extensionMode !== vscode.ExtensionMode.Test) {
        void runStatusHookSync(context, statusHooksEnabled(), { quiet: true })
      }
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
    claudeSettingsPath: claudeSettingsPath(),
    daemonPid,
    inspectPanel,
    restartFromGone,
  }
}

export function deactivate() {}
