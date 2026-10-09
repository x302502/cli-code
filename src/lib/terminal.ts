import * as vscode from "vscode"
import { CLI_TOOLS, defaultFirst, type CliTool } from "./config.js"
import { detectInstalled, extractBinary } from "./detect.js"

/** A CLI's icon, in its light and dark variants (images/agents-light, images/agents-dark). */
export function iconFor(context: vscode.ExtensionContext, tool: CliTool): { light: vscode.Uri; dark: vscode.Uri } {
  return {
    light: vscode.Uri.file(context.asAbsolutePath(`images/agents-light/${tool.icon}`)),
    dark: vscode.Uri.file(context.asAbsolutePath(`images/agents-dark/${tool.icon}`)),
  }
}

/** A QuickPick item carrying the tool id so we can look it up on accept. */
type ToolPickItem = vscode.QuickPickItem & { id: string }

/**
 * Prompts the user to choose a CLI tool. Installed tools are sorted to the top
 * under an "Installed" header; uninstalled ones appear below "Not installed"
 * and selecting one shows a warning instead of launching. Each item shows the
 * agent's own icon (light/dark variants) beside its label.
 */
export async function pickTool(context: vscode.ExtensionContext): Promise<CliTool | undefined> {
  const quickPick = vscode.window.createQuickPick<vscode.QuickPickItem>()
  quickPick.placeholder = "Detecting installed CLIs…"
  quickPick.busy = true
  // Hide is wired before the detection await: Esc while "Detecting…" must end the command,
  // not leave it waiting on a picker nobody can accept.
  let hidden = false
  let settle: (tool: CliTool | undefined) => void = () => {}
  const picked = new Promise<CliTool | undefined>((resolve) => (settle = resolve))
  quickPick.onDidHide(() => {
    hidden = true
    settle(undefined)
    quickPick.dispose()
  })
  quickPick.show()

  const binaries = CLI_TOOLS.map((t) => extractBinary(t.command))
  const installedMap = await detectInstalled(binaries)
  if (hidden) return undefined

  const defaultId = () => vscode.workspace.getConfiguration("cliCode").get<string>("defaultCli")
  const separator = (label: string): vscode.QuickPickItem => ({ label, kind: vscode.QuickPickItemKind.Separator })
  const render = () => {
    const installedItems: ToolPickItem[] = []
    const notInstalledItems: ToolPickItem[] = []
    // Only an installed default is moved up: an absent one would just top "Not installed".
    const defaultTool = CLI_TOOLS.find((t) => t.id === defaultId())
    const installedDefault = defaultTool && installedMap.get(extractBinary(defaultTool.command)) ? defaultTool.id : undefined
    for (const tool of defaultFirst(CLI_TOOLS, installedDefault)) {
      const binary = extractBinary(tool.command)
      const isInstalled = installedMap.get(binary) ?? false
      const isDefault = isInstalled && tool.id === defaultId()
      const item: ToolPickItem = {
        label: tool.label,
        description: isInstalled ? (isDefault ? `$(star-full) default · ${tool.description ?? ""}` : tool.description) : "not installed",
        id: tool.id,
        iconPath: iconFor(context, tool),
        buttons: isInstalled
          ? [{ iconPath: isDefault ? new vscode.ThemeIcon("star-full", new vscode.ThemeColor("charts.yellow")) : new vscode.ThemeIcon("star-empty"), tooltip: isDefault ? "Default CLI (click to unset)" : "Set as default CLI" }]
          : [],
      }
      if (isInstalled) installedItems.push(item)
      else notInstalledItems.push(item)
    }
    const items: vscode.QuickPickItem[] = []
    if (installedItems.length > 0) items.push(separator("Installed"), ...installedItems)
    if (notInstalledItems.length > 0) items.push(separator("Not installed"), ...notInstalledItems)
    quickPick.items = items
  }

  quickPick.placeholder = "Select a CLI to open"
  quickPick.busy = false
  render()
  quickPick.onDidTriggerItemButton(async ({ item }) => {
    const id = (item as ToolPickItem).id
    try {
      await vscode.workspace
        .getConfiguration("cliCode")
        .update("defaultCli", id === defaultId() ? undefined : id, vscode.ConfigurationTarget.Global)
    } catch (err) {
      vscode.window.showErrorMessage(`Could not save the default CLI: ${(err as Error).message}`)
    }
    render()
  })

  quickPick.onDidAccept(() => {
    const selected = quickPick.selectedItems[0]
    if (!selected || selected.kind === vscode.QuickPickItemKind.Separator) return
    const tool = CLI_TOOLS.find((t) => t.id === (selected as ToolPickItem).id)
    if (!tool) return
    const binary = extractBinary(tool.command)
    if (!(installedMap.get(binary) ?? false)) {
      vscode.window.showWarningMessage(
        `${tool.label} is not installed or not on your PATH. Install it first, then reopen this menu.`,
      )
      return // keep picker open so the user can pick another tool
    }
    settle(tool)
    quickPick.hide()
  })
  return picked
}

/** Builds the environment variables a terminal should launch with for a tool. */
export function buildEnv(tool: CliTool): Record<string, string> {
  return { ...tool.extraEnv }
}
