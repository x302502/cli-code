import type { CliTool } from "./config.js"
import type { SessionSummary } from "./history/types.js"

const SAFE_ID = /^[\w.-]+$/

/**
 * The command a restarted tab should run so it lands back in the same conversation:
 * the CLI's resume command with the session id (reported by its hook, located in its own
 * store, or the newest transcript it wrote since the tab was spawned), its continue command
 * when it cannot address sessions by id, or the original command when nothing better is known.
 */
export function restartCommand(args: {
  tool: CliTool
  baseCommand: string
  /** The CLI's own report of its current session (Claude's hook): authoritative. */
  reportedSessionId?: string
  /** The newest session in the CLI's store since the tab was spawned: a guess. */
  locatedSessionId?: string
  sessions: SessionSummary[]
  spawnedAt: number
}): string {
  const { tool, baseCommand, spawnedAt } = args
  const safe = (id: string | undefined) => (id && SAFE_ID.test(id) ? id : undefined)
  // What the CLI reported wins even over a pinned --resume: the user may have switched
  // conversations inside the CLI (/clear, /resume) since the tab was opened.
  const reported = safe(args.reportedSessionId)
  if (tool.resumeCommand && reported) return tool.resumeCommand.replace("{sessionId}", reported)
  // A tab opened from history already resumes/continues; keep that.
  if (tool.resumeCommand && matchesTemplate(baseCommand, tool.resumeCommand)) return baseCommand
  if (tool.continueCommand && baseCommand === tool.continueCommand) return baseCommand

  if (tool.resumeCommand) {
    const id =
      safe(args.locatedSessionId) ??
      args.sessions
        .filter((s) => s.toolId === (tool.historyToolId ?? tool.id) && s.updatedAt >= spawnedAt && SAFE_ID.test(s.sessionId))
        .sort((a, b) => b.updatedAt - a.updatedAt)[0]?.sessionId
    if (id) return tool.resumeCommand.replace("{sessionId}", id)
  }
  if (tool.continueCommand) return tool.continueCommand
  return baseCommand
}

/** Whether `command` is `template` with `{sessionId}` filled in. */
function matchesTemplate(command: string, template: string): boolean {
  const [before, after] = template.split("{sessionId}")
  if (after === undefined) return command === template
  return command.startsWith(before!) && command.endsWith(after) && command.length > before!.length + after.length
}

/**
 * "Continue latest session" for the resume picker: the folder's newest session by id when
 * the CLI's own store named one (right folder, and the only option for CLIs such as Cline
 * that have no --continue), else the CLI's continue command, else nothing.
 */
export function continueLatestCommand(tool: CliTool, locatedId: string | undefined): string | undefined {
  if (tool.resumeCommand && locatedId && SAFE_ID.test(locatedId)) return tool.resumeCommand.replace("{sessionId}", locatedId)
  return tool.continueCommand
}
