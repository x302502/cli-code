import * as vscode from "vscode"
import * as os from "node:os"
import { CLI_TOOLS, type CliTool } from "./config.js"
import { detectInstalled, extractBinary } from "./detect.js"
import { getActiveFileReference } from "./editor.js"
import { locateLatestSession } from "./history/locate.js"
import { listSessionsForWorkspace } from "./history/scan.js"
import { codexHomeFromShell } from "./shell-env.js"
import { activePanelCwd, findExistingPanel, focusedPanelCwd, openTerminalPanel, pasteToActivePanel, writeToActivePanel } from "./panel.js"
import { mergeQuickCommands } from "./quick-commands.js"
import { SAFE_ID, continueLatestCommand } from "./restart-command.js"
import { pickTool } from "./terminal.js"

/** The folder a new CLI tab (or Resume) is for: the focused CLI tab's, else the workspace folder
 * of the file being edited, else the last CLI tab used — in a multi-root workspace, not simply
 * the first root, and not a tab from a while ago over the editor in front. */
function preferredCwd(): string | undefined {
  const doc = vscode.window.activeTextEditor?.document.uri
  return focusedPanelCwd() ?? (doc ? vscode.workspace.getWorkspaceFolder(doc)?.uri.fsPath : undefined) ?? activePanelCwd()
}

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
  }
  await openTerminalPanel(context, tool, { cwd: preferredCwd() })
}

/** Sends the active file's at-mention into the last-focused CLI panel. */
export function addFilepathToTerminal() {
  const fileRef = getActiveFileReference()
  if (!fileRef) return
  if (writeToActivePanel(fileRef)) return
  // No CLI tab (or its CLI has exited). Not VS Code's own terminal: `@path` typed into a plain
  // shell is a command, not a mention.
  void vscode.window.showInformationMessage("Open a CLI tab first (CLI Code: Open CLI), then insert the file.")
}

/** Lists past sessions for the current workspace and reopens the chosen one. */
export async function resumeSession(context: vscode.ExtensionContext): Promise<void> {
  // The CLI tab in front says which project is meant (a multi-root workspace has several).
  const cwd = preferredCwd() ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
  if (!cwd) {
    void vscode.window.showInformationMessage("Open a folder first.")
    return
  }
  type Item = vscode.QuickPickItem & { run: () => Promise<unknown> }
  // The picker opens at once and fills in as the lookups finish: history first, then the
  // "continue latest" entries, whose per-CLI store lookups are synchronous and would
  // otherwise hold the whole picker back.
  const quickPick = vscode.window.createQuickPick<Item>()
  quickPick.placeholder = "Pick a session to resume"
  quickPick.matchOnDescription = true
  quickPick.busy = true
  quickPick.show()
  let picked: Item | undefined
  // The picker closed while the lookups run: stop filling it (no late toast either) — but a
  // session picked from what was already listed still opens.
  let hidden = false
  const done = new Promise<void>((resolve) => {
    quickPick.onDidAccept(() => {
      picked = quickPick.selectedItems[0]
      quickPick.hide()
    })
    quickPick.onDidHide(() => {
      hidden = true
      quickPick.dispose()
      resolve()
    })
  })

  await codexHomeFromShell()
  // Independent lookups: CLI detection runs while the history is read.
  const installedLookup = detectInstalled(CLI_TOOLS.map((t) => extractBinary(t.command)))
  const sessions = await listSessionsForWorkspace(cwd)
  if (hidden) {
    await picked?.run()
    return
  }
  // The id is spliced into a shell command line (see SAFE_ID).
  quickPick.items = sessions
    .filter((s) => SAFE_ID.test(s.sessionId))
    .map((s) => {
      const tool = CLI_TOOLS.find((t) => t.id === s.toolId)!
      return {
        label: `$(history) ${s.title}`,
        description: tool.label,
        detail: new Date(s.updatedAt).toLocaleString(),
        run: () => openTerminalPanel(context, tool, { cwd, command: tool.resumeCommand!.replace("{sessionId}", s.sessionId), promptTitle: s.title }),
      }
    })
  // Tools whose sessions cannot be listed (no history parser) still get a "continue latest"
  // entry: this folder's newest session from the CLI's own store when it has one, else
  // --continue. Only installed CLIs are asked.
  const installed = await installedLookup
  if (hidden) {
    await picked?.run()
    return
  }
  const continueEntries: Item[] = []
  for (const tool of CLI_TOOLS) {
    if (!installed.get(extractBinary(tool.command)) || sessions.some((s) => s.toolId === tool.id)) continue
    const command = continueLatestCommand(tool, locateLatestSession(tool.historyToolId ?? tool.id, cwd, 0, os.homedir()))
    if (command !== undefined) {
      continueEntries.push({ label: `$(debug-continue) Continue latest session`, description: tool.label, run: () => openTerminalPanel(context, tool, { cwd, command }) })
    }
    // Each store lookup is synchronous file work: let the extension host breathe between CLIs.
    await new Promise<void>((r) => setImmediate(r))
    if (hidden) break
  }
  if (hidden) {
    await picked?.run()
    return
  }
  quickPick.items = [...quickPick.items, ...continueEntries]
  quickPick.busy = false
  if (quickPick.items.length === 0) {
    quickPick.hide()
    void vscode.window.showInformationMessage("No sessions found for this folder.")
    return
  }
  await done
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
