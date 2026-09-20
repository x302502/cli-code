import * as fs from "node:fs"
import * as path from "node:path"
import { encodeClaudeProjectDir } from "./claude.js"
import { locateLatestSessionFile, openDb } from "./locate.js"
import { codexSessions, grokSessions } from "./scan.js"

// The model id shows up under a handful of spellings across CLIs' transcripts; the latest
// occurrence in the file is the model in play (Pi/OMP log a model_change on /model).
const MODEL_RE = /"(?:model|modelId|model_id|modelID)"\s*:\s*"([^"]*)"/g

/** Last non-placeholder model id in a chunk of transcript text. */
export function modelFromText(text: string): string | undefined {
  let last: string | undefined
  for (const m of text.matchAll(MODEL_RE)) {
    const v = m[1]!.trim()
    if (v && !v.startsWith("<")) last = v
  }
  return last
}

const CHUNK = 64 * 1024

/** Head and tail of a transcript — model records sit at the start (session setup) and in
 * every assistant turn, so both ends together cover long sessions cheaply. */
function modelFromFile(file: string): string | undefined {
  let fd: number
  try {
    fd = fs.openSync(file, "r")
  } catch {
    return undefined
  }
  try {
    const size = fs.fstatSync(fd).size
    const headBuf = Buffer.alloc(Math.min(CHUNK, size))
    fs.readSync(fd, headBuf, 0, headBuf.length, 0)
    let text = headBuf.toString("utf8")
    if (size > CHUNK) {
      const tailBuf = Buffer.alloc(CHUNK)
      fs.readSync(fd, tailBuf, 0, CHUNK, size - CHUNK)
      text += "\n" + tailBuf.toString("utf8")
    }
    return modelFromText(text)
  } finally {
    fs.closeSync(fd)
  }
}

/**
 * The model a tab's CLI is currently using, read from that CLI's own session store for the
 * tab's directory (the session started at/after `sinceMs`, or `sessionId` when known).
 * Best effort and read-only: unknown CLI, missing store or schema surprise → undefined.
 */
export function detectModel(toolId: string, cwd: string, sinceMs: number, home: string, sessionId?: string): string | undefined {
  try {
    switch (toolId) {
      case "claude":
      case "claude-agent-teams": {
        const dir = path.join(home, ".claude", "projects", encodeClaudeProjectDir(cwd))
        if (sessionId) return modelFromFile(path.join(dir, `${sessionId}.jsonl`))
        const file = newestJsonl(dir, sinceMs)
        return file ? modelFromFile(file) : undefined
      }
      case "codex": {
        const s = codexSessions(cwd, 50).find((x) => x.updatedAt >= sinceMs)
        return s ? modelFromFile(s.source) : undefined
      }
      case "grok": {
        const s = grokSessions(cwd, 50).find((x) => x.updatedAt >= sinceMs)
        return s ? modelFromFile(path.join(s.source, "chat_history.jsonl")) : undefined
      }
      case "opencode":
      case "mimo":
      case "kilo": {
        const db = { opencode: "opencode/opencode.db", mimo: "mimocode/mimocode.db", kilo: "kilo/kilo.db" }[toolId]!
        return modelFromOpencodeDb(path.join(home, ".local", "share", db), cwd, sinceMs)
      }
      default: {
        const file = locateLatestSessionFile(toolId, cwd, sinceMs, home)
        return file ? modelFromFile(file) : undefined
      }
    }
  } catch {
    return undefined
  }
}

function newestJsonl(dir: string, sinceMs: number): string | undefined {
  if (!fs.existsSync(dir)) return undefined
  let best: { f: string; m: number } | undefined
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".jsonl")) continue
    const f = path.join(dir, name)
    let m: number
    try {
      m = fs.statSync(f).mtimeMs
    } catch {
      continue
    }
    if (m >= sinceMs && (!best || m > best.m)) best = { f, m }
  }
  return best?.f
}

/** opencode and forks: the newest assistant message of the newest session for `cwd`. */
function modelFromOpencodeDb(file: string, cwd: string, sinceMs: number): string | undefined {
  const db = openDb(file)
  if (!db) return undefined
  try {
    const session = db.prepare("SELECT id FROM session WHERE directory = ? AND time_updated >= ? ORDER BY time_updated DESC LIMIT 1").get(cwd, sinceMs)
    if (!session || typeof session.id !== "string") return undefined
    const row = db.prepare("SELECT data FROM message WHERE session_id = ? AND data LIKE '%\"modelID\"%' ORDER BY time_created DESC LIMIT 1").get(session.id)
    return typeof row?.data === "string" ? modelFromText(row.data) : undefined
  } finally {
    db.close()
  }
}
