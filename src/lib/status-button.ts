import * as vscode from "vscode"

/** Right-side status bar button, like the "Claude Code" one. A low priority keeps it next to the bell. */
export function addStatusBarButton(context: vscode.ExtensionContext): void {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, -100)
  item.text = "$(cli-code-logo) CLI Code"
  item.tooltip = "Open CLI Code"
  item.command = "cli-code.open"
  item.show()
  context.subscriptions.push(item)
}
