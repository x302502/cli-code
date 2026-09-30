import { formatPromptTitle } from "../tab-title.js"
import type { ParseFallback, SessionSummary } from "./types.js"

export function parseGrokSession(summaryJson: string | undefined, chatText: string | undefined, fallback: ParseFallback): SessionSummary | undefined {
  let title: string | undefined
  if (summaryJson) {
    try {
      const s = JSON.parse(summaryJson) as { title?: unknown }
      if (typeof s.title === "string" && s.title.trim()) title = s.title.trim()
    } catch { /* fall through to chat history */ }
  }
  if (!title && chatText) {
    for (const line of chatText.split("\n")) {
      let rec: { type?: unknown; content?: unknown }
      try { rec = JSON.parse(line) } catch { continue }
      if (rec.type === "user" && typeof rec.content === "string") {
        // Grok wraps the typed text in <user_query>…</user_query>.
        const m = /<user_query>([\s\S]*?)<\/user_query>/.exec(rec.content)
        title = formatPromptTitle((m ? m[1] : rec.content).trim())
        if (title) break
      }
    }
  }
  if (!title) return undefined
  return { toolId: "grok", sessionId: fallback.sessionId, title, updatedAt: fallback.mtimeMs, source: fallback.source }
}
