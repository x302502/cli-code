import * as vscode from "vscode"
import * as os from "node:os"
import { CLI_TOOLS, type CliTool } from "./config.js"
import { getActiveFileReference } from "./editor.js"
import { locateLatestSession } from "./history/locate.js"
import { listSessionsForWorkspace } from "./history/scan.js"
import { activePanelCwd, findExistingPanel, openTerminalPanel, pasteToActivePanel, writeToActivePanel } from "./panel.js"
import { mergeQuickCommands } from "./quick-commands.js"
import { continueLatestCommand } from "./restart-command.js"
import { pickTool } from "./terminal.js"

/** Opens a CLI terminal panel, optionally reusing an already-open one for the chosen tool. */
export async function openCli(context: vscode.ExtensionContext, options: { reuseExisting: boolean }) {
  const tool = await pickTool(context)
  if (!tool) return

  if (options.reuseExisting) {
    const existing = findExistingPanel(tool)
    if (existing) {
      existing.reveal()
      return
    }
    await openTerminalPanel(context, tool)
    return
  }

  await openTerminalPanel(context, tool, { cwd: activePanelCwd() })
}

/** Sends the active file's at-mention into the last-focused CLI panel. */
export function addFilepathToTerminal() {
  const fileRef = getActiveFileReference()
  if (!fileRef) return
  writeToActivePanel(fileRef)
}

/** Lists past sessions for the current workspace and reopens the chosen one. */
export async function resumeSession(context: vscode.ExtensionContext): Promise<void> {
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
  if (!cwd) {
    void vscode.window.showInformationMessage("Open a folder first.")
    return
  }
  const sessions = await listSessionsForWorkspace(cwd)
  // Tools whose sessions cannot be listed (no history parser) still get a "continue latest"
  // entry: this folder's newest session from the CLI's own store when it has one, else --continue.
  const continueEntries = CLI_TOOLS.filter((t) => !sessions.some((s) => s.toolId === t.id))
    .map((tool) => ({ tool, command: continueLatestCommand(tool, locateLatestSession(tool.historyToolId ?? tool.id, cwd, 0, os.homedir())) }))
    .filter((e): e is { tool: CliTool; command: string } => e.command !== undefined)
  if (sessions.length === 0 && continueEntries.length === 0) {
    void vscode.window.showInformationMessage("No sessions found for this folder.")
    return
  }
  type Item = vscode.QuickPickItem & { run: () => Promise<void> }
  // The id is spliced into a shell command line; anything outside [\w.-] is not a session id.
  const items: Item[] = sessions.filter((s) => /^[\w.-]+$/.test(s.sessionId)).map((s) => {
    const tool = CLI_TOOLS.find((t) => t.id === s.toolId)!
    return {
      label: `$(history) ${s.title}`,
      description: tool.label,
      detail: new Date(s.updatedAt).toLocaleString(),
      run: () => openTerminalPanel(context, tool, { command: tool.resumeCommand!.replace("{sessionId}", s.sessionId), title: s.title }),
    }
  })
  for (const { tool, command } of continueEntries) {
    items.push({ label: `$(debug-continue) Continue latest session`, description: tool.label, run: () => openTerminalPanel(context, tool, { command }) })
  }
  const picked = await vscode.window.showQuickPick(items, { placeHolder: "Pick a session to resume", matchOnDescription: true })
  if (picked) await picked.run()
}

/** Runs a reusable command/prompt from cliCode.quickCommands (user and/or workspace settings)
 * in the active CLI panel, or opens a new one if there isn't one. */
export async function runQuickCommand(context: vscode.ExtensionContext): Promise<void> {
  const inspected = vscode.workspace.getConfiguration("cliCode").inspect<unknown>("quickCommands")
  const commands = mergeQuickCommands(inspected?.globalValue, inspected?.workspaceValue)
  if (commands.length === 0) {
    void vscode.window.showInformationMessage("No quick commands yet. Add some in the cliCode.quickCommands setting.")
    return
  }
  const picked = await vscode.window.showQuickPick(
    commands.map((c) => ({ label: `${c.scope === "workspace" ? "$(folder)" : "$(globe)"} ${c.label}`, detail: c.text, c })),
    { placeHolder: "Pick a quick command" },
  )
  if (!picked) return
  const submit = picked.c.submit !== false
  if (pasteToActivePanel(picked.c.text, submit)) return
  const tool = await pickTool(context)
  if (!tool) return
  await openTerminalPanel(context, tool, { quickCommandLabel: picked.c.label, initialInput: { text: picked.c.text, submit } })
}

/** Saves the active editor's selection as a quick command in user or workspace settings. */
export async function addQuickCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor
  const text = editor?.document.getText(editor.selection)
  if (!text) {
    void vscode.window.showInformationMessage("Select some text first.")
    return
  }
  const label = await vscode.window.showInputBox({ prompt: "Quick command name" })
  if (!label?.trim()) return

  const hasWorkspace = !!vscode.workspace.workspaceFolders?.length
  type ScopeItem = vscode.QuickPickItem & { target: vscode.ConfigurationTarget }
  const scopeItems: ScopeItem[] = [{ label: "Global (User settings)", target: vscode.ConfigurationTarget.Global }]
  if (hasWorkspace) scopeItems.push({ label: "Project (Workspace settings)", target: vscode.ConfigurationTarget.Workspace })
  const scope = await vscode.window.showQuickPick(scopeItems, { placeHolder: "Save where?" })
  if (!scope) return

  const config = vscode.workspace.getConfiguration("cliCode")
  const inspected = config.inspect<unknown>("quickCommands")
  const current = scope.target === vscode.ConfigurationTarget.Global ? inspected?.globalValue : inspected?.workspaceValue
  const existing = Array.isArray(current) ? current : []
  await config.update("quickCommands", [...existing, { label: label.trim(), text }], scope.target)
}
