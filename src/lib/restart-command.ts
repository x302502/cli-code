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
        .filter((s) => s.toolId === tool.id && s.updatedAt >= spawnedAt && SAFE_ID.test(s.sessionId))
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
