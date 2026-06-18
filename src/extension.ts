import * as vscode from "vscode"
import { addFilepathToTerminal, openCli } from "./lib/commands.js"

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("cli-code.open", () => openCli(context, { reuseExisting: true })),
    vscode.commands.registerCommand("cli-code.openNew", () => openCli(context, { reuseExisting: false })),
    vscode.commands.registerCommand("cli-code.addFilepath", addFilepathToTerminal),
  )
}

export function deactivate() {}
