import type { CliTool } from "./config.js"
import type { SessionSummary } from "./history/types.js"

const SAFE_ID = /^[\w.-]+$/

/**
 * The command a restarted tab should run so it lands back in the same conversation:
 * the CLI's resume command with the session id (reported by its hook, or the newest
 * transcript it wrote since the tab was spawned), its continue command when it cannot
 * address sessions by id, or the original command when nothing better is known.
 */
export function restartCommand(args: {
  tool: CliTool
  baseCommand: string
  cliSessionId?: string
  sessions: SessionSummary[]
  spawnedAt: number
}): string {
  const { tool, baseCommand, spawnedAt } = args
  // A tab opened from history already resumes/continues; keep that.
  if (tool.resumeCommand && matchesTemplate(baseCommand, tool.resumeCommand)) return baseCommand
  if (tool.continueCommand && baseCommand === tool.continueCommand) return baseCommand

  if (tool.resumeCommand) {
    const id =
      (args.cliSessionId && SAFE_ID.test(args.cliSessionId) ? args.cliSessionId : undefined) ??
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
