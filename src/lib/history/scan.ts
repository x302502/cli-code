import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { samePath } from "../same-path.js"
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

function claudeSessions(cwd: string, limit: number, sinceMs?: number): SessionSummary[] {
  return claudeSessionsInDir(path.join(os.homedir(), ".claude", "projects", encodeClaudeProjectDir(cwd)), limit, cwd, sinceMs)
}

/**
 * Top-level `*.jsonl` only: sub-agent transcripts live in `<sessionId>/subagents/agent-*.jsonl`
 * under the project dir and are not resumable sessions. With `cwd`, only transcripts that record
 * that very cwd count: Claude's folder name maps every non-alphanumeric to "-", so
 * /work/foo-bar and /work/foo/bar share a folder. A transcript without a cwd cannot be
 * attributed and is left out. Filtering happens before the limit.
 */
export function claudeSessionsInDir(dir: string, limit: number, cwd?: string, sinceMs?: number): SessionSummary[] {
  const out: SessionSummary[] = []
  for (const f of newestFiles(dir, (n) => n.endsWith(".jsonl"), cwd === undefined ? limit : Infinity, false)) {
    if (out.length >= limit) break
    const m = safeMtimeMs(f)
    if (m === undefined) continue
    // Newest first: once one is older than `sinceMs`, so are the rest — their heads go unread.
    if (sinceMs !== undefined && m < sinceMs) break
    let text: string
    try {
      text = head(f)
    } catch {
      continue
    }
    const s = parseClaudeSession(text, { sessionId: path.basename(f, ".jsonl"), mtimeMs: m, source: f })
    if (!s) continue
    if (cwd !== undefined && (!s.cwd || !samePath(s.cwd, cwd))) continue
    out.push(s)
  }
  return out
}

/**
 * With `sinceMs` (a tab's spawn time) only the day folders from that day on are walked:
 * Codex files each rollout under sessions/YYYY/MM/DD of its start, so a tab's own rollout
 * cannot be anywhere older — and the model pill asks every few seconds, which must not stat
 * a whole long history each time.
 */
export function codexSessions(cwd: string, limit: number, sinceMs?: number): SessionSummary[] {
  const dir = path.join(process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex"), "sessions")
  const isRollout = (n: string) => n.startsWith("rollout-") && n.endsWith(".jsonl")
  const files =
    sinceMs === undefined
      ? newestFiles(dir, isRollout, Infinity, true)
      : daysSince(sinceMs)
          .flatMap((d) => newestFiles(path.join(dir, d), isRollout, Infinity, false))
          .map((f) => ({ f, m: safeMtimeMs(f) ?? 0 }))
          .filter((x) => x.m >= sinceMs)
          .sort((a, b) => b.m - a.m)
          .map((x) => x.f)
  // Codex keeps every project's rollouts in one tree: walk it newest first and keep this
  // workspace's until `limit` — a limit applied before filtering let newer sessions of other
  // projects push all of this one's out.
  const out: SessionSummary[] = []
  for (const f of files) {
    if (out.length >= limit) break
    const m = safeMtimeMs(f)
    if (m === undefined) continue
    let text: string
    try {
      text = head(f)
    } catch {
      continue
    }
    const s = parseCodexRollout(text, { sessionId: path.basename(f, ".jsonl"), mtimeMs: m, source: f })
    if (s?.cwd && samePath(s.cwd, cwd)) out.push(s)
  }
  return out
}

/** `YYYY/MM/DD` folder names from the day before `sinceMs` (time zones) through tomorrow. */
function daysSince(sinceMs: number): string[] {
  const pad = (n: number) => String(n).padStart(2, "0")
  const out: string[] = []
  const day = new Date(sinceMs - 86_400_000)
  day.setHours(0, 0, 0, 0)
  const end = Date.now() + 86_400_000
  for (let i = 0; day.getTime() <= end && i < 400; i++) {
    out.push(path.join(String(day.getFullYear()), pad(day.getMonth() + 1), pad(day.getDate())))
    day.setDate(day.getDate() + 1)
  }
  return out
}

export function grokSessions(cwd: string, limit: number, sinceMs = 0): SessionSummary[] {
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
    .filter((x): x is { d: string; m: number } => x.m !== undefined && x.m >= sinceMs)
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

export async function listSessionsForWorkspace(cwd: string, limit = 200, sinceMs?: number): Promise<SessionSummary[]> {
  // `sinceMs` (a restarting tab's spawn time): older sessions cannot be the tab's, so their
  // transcripts are not read at all.
  const all = [...claudeSessions(cwd, limit, sinceMs), ...codexSessions(cwd, limit, sinceMs), ...grokSessions(cwd, limit, sinceMs)]
  return all.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit)
}
