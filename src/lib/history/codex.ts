import { formatPromptTitle } from "../tab-title.js"
import type { ParseFallback, SessionSummary } from "./types.js"

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
      const t = blocks.find((b) => b && typeof b === "object" && (b as { type?: unknown }).type === "input_text") as { text?: string } | undefined
      if (t?.text) first = t.text
    }
    if (id && first) break
  }
  if (!id && !first) return undefined
  return { toolId: "codex", sessionId: id ?? fallback.sessionId, title: formatPromptTitle(first ?? "") || "(no title)", cwd, updatedAt: fallback.mtimeMs, source: fallback.source }
}
