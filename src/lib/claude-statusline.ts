import * as fs from "node:fs"
import * as path from "node:path"

// Claude runs this line for its statusLine in CLI Code's Claude tabs (passed with --settings, so
// nothing on disk changes). Outside CLI Code CLI_CODE_STATUSLINE is unset and it prints nothing.
export const STATUSLINE_COMMAND = '[ -n "$CLI_CODE_STATUSLINE" ] && eval "CLI_CODE_FROM=claude $CLI_CODE_STATUSLINE" || true'

const shellQuote = (s: string) => `'${s.replaceAll("'", `'\\''`)}'`

/** Appended to a Claude spawn command at spawn time only (never stored in the tab's command). */
export function statuslineSettingsArg(): string {
  return `--settings ${shellQuote(JSON.stringify({ statusLine: { type: "command", command: STATUSLINE_COMMAND } }))}`
}

function statusLineIn(file: string): string | undefined {
  try {
    const command = (JSON.parse(fs.readFileSync(file, "utf8")) as { statusLine?: { command?: unknown } }).statusLine?.command
    return typeof command === "string" && command.trim() ? command : undefined
  } catch {
    return undefined
  }
}

/** The statusLine the user would get without us, in Claude's settings precedence. */
export function resolveUserStatusLine(cwd: string, home: string): string | undefined {
  return (
    statusLineIn(path.join(cwd, ".claude", "settings.local.json")) ??
    statusLineIn(path.join(cwd, ".claude", "settings.json")) ??
    statusLineIn(path.join(home, ".claude", "settings.json"))
  )
}

export function isClaudeFamily(tool: { id: string; historyToolId?: string }): boolean {
  return (tool.historyToolId ?? tool.id) === "claude"
}
