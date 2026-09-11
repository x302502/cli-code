import * as vscode from "vscode"
import { CLI_TOOLS, type CliTool } from "./config.js"
import { detectInstalled, extractBinary } from "./detect.js"
import { getActiveFileReference } from "./editor.js"
import { appendPrompt, waitForHttpServer } from "./http-client.js"

const MIN_PORT = 16384
const MAX_PORT = 65535

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
  quickPick.show()

  const binaries = CLI_TOOLS.map((t) => extractBinary(t.command))
  const installedMap = await detectInstalled(binaries)

  const installedItems: ToolPickItem[] = []
  const notInstalledItems: ToolPickItem[] = []

  for (const tool of CLI_TOOLS) {
    const binary = extractBinary(tool.command)
    const isInstalled = installedMap.get(binary) ?? false
    const item: ToolPickItem = {
      label: tool.label,
      description: isInstalled ? tool.description : "not installed",
      id: tool.id,
      iconPath: {
        light: vscode.Uri.file(context.asAbsolutePath(`images/agents-light/${tool.icon}`)),
        dark: vscode.Uri.file(context.asAbsolutePath(`images/agents-dark/${tool.icon}`)),
      },
    }
    if (isInstalled) installedItems.push(item)
    else notInstalledItems.push(item)
  }

  const separator = (label: string): vscode.QuickPickItem => ({ label, kind: vscode.QuickPickItemKind.Separator })
  const items: vscode.QuickPickItem[] = []
  if (installedItems.length > 0) items.push(separator("Installed"), ...installedItems)
  if (notInstalledItems.length > 0) items.push(separator("Not installed"), ...notInstalledItems)

  quickPick.placeholder = "Select a CLI to open"
  quickPick.busy = false
  quickPick.items = items

  return new Promise<CliTool | undefined>((resolve) => {
    let resolved = false

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
      resolved = true
      quickPick.hide()
      resolve(tool)
    })

    quickPick.onDidHide(() => {
      if (!resolved) resolve(undefined)
      quickPick.dispose()
    })
  })
}

/** The terminal tab name for a tool: just its label. The CLI's icon is shown on the tab. */
export function terminalName(tool: CliTool): string {
  return tool.label
}

/** Env var stamped on every CLI terminal so we can identify it after a reload
 *  even when VS Code renames the tab (e.g. "Claude Code" → "Claude"). */
export const TOOL_ID_ENV = "_CLI_CODE_TOOL_ID"

/**
 * Matches a terminal tab label against known CLI tools.
 * Handles exact labels, tool IDs, binary names, and dynamic title prefixes
 * (e.g. "Claude • Fix login bug", "Codex - Refactor auth", "Claude Code (2)").
 */
export function findToolByTabLabel(name: string | undefined): CliTool | undefined {
  if (!name) return undefined
  const clean = name.trim()
  if (!clean) return undefined
  const lower = clean.toLowerCase()

  // 1. Exact match on full label (case-insensitive)
  const exactLabel = CLI_TOOLS.find((t) => t.label.toLowerCase() === lower)
  if (exactLabel) return exactLabel

  // 2. Exact match on tool id
  const exactId = CLI_TOOLS.find((t) => t.id.toLowerCase() === lower)
  if (exactId) return exactId

  // 3. Exact match on extracted binary name
  const exactBin = CLI_TOOLS.find((t) => extractBinary(t.command).toLowerCase() === lower)
  if (exactBin) return exactBin

  // 4. Tab name starts with full tool label (e.g. "Claude Agent Teams • ...", "Claude Code • ...", "Claude Code (2)")
  // Sort by label length descending so specific tools match before generic ones
  const sortedByLabelLen = [...CLI_TOOLS].sort((a, b) => b.label.length - a.label.length)
  const labelPrefix = sortedByLabelLen.find(
    (t) =>
      lower.startsWith(t.label.toLowerCase() + " ") ||
      lower.startsWith(t.label.toLowerCase() + "•") ||
      lower.startsWith(t.label.toLowerCase() + ":") ||
      lower.startsWith(t.label.toLowerCase() + "-") ||
      lower.startsWith(t.label.toLowerCase() + "|") ||
      lower.startsWith(t.label.toLowerCase() + "("),
  )
  if (labelPrefix) return labelPrefix

  // 5. Tab name starts with tool id (e.g. "claude-agent-teams • ...", "claude • ...")
  const sortedByIdLen = [...CLI_TOOLS].sort((a, b) => b.id.length - a.id.length)
  const idPrefix = sortedByIdLen.find(
    (t) =>
      lower.startsWith(t.id.toLowerCase() + " ") ||
      lower.startsWith(t.id.toLowerCase() + "•") ||
      lower.startsWith(t.id.toLowerCase() + ":") ||
      lower.startsWith(t.id.toLowerCase() + "-") ||
      lower.startsWith(t.id.toLowerCase() + "|"),
  )
  if (idPrefix) return idPrefix

  // 6. Tab name starts with brand / binary in CLI_TOOLS order (e.g. "Claude • ...", "Codex • ...", "Antigravity • ...")
  for (const tool of CLI_TOOLS) {
    const bin = extractBinary(tool.command).toLowerCase()
    const firstWordOfLabel = tool.label.toLowerCase().split(/\s+/)[0]
    const prefixes = [bin, firstWordOfLabel].filter(Boolean)

    for (const prefix of prefixes) {
      if (
        lower === prefix ||
        lower.startsWith(prefix + " ") ||
        lower.startsWith(prefix + "•") ||
        lower.startsWith(prefix + ":") ||
        lower.startsWith(prefix + "-") ||
        lower.startsWith(prefix + "|")
      ) {
        return tool
      }
    }
  }

  return undefined
}

/** Finds the CLI tool a terminal was opened for, based on its env stamp, tab name, or dynamic prompt title. */
export function findToolForTerminal(terminal: vscode.Terminal): CliTool | undefined {
  const options = terminal.creationOptions as Record<string, unknown> | undefined
  const env = (options?.env ?? {}) as Record<string, string>
  const stampedId = env[TOOL_ID_ENV]
  if (stampedId) {
    const byId = CLI_TOOLS.find((t) => t.id === stampedId)
    if (byId) return byId
  }
  // Fallback: match by tab name (including dynamically renamed tabs).
  return findToolByTabLabel(terminal.name)
}

/** Returns an already-open terminal for the given tool, if one exists. */
export function findExistingTerminal(tool: CliTool): vscode.Terminal | undefined {
  return vscode.window.terminals.find((t) => findToolForTerminal(t)?.id === tool.id)
}

/**
 * Finds the editor column already hosting a CLI terminal tab, if any. New CLIs
 * open in that same column so they stack as tabs instead of splitting the editor
 * into a new group beside the existing one.
 */
export function findCliColumn(): vscode.ViewColumn | undefined {
  for (const group of vscode.window.tabGroups.all) {
    if (group.tabs.some(isCliTerminalTab)) return group.viewColumn
  }
  return undefined
}

/**
 * True if this tab hosts a CLI terminal — matched by its label, or (when the
 * CLI retitled the tab to something arbitrary, e.g. the current prompt) by a
 * live terminal with the same name carrying our env stamp.
 */
function isCliTerminalTab(tab: vscode.Tab): boolean {
  if (!(tab.input instanceof vscode.TabInputTerminal)) return false
  if (findToolByTabLabel(tab.label) !== undefined) return true
  return vscode.window.terminals.some((t) => t.name === tab.label && findToolForTerminal(t) !== undefined)
}

/** Opens a new terminal running the tool's command, as a tab beside the editor. */
export async function openTerminal(context: vscode.ExtensionContext, tool: CliTool) {
  const port = tool.hasHttpApi ? randomPort() : undefined

  const terminal = vscode.window.createTerminal({
    name: terminalName(tool),
    iconPath: {
      light: vscode.Uri.file(context.asAbsolutePath(`images/agents-light/${tool.icon}`)),
      dark: vscode.Uri.file(context.asAbsolutePath(`images/agents-dark/${tool.icon}`)),
    },
    location: {
      viewColumn: findCliColumn() ?? vscode.ViewColumn.Beside,
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
  const env: Record<string, string> = { ...tool.extraEnv, [TOOL_ID_ENV]: tool.id }
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
