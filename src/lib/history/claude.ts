import { formatPromptTitle } from "../tab-title.js"
import type { ParseFallback, SessionSummary } from "./types.js"

/** Claude keeps one dir per project: every non-alphanumeric char of the cwd becomes "-" (not collapsed). */
export function encodeClaudeProjectDir(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9]/g, "-")
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    return content.map((b) => (b && typeof b === "object" && typeof (b as { text?: unknown }).text === "string" ? (b as { text: string }).text : "")).join("")
  }
  return ""
}

export function parseClaudeSession(text: string, fallback: ParseFallback): SessionSummary | undefined {
  let custom: string | undefined
  let ai: string | undefined
  let firstPrompt: string | undefined
  let cwd: string | undefined
  let sessionId: string | undefined
  for (const line of text.split("\n")) {
    if (!line.trim()) continue
    let rec: Record<string, unknown>
    try { rec = JSON.parse(line) } catch { continue }
    if (rec.type === "custom-title" && typeof rec.customTitle === "string") custom = rec.customTitle
    else if (rec.type === "ai-title" && typeof rec.aiTitle === "string") ai = rec.aiTitle
    else if (rec.type === "user" && rec.isMeta !== true) {
      cwd ??= typeof rec.cwd === "string" ? rec.cwd : undefined
      sessionId ??= typeof rec.sessionId === "string" ? rec.sessionId : undefined
      const msg = (rec.message as { content?: unknown } | undefined)?.content
      const t = textOf(msg)
      if (!firstPrompt && t && !t.startsWith("<")) firstPrompt = t
    }
  }
  if (!firstPrompt && !custom && !ai) return undefined
  const title = custom ?? ai ?? formatPromptTitle(firstPrompt ?? "") ?? ""
  return { toolId: "claude", sessionId: sessionId ?? fallback.sessionId, title: title || "(no title)", cwd, updatedAt: fallback.mtimeMs, source: fallback.source }
}
