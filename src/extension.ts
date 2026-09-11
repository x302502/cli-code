import * as vscode from "vscode"
import { addFilepathToTerminal, openCli } from "./lib/commands.js"
import { openTerminalPanel, restoreTerminalPanel, VIEW_TYPE, type PanelState } from "./lib/panel.js"
import { findToolForTerminal, pickTool } from "./lib/terminal.js"
import { startTitleSync } from "./lib/title-sync.js"

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("cli-code.open", () => openCli(context, { reuseExisting: true })),
    vscode.commands.registerCommand("cli-code.openNew", () => openCli(context, { reuseExisting: false })),
    vscode.commands.registerCommand("cli-code.addFilepath", addFilepathToTerminal),
    vscode.commands.registerCommand("cli-code.openPanel", async () => {
      const tool = await pickTool(context)
      if (tool) await openTerminalPanel(context, tool)
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

  // Start watching session history (Claude, etc.) to automatically rename tabs to the latest prompt
  startTitleSync(context)

  // Debug channel
  const debug = vscode.window.createOutputChannel("CLI Code Debug")
  context.subscriptions.push(debug)
  debug.appendLine(`[activate] window.terminals count: ${vscode.window.terminals.length}`)

  for (const terminal of vscode.window.terminals) {
    const name = terminal.name
    const tool = findToolForTerminal(terminal)
    debug.appendLine(`[activate] existing terminal name="${name}" -> tool="${tool?.label ?? "(none)"}"`)
  }
}

export function deactivate() {}
