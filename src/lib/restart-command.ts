import type { CliTool } from "./config.js"
import type { SessionSummary } from "./history/types.js"

/** What a session id may look like: it is spliced into a shell command line. */
export const SAFE_ID = /^[\w.-]+$/

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
  /** Other open tabs of the same CLI in the same folder, with their conversation when known. */
  siblings?: { sessionId?: string }[]
}): string {
  const { tool, baseCommand, spawnedAt } = args
  const siblings = args.siblings ?? []
  const safe = (id: string | undefined) => (id && SAFE_ID.test(id) ? id : undefined)
  // What the CLI reported wins even over a pinned --resume: the user may have switched
  // conversations inside the CLI (/clear, /resume) since the tab was opened.
  const reported = safe(args.reportedSessionId)
  if (tool.resumeCommand && reported) return tool.resumeCommand.replace("{sessionId}", reported)
  // A tab opened from history by id already resumes; keep that.
  if (tool.resumeCommand && matchesTemplate(baseCommand, tool.resumeCommand)) return baseCommand

  // Everything below guesses "the newest conversation in this folder". With another tab of the
  // same CLI here whose conversation is unknown, that newest one may well be the sibling's —
  // restarting into it would take over the other tab's work. A fresh session is the safe
  // answer then (and --continue is the same guess, so it is skipped too — also for a tab opened
  // with --continue, which names no fixed conversation either).
  const fresh = tool.continueCommand && baseCommand === tool.continueCommand ? tool.command : baseCommand
  if (siblings.some((t) => !t.sessionId)) return fresh
  const claimed = new Set(siblings.map((t) => t.sessionId))
  if (tool.resumeCommand) {
    const located = safe(args.locatedSessionId)
    // The store names only its newest session; if a sibling owns it, this tab's is unknown.
    if (located && claimed.has(located)) return fresh
    const id =
      located ??
      args.sessions
        .filter((s) => s.toolId === (tool.historyToolId ?? tool.id) && s.updatedAt >= spawnedAt && SAFE_ID.test(s.sessionId) && !claimed.has(s.sessionId))
        .sort((a, b) => b.updatedAt - a.updatedAt)[0]?.sessionId
    if (id) return tool.resumeCommand.replace("{sessionId}", id)
  }
  if (tool.continueCommand && siblings.length === 0) return tool.continueCommand
  return fresh
}

/** Whether `command` carries on an existing conversation (resume by id, or --continue) rather
 * than starting a new one — so what named the old one (its first prompt) still names it. */
export function resumesConversation(tool: CliTool, command: string): boolean {
  return (tool.resumeCommand !== undefined && matchesTemplate(command, tool.resumeCommand)) || (tool.continueCommand !== undefined && command === tool.continueCommand)
}

/** The session id in a command built from `template` (a tab opened or restarted by id). */
export function sessionIdFromCommand(command: string, template: string): string | undefined {
  const [before, after] = template.split("{sessionId}")
  if (after === undefined || !matchesTemplate(command, template)) return undefined
  const id = command.slice(before!.length, command.length - after.length)
  return SAFE_ID.test(id) ? id : undefined
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
