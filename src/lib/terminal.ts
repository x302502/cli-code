import * as vscode from "vscode"
import { CLI_TOOLS, type CliTool } from "./config.js"
import { getActiveFileReference } from "./editor.js"
import { appendPrompt, waitForHttpServer } from "./http-client.js"

const MIN_PORT = 16384
const MAX_PORT = 65535

/** Prompts the user to choose a CLI tool from the configured list. */
export async function pickTool(): Promise<CliTool | undefined> {
  const picked = await vscode.window.showQuickPick(
    CLI_TOOLS.map((t) => ({ label: t.label, description: t.description, id: t.id })),
    { placeHolder: "Select a CLI to open" },
  )
  if (!picked) return
  return CLI_TOOLS.find((t) => t.id === picked.id)
}

/** The terminal tab name for a tool: its emoji followed by its label. */
export function terminalName(tool: CliTool): string {
  return `${tool.emoji} ${tool.label}`
}

/** Finds the CLI tool a terminal was opened for, based on its name. */
export function findToolForTerminal(terminal: vscode.Terminal): CliTool | undefined {
  return CLI_TOOLS.find((t) => terminalName(t) === terminal.name)
}

/** Returns an already-open terminal for the given tool, if one exists. */
export function findExistingTerminal(tool: CliTool): vscode.Terminal | undefined {
  return vscode.window.terminals.find((t) => t.name === terminalName(tool))
}

/** Opens a new terminal running the tool's command, beside the active editor. */
export async function openTerminal(context: vscode.ExtensionContext, tool: CliTool) {
  const port = tool.hasHttpApi ? randomPort() : undefined

  const terminal = vscode.window.createTerminal({
    name: terminalName(tool),
    iconPath: {
      light: vscode.Uri.file(context.asAbsolutePath("images/button-dark.svg")),
      dark: vscode.Uri.file(context.asAbsolutePath("images/button-light.svg")),
    },
    location: {
      viewColumn: vscode.ViewColumn.Beside,
      preserveFocus: false,
    },
    env: buildEnv(tool, port),
  })

  terminal.show()
  terminal.sendText(port ? tool.command.replace("{port}", port.toString()) : tool.command)

  await seedActiveFile(terminal, tool, port)
}

/** Reads the port a terminal was launched with from its environment. */
export function readTerminalPort(terminal: vscode.Terminal, portEnvVar: string): number | undefined {
  const options = terminal.creationOptions
  if (!("env" in options)) return
  const port = options.env?.[portEnvVar]
  return port ? parseInt(port, 10) : undefined
}

/** Builds the environment variables a terminal should launch with for a tool. */
export function buildEnv(tool: CliTool, port: number | undefined): Record<string, string> {
  const env: Record<string, string> = { ...tool.extraEnv }
  if (port && tool.portEnvVar) {
    env[tool.portEnvVar] = port.toString()
  }
  return env
}

/** After launch, waits for an HTTP-aware CLI to be ready and sends the active file. */
async function seedActiveFile(terminal: vscode.Terminal, tool: CliTool, port: number | undefined) {
  const fileRef = getActiveFileReference()
  if (!fileRef) return

  if (!(tool.hasHttpApi && port && tool.readyCheckPath && tool.appendPromptPath)) return

  const ready = await waitForHttpServer(port, tool.readyCheckPath)
  if (ready) {
    await appendPrompt(port, tool.appendPromptPath, `In ${fileRef}`)
    terminal.show()
  }
}

/** Generates a random port within the ephemeral range used for HTTP-aware CLIs. */
export function randomPort(): number {
  return Math.floor(Math.random() * (MAX_PORT - MIN_PORT + 1)) + MIN_PORT
}
