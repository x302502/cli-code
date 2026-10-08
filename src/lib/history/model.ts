import * as fs from "node:fs"
import * as path from "node:path"
import { encodeClaudeProjectDir } from "./claude.js"
import { locateLatestSession, locateLatestSessionFile, openDb, sessionFileHasId } from "./locate.js"
import { head, newestFiles, tail } from "./files.js"
import { codexRolloutById, codexSessions, grokSessions } from "./scan.js"

// The model id shows up under a handful of spellings across CLIs' transcripts; the latest
// occurrence in the file is the model in play (Pi/OMP log a model_change on /model).
const MODEL_RE = /(?:"provider"\s*:\s*"([^"]*)"\s*,\s*)?"(?:model|modelId|model_id|modelID)"\s*:\s*"([^"]*)"/g

/** Last non-placeholder model id in a chunk of transcript text. With `withProvider`, a model written
 * right after its provider reads "provider/model" (Pi/OMP/Cline name models that way). */
export function modelFromText(text: string, withProvider = false): string | undefined {
  let last: string | undefined
  for (const m of text.matchAll(MODEL_RE)) {
    const v = m[2]!.trim()
    if (v && !v.startsWith("<")) last = withProvider && m[1] && !v.startsWith(`${m[1]}/`) ? `${m[1]}/${v}` : v
  }
  return last
}

const PROVIDER_PREFIXED = new Set(["omp", "pi", "cline"])
const CHUNK = 64 * 1024
// Codex rollout file per (cwd, tab spawn time); see the codex case below. Bounded because a
// restart adds an entry that is never asked for again and the window may live for days.
const CODEX_ROLLOUT_CACHE = 32
const claudeTranscripts = new Map<string, string>()
const codexRollouts = new Map<string, string>()

/** Head and tail of a transcript — model records sit at the start (session setup) and in
 * every assistant turn, so both ends together cover long sessions cheaply. */
function modelFromFile(file: string, withProvider = false): string | undefined {
  try {
    const start = head(file, CHUNK)
    return modelFromText(fs.statSync(file).size > CHUNK ? `${start}\n${tail(file, CHUNK)}` : start, withProvider)
  } catch {
    return undefined
  }
}

/**
 * The model a tab's CLI is currently using, read from that CLI's own session store for the
 * tab's directory (the session started at/after `sinceMs`, or `sessionId` when known).
 * Best effort and read-only: unknown CLI, missing store or schema surprise → undefined.
 */
export function detectModel(toolId: string, cwd: string, sinceMs: number, home: string, sessionId?: string, sessionFile?: string): string | undefined {
  try {
    if (sessionFile && sessionId && (toolId === "omp" || toolId === "pi")) {
      return sessionFileHasId(sessionFile, sessionId) ? modelFromFile(sessionFile, true) : undefined
    }
    switch (toolId) {
      case "claude":
      case "claude-agent-teams": {
        const dir = path.join(home, ".claude", "projects", encodeClaudeProjectDir(cwd))
        if (sessionId) return modelFromFile(path.join(dir, `${sessionId}.jsonl`))
        // The transcript a tab writes does not move once found: remember it, so the refresh (every
        // hook event and 30 s) stops stat'ing every transcript in a long-lived project folder.
        const key = `${dir}\0${sinceMs}`
        let file = claudeTranscripts.get(key)
        if (!file || !fs.existsSync(file)) {
          file = newestFiles(dir, (n) => n.endsWith(".jsonl"), { sinceMs, limit: 1 })[0]
          if (file) {
            claudeTranscripts.set(key, file)
            if (claudeTranscripts.size > CODEX_ROLLOUT_CACHE) claudeTranscripts.delete(claudeTranscripts.keys().next().value!)
          }
        }
        return file ? modelFromFile(file) : undefined
      }
      case "codex": {
        // The hook's session id names the rollout wherever it is filed (a resumed session stays
        // under the day it began); without one only the day folders since the spawn are walked.
        // A tab's rollout file never moves once found, so remember it and only look again until
        // there is one.
        const key = sessionId ?? `${cwd}\0${sinceMs}`
        let file = codexRollouts.get(key)
        if (!file || !fs.existsSync(file)) {
          file = sessionId ? codexRolloutById(sessionId) : codexSessions(cwd, 1, sinceMs)[0]?.source
          if (file) {
            codexRollouts.set(key, file)
            // Map iterates in insertion order, so the first key is the oldest.
            if (codexRollouts.size > CODEX_ROLLOUT_CACHE) codexRollouts.delete(codexRollouts.keys().next().value!)
          }
        }
        return file ? modelFromFile(file) : undefined
      }
      case "grok": {
        // Newest session dir only: parsing more to pick one would be wasted on every refresh.
        const s = grokSessions(cwd, 1).find((x) => x.updatedAt >= sinceMs)
        return s ? modelFromFile(path.join(s.source, "chat_history.jsonl")) : undefined
      }
      case "opencode":
      case "mimo":
      case "kilo": {
        const db = { opencode: "opencode/opencode.db", mimo: "mimocode/mimocode.db", kilo: "kilo/kilo.db" }[toolId]!
        return modelFromOpencodeDb(path.join(home, ".local", "share", db), cwd, sinceMs, sessionId)
      }
      case "copilot": {
        const id = sessionId ?? locateLatestSession("copilot", cwd, sinceMs, home)
        return id ? modelFromCopilotDb(path.join(home, ".copilot", "session-store.db"), id) : undefined
      }
      default: {
        const file = locateLatestSessionFile(toolId, cwd, sinceMs, home, sessionId)
        return file ? modelFromFile(file, PROVIDER_PREFIXED.has(toolId)) : undefined
      }
    }
  } catch {
    return undefined
  }
}

/** opencode and forks: the newest assistant message of the newest session for `cwd`. */
function modelFromOpencodeDb(file: string, cwd: string, sinceMs: number, sessionId?: string): string | undefined {
  const db = openDb(file)
  if (!db) return undefined
  try {
    // The tab's own session (reported by its hook) wins; the folder's newest is only a fallback.
    const session = sessionId ? { id: sessionId } : db.prepare("SELECT id FROM session WHERE directory = ? AND parent_id IS NULL AND time_updated >= ? ORDER BY time_updated DESC LIMIT 1").get(cwd, sinceMs)
    if (!session || typeof session.id !== "string") return undefined
    const row = db.prepare("SELECT data FROM message WHERE session_id = ? AND data LIKE '%\"modelID\"%' ORDER BY time_created DESC LIMIT 1").get(session.id)
    return typeof row?.data === "string" ? modelFromText(row.data) : undefined
  } finally {
    db.close()
  }
}

/** Copilot logs every assistant turn's model in session-store.db; the newest row is the model in play. */
function modelFromCopilotDb(file: string, sessionId: string): string | undefined {
  const db = openDb(file)
  if (!db) return undefined
  try {
    const row = db.prepare("SELECT model FROM assistant_usage_events WHERE session_id = ? ORDER BY id DESC LIMIT 1").get(sessionId)
    return typeof row?.model === "string" && row.model ? row.model : undefined
  } finally {
    db.close()
  }
}
