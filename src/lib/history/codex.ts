import { formatPromptTitle } from "../tab-title.js"
import type { ParseFallback, SessionSummary } from "./types.js"

/** Context Codex puts in a user message of its own before the first real prompt: the project's
 * AGENTS.md, and `<environment_context>`, `<permissions>`, `<collaboration_mode>`… blocks. As a
 * title it would name every session of the project the same. */
function isInjectedContext(text: string): boolean {
  const t = text.trimStart()
  return t.startsWith("# AGENTS.md instructions") || /^<[a-z_]+>/.test(t)
}

export function parseCodexRollout(text: string, fallback: ParseFallback): SessionSummary | undefined {
  let id: string | undefined
  let cwd: string | undefined
  let first: string | undefined
  for (const line of text.split("\n")) {
    if (!line.trim()) continue
    let rec: { type?: unknown; payload?: Record<string, unknown> }
    try { rec = JSON.parse(line) } catch { continue }
    const p = rec.payload ?? {}
    if (rec.type === "session_meta") {
      if (typeof p.id === "string") id = p.id
      if (typeof p.cwd === "string") cwd = p.cwd
    } else if (rec.type === "response_item" && p.type === "message" && p.role === "user" && !first) {
      const blocks = Array.isArray(p.content) ? p.content : []
      for (const b of blocks as { type?: unknown; text?: unknown }[]) {
        if (b?.type === "input_text" && typeof b.text === "string" && !isInjectedContext(b.text)) {
          first = b.text
          break
        }
      }
    }
    if (id && first) break
  }
  if (!id && !first) return undefined
  return { toolId: "codex", sessionId: id ?? fallback.sessionId, title: formatPromptTitle(first ?? "") || "(untitled)", cwd, updatedAt: fallback.mtimeMs, source: fallback.source }
}
