import * as vscode from "vscode"
import { CLI_TOOLS } from "./config.js"
import { getActiveFileReference } from "./editor.js"
import { listSessionsForWorkspace } from "./history/scan.js"
import { activePanelCwd, findExistingPanel, openTerminalPanel, pasteToActivePanel, writeToActivePanel } from "./panel.js"
import { mergeQuickCommands } from "./quick-commands.js"
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
    void vscode.window.showInformationMessage("Mở một thư mục trước.")
    return
  }
  const sessions = await listSessionsForWorkspace(cwd)
  const continueOnlyTools = CLI_TOOLS.filter((t) => t.continueCommand && !t.resumeCommand)
  if (sessions.length === 0 && continueOnlyTools.length === 0) {
    void vscode.window.showInformationMessage("Không tìm thấy phiên nào cho thư mục này.")
    return
  }
  type Item = vscode.QuickPickItem & { run: () => Promise<void> }
  const items: Item[] = sessions.map((s) => {
    const tool = CLI_TOOLS.find((t) => t.id === s.toolId)!
    return {
      label: `$(history) ${s.title}`,
      description: tool.label,
      detail: new Date(s.updatedAt).toLocaleString("vi-VN"),
      run: () => openTerminalPanel(context, tool, { command: tool.resumeCommand!.replace("{sessionId}", s.sessionId), title: s.title }),
    }
  })
  for (const tool of continueOnlyTools) {
    items.push({ label: `$(debug-continue) Tiếp tục phiên gần nhất`, description: tool.label, run: () => openTerminalPanel(context, tool, { command: tool.continueCommand! }) })
  }
  const picked = await vscode.window.showQuickPick(items, { placeHolder: "Chọn phiên để mở lại", matchOnDescription: true })
  if (picked) await picked.run()
}

/** Runs a reusable command/prompt from cliCode.quickCommands (user and/or workspace settings)
 * in the active CLI panel, or opens a new one if there isn't one. */
export async function runQuickCommand(context: vscode.ExtensionContext): Promise<void> {
  const inspected = vscode.workspace.getConfiguration("cliCode").inspect<unknown>("quickCommands")
  const commands = mergeQuickCommands(inspected?.globalValue, inspected?.workspaceValue)
  if (commands.length === 0) {
    void vscode.window.showInformationMessage("Chưa có lệnh nhanh nào. Thêm trong setting cliCode.quickCommands.")
    return
  }
  const picked = await vscode.window.showQuickPick(
    commands.map((c) => ({ label: `${c.scope === "workspace" ? "$(folder)" : "$(globe)"} ${c.label}`, detail: c.text, c })),
    { placeHolder: "Chọn lệnh nhanh" },
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
    void vscode.window.showInformationMessage("Chọn đoạn văn bản trước.")
    return
  }
  const label = await vscode.window.showInputBox({ prompt: "Tên lệnh nhanh" })
  if (!label?.trim()) return

  const hasWorkspace = !!vscode.workspace.workspaceFolders?.length
  type ScopeItem = vscode.QuickPickItem & { target: vscode.ConfigurationTarget }
  const scopeItems: ScopeItem[] = [{ label: "Global (User settings)", target: vscode.ConfigurationTarget.Global }]
  if (hasWorkspace) scopeItems.push({ label: "Project (Workspace settings)", target: vscode.ConfigurationTarget.Workspace })
  const scope = await vscode.window.showQuickPick(scopeItems, { placeHolder: "Lưu vào đâu?" })
  if (!scope) return

  const config = vscode.workspace.getConfiguration("cliCode")
  const inspected = config.inspect<unknown[]>("quickCommands")
  const existing =
    (scope.target === vscode.ConfigurationTarget.Global ? inspected?.globalValue : inspected?.workspaceValue) ?? []
  await config.update("quickCommands", [...existing, { label: label.trim(), text }], scope.target)
}
