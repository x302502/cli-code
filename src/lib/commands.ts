import * as vscode from "vscode"
import { getActiveFileReference } from "./editor.js"
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
