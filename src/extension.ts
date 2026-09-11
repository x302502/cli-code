import * as vscode from "vscode"
import { addFilepathToTerminal, openCli } from "./lib/commands.js"
import { findToolForTerminal } from "./lib/terminal.js"
import { startTitleSync } from "./lib/title-sync.js"

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("cli-code.open", () => openCli(context, { reuseExisting: true })),
    vscode.commands.registerCommand("cli-code.openNew", () => openCli(context, { reuseExisting: false })),
    vscode.commands.registerCommand("cli-code.addFilepath", addFilepathToTerminal),
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
