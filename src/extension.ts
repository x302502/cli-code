import * as vscode from "vscode"
import { installHooksToDisk, uninstallHooksFromDisk } from "./lib/claude-hooks.js"
import { addFilepathToTerminal, addQuickCommand, openCli, resumeSession, runQuickCommand } from "./lib/commands.js"
import {
  activeTerminalPanel,
  applyFontZoom,
  holdDaemonAlive,
  restartPanel,
  restoreTerminalPanel,
  sendToActivePanel,
  setCustomTitle,
  VIEW_TYPE,
  type PanelState,
} from "./lib/panel.js"

export function activate(context: vscode.ExtensionContext) {
  // Restored CLI tabs only connect once they become visible; hold the daemon open in the
  // meantime so its idle-exit does not kill their sessions. Must not block activation.
  void holdDaemonAlive(context).then((d) => context.subscriptions.push(d))
  context.subscriptions.push(
    vscode.commands.registerCommand("cli-code.open", () => openCli(context, { reuseExisting: true })),
    vscode.commands.registerCommand("cli-code.openNew", () => openCli(context, { reuseExisting: false })),
    vscode.commands.registerCommand("cli-code.addFilepath", addFilepathToTerminal),
    vscode.commands.registerCommand("cli-code.resume", () => resumeSession(context)),
    vscode.commands.registerCommand("cli-code.quickCommand", () => runQuickCommand(context)),
    vscode.commands.registerCommand("cli-code.addQuickCommand", () => addQuickCommand()),
    vscode.commands.registerCommand("cli-code.renameTab", async () => {
      const panel = activeTerminalPanel()
      if (!panel) return
      const title = await vscode.window.showInputBox({ prompt: "Tên mới cho tab", value: panel.title })
      if (title?.trim()) setCustomTitle(panel, title.trim())
    }),
    vscode.commands.registerCommand("cli-code.restart", () => {
      const panel = activeTerminalPanel()
      if (panel) void restartPanel(context, panel)
    }),
    vscode.commands.registerCommand("cli-code.clear", () => sendToActivePanel({ type: "clear" })),
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
    vscode.commands.registerCommand("cli-code.installClaudeHooks", async () => {
      try {
        const choice = await vscode.window.showWarningMessage(
          "Cài hook trạng thái vào ~/.claude/settings.json (có sao lưu .bak)?",
          { modal: true },
          "Cài",
        )
        if (choice !== "Cài") return
        const changed = installHooksToDisk()
        void vscode.window.showInformationMessage(changed ? "Đã cài hook." : "Không có gì để thay đổi.")
      } catch (err) {
        void vscode.window.showErrorMessage(String(err))
      }
    }),
    vscode.commands.registerCommand("cli-code.uninstallClaudeHooks", () => {
      try {
        const changed = uninstallHooksFromDisk()
        void vscode.window.showInformationMessage(changed ? "Đã gỡ hook." : "Không có gì để thay đổi.")
      } catch (err) {
        void vscode.window.showErrorMessage(String(err))
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
}

export function deactivate() {}
