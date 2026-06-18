import * as vscode from "vscode"
import { getActiveFileReference } from "./editor.js"
import { appendPrompt } from "./http-client.js"
import { findExistingTerminal, findToolForTerminal, openTerminal, pickTool, readTerminalPort } from "./terminal.js"

/** Opens a CLI terminal, optionally reusing an already-open one for the chosen tool. */
export async function openCli(context: vscode.ExtensionContext, options: { reuseExisting: boolean }) {
  const tool = await pickTool()
  if (!tool) return

  if (options.reuseExisting) {
    const existing = findExistingTerminal(tool)
    if (existing) {
      existing.show()
      return
    }
  }

  await openTerminal(context, tool)
}

/** Sends the active file's at-mention to the focused CLI terminal. */
export async function addFilepathToTerminal() {
  const fileRef = getActiveFileReference()
  if (!fileRef) return

  const terminal = vscode.window.activeTerminal
  if (!terminal) return

  const tool = findToolForTerminal(terminal)
  if (!tool) return

  if (tool.hasHttpApi && tool.portEnvVar && tool.appendPromptPath) {
    const port = readTerminalPort(terminal, tool.portEnvVar)
    if (port && (await appendPrompt(port, tool.appendPromptPath, fileRef))) {
      terminal.show()
      return
    }
  }

  terminal.sendText(fileRef, false)
  terminal.show()
}
