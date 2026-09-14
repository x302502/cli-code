import * as vscode from "vscode"
import { CLI_TOOLS } from "./config.js"
import { getActiveFileReference } from "./editor.js"
import { listSessionsForWorkspace } from "./history/scan.js"
import { activePanelCwd, findExistingPanel, openTerminalPanel, writeToActivePanel } from "./panel.js"
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
