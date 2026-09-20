import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { encodeClaudeProjectDir, parseClaudeSession } from "./claude.js"
import { parseCodexRollout } from "./codex.js"
import { parseGrokSession } from "./grok.js"
import type { SessionSummary } from "./types.js"

const HEAD_BYTES = 64 * 1024

/** First 64 KB of a file — enough for session meta and the first prompt, cheap on huge transcripts. */
function head(file: string): string {
  const fd = fs.openSync(file, "r")
  try {
    const buf = Buffer.alloc(HEAD_BYTES)
    const n = fs.readSync(fd, buf, 0, HEAD_BYTES, 0)
    return buf.subarray(0, n).toString("utf8")
  } finally {
    fs.closeSync(fd)
  }
}

/** mtime of a file, or undefined if it was removed since it was listed. */
function safeMtimeMs(file: string): number | undefined {
  try {
    return fs.statSync(file).mtimeMs
  } catch {
    return undefined
  }
}

function newestFiles(dir: string, filter: (name: string) => boolean, limit: number, recursive: boolean): string[] {
  if (!fs.existsSync(dir)) return []
  const walk = (d: string, out: string[]) => {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) {
        if (recursive) walk(p, out)
      } else if (filter(e.name)) out.push(p)
    }
  }
  const files: string[] = []
  walk(dir, files)
  return files
    .map((f) => ({ f, m: safeMtimeMs(f) }))
    .filter((x): x is { f: string; m: number } => x.m !== undefined)
    .sort((a, b) => b.m - a.m)
    .slice(0, limit)
    .map((x) => x.f)
}

function claudeSessions(cwd: string, limit: number): SessionSummary[] {
  return claudeSessionsInDir(path.join(os.homedir(), ".claude", "projects", encodeClaudeProjectDir(cwd)), limit)
}

/** Top-level `*.jsonl` only: sub-agent transcripts live in `<sessionId>/subagents/agent-*.jsonl`
 * under the project dir and are not resumable sessions. */
export function claudeSessionsInDir(dir: string, limit: number): SessionSummary[] {
  return newestFiles(dir, (n) => n.endsWith(".jsonl"), limit, false).flatMap((f) => {
    const m = safeMtimeMs(f)
    if (m === undefined) return []
    let text: string
    try {
      text = head(f)
    } catch {
      return []
    }
    const s = parseClaudeSession(text, { sessionId: path.basename(f, ".jsonl"), mtimeMs: m, source: f })
    return s ? [s] : []
  })
}

export function codexSessions(cwd: string, limit: number): SessionSummary[] {
  const dir = path.join(process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex"), "sessions")
  return newestFiles(dir, (n) => n.startsWith("rollout-") && n.endsWith(".jsonl"), limit, true).flatMap((f) => {
    const m = safeMtimeMs(f)
    if (m === undefined) return []
    let text: string
    try {
      text = head(f)
    } catch {
      return []
    }
    const s = parseCodexRollout(text, { sessionId: path.basename(f, ".jsonl"), mtimeMs: m, source: f })
    return s && s.cwd === cwd ? [s] : []
  })
}

export function grokSessions(cwd: string, limit: number): SessionSummary[] {
  const dir = path.join(process.env.GROK_HOME ?? path.join(os.homedir(), ".grok"), "sessions", encodeURIComponent(cwd))
  if (!fs.existsSync(dir)) return []
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => path.join(dir, e.name))
    .map((d) => ({ d, m: safeMtimeMs(d) }))
    .filter((x): x is { d: string; m: number } => x.m !== undefined)
    .sort((a, b) => b.m - a.m)
    .slice(0, limit)
    .flatMap(({ d, m }) => {
      const summary = path.join(d, "summary.json")
      const chat = path.join(d, "chat_history.jsonl")
      let summaryText: string | undefined
      let chatText: string | undefined
      try {
        summaryText = fs.existsSync(summary) ? fs.readFileSync(summary, "utf8") : undefined
      } catch {
        summaryText = undefined
      }
      try {
        chatText = fs.existsSync(chat) ? head(chat) : undefined
      } catch {
        chatText = undefined
      }
      const s = parseGrokSession(summaryText, chatText, { sessionId: path.basename(d), mtimeMs: m, source: d })
      return s ? [{ ...s, cwd }] : []
    })
}

export async function listSessionsForWorkspace(cwd: string, limit = 200): Promise<SessionSummary[]> {
  const all = [...claudeSessions(cwd, limit), ...codexSessions(cwd, limit), ...grokSessions(cwd, limit)]
  return all.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit)
}
