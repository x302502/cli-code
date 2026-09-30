export type SessionSummary = {
  toolId: string
  sessionId: string
  title: string
  cwd?: string
  updatedAt: number
  /** Path of the file the summary came from — shown as detail, useful for debugging. */
  source: string
}
export type ParseFallback = { sessionId: string; mtimeMs: number; source: string }
