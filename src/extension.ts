// This method is called when your extension is deactivated
export function deactivate() {}

import * as vscode from "vscode"

type CliTool = {
  id: string
  label: string
  description?: string
  command: string
  hasHttpApi: boolean
  portEnvVar?: string
  appendPromptPath?: string
  readyCheckPath?: string
}

const CLI_TOOLS: CliTool[] = [
  {
    id: "claude",
    label: "Claude Code",
    description: "Anthropic Claude Code CLI",
    command: "claude",
    hasHttpApi: false,
  },
  {
    id: "opencode",
    label: "opencode",
    description: "opencode TUI (HTTP-aware)",
    command: "opencode --port {port}",
    hasHttpApi: true,
    portEnvVar: "_EXTENSION_OPENCODE_PORT",
    appendPromptPath: "/tui/append-prompt",
    readyCheckPath: "/app",
  },
  {
    id: "gemini",
    label: "Gemini CLI",
    description: "Google Gemini CLI",
    command: "gemini",
    hasHttpApi: false,
  },
  {
    id: "aider",
    label: "Aider",
    description: "Aider pair-programming CLI",
    command: "aider",
    hasHttpApi: false,
  },
]

export function activate(context: vscode.ExtensionContext) {
  const openDisposable = vscode.commands.registerCommand("cli-code.open", async () => {
    const tool = await pickTool()
    if (!tool) return

    const existing = vscode.window.terminals.find((t) => t.name === tool.id)
    if (existing) {
      existing.show()
      return
    }

    await openTerminal(tool)
  })

  const openNewDisposable = vscode.commands.registerCommand("cli-code.openNew", async () => {
    const tool = await pickTool()
    if (!tool) return
    await openTerminal(tool)
  })

  const addFilepathDisposable = vscode.commands.registerCommand("cli-code.addFilepath", async () => {
    const fileRef = getActiveFile()
    if (!fileRef) return

    const terminal = vscode.window.activeTerminal
    if (!terminal) return

    const tool = CLI_TOOLS.find((t) => t.id === terminal.name)
    if (!tool) return

    if (tool.hasHttpApi && tool.portEnvVar && tool.appendPromptPath) {
      // @ts-ignore
      const port = terminal.creationOptions.env?.[tool.portEnvVar]
      if (port) {
        await appendPrompt(parseInt(port), tool.appendPromptPath, fileRef)
        terminal.show()
        return
      }
    }

    terminal.sendText(fileRef, false)
    terminal.show()
  })

  context.subscriptions.push(openDisposable, openNewDisposable, addFilepathDisposable)

  async function pickTool() {
    const picked = await vscode.window.showQuickPick(
      CLI_TOOLS.map((t) => ({ label: t.label, description: t.description, id: t.id })),
      { placeHolder: "Select a CLI to open" },
    )
    if (!picked) return
    return CLI_TOOLS.find((t) => t.id === picked.id)
  }

  async function openTerminal(tool: CliTool) {
    const port = tool.hasHttpApi ? Math.floor(Math.random() * (65535 - 16384 + 1)) + 16384 : undefined

    const env: Record<string, string> = { OPENCODE_CALLER: "vscode" }
    if (port && tool.portEnvVar) env[tool.portEnvVar] = port.toString()

    const terminal = vscode.window.createTerminal({
      name: tool.id,
      iconPath: {
        light: vscode.Uri.file(context.asAbsolutePath("images/button-dark.svg")),
        dark: vscode.Uri.file(context.asAbsolutePath("images/button-light.svg")),
      },
      location: {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: false,
      },
      env,
    })

    terminal.show()
    terminal.sendText(port ? tool.command.replace("{port}", port.toString()) : tool.command)

    const fileRef = getActiveFile()
    if (!fileRef) return

    if (!(tool.hasHttpApi && port && tool.readyCheckPath && tool.appendPromptPath)) return

    // Wait for the CLI HTTP server to be ready
    let tries = 10
    let connected = false
    do {
      await new Promise((resolve) => setTimeout(resolve, 200))
      try {
        await fetch(`http://localhost:${port}${tool.readyCheckPath}`)
        connected = true
        break
      } catch {}
      tries--
    } while (tries > 0)

    if (connected) {
      await appendPrompt(port, tool.appendPromptPath, `In ${fileRef}`)
      terminal.show()
    }
  }

  async function appendPrompt(port: number, path: string, text: string) {
    await fetch(`http://localhost:${port}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    })
  }

  function getActiveFile() {
    const activeEditor = vscode.window.activeTextEditor
    if (!activeEditor) {
      return
    }

    const document = activeEditor.document
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri)
    if (!workspaceFolder) {
      return
    }

    // Get the relative path from workspace root
    const relativePath = vscode.workspace.asRelativePath(document.uri)
    let filepathWithAt = `@${relativePath}`

    // Check if there's a selection and add line numbers
    const selection = activeEditor.selection
    if (!selection.isEmpty) {
      // Convert to 1-based line numbers
      const startLine = selection.start.line + 1
      const endLine = selection.end.line + 1

      if (startLine === endLine) {
        // Single line selection
        filepathWithAt += `#L${startLine}`
      } else {
        // Multi-line selection
        filepathWithAt += `#L${startLine}-${endLine}`
      }
    }

    return filepathWithAt
  }
}
