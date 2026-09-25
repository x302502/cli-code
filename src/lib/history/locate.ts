import { createHash } from "node:crypto"
import * as fs from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url"
import { samePath } from "../same-path.js"
import { head, mtimeMs, newestFiles } from "./files.js"

// Session headers sit in the first lines; no need for the 64 KB the history list reads.
const HEAD_BYTES = 16 * 1024

/**
 * Finds the id of the session a CLI tab most likely owns: the newest session record that
 * CLI wrote for `cwd` at or after `sinceMs` (the tab's spawn time). Each CLI keeps its own
 * store — jsonl transcripts with a header line, per-session yaml/json, or SQLite — so
 * there is one small locator per format. Everything is best effort and read-only: any
 * missing directory, unreadable file or schema surprise just yields `undefined`.
 */
export function locateLatestSession(toolId: string, cwd: string, sinceMs: number, home: string): string | undefined {
  const locator = LOCATORS[toolId]
  if (!locator) return undefined
  try {
    return locator(path.resolve(cwd), sinceMs, home)
  } catch {
    return undefined
  }
}

type Locator = (cwd: string, sinceMs: number, home: string) => string | undefined

/**
 * Like locateLatestSession, but the path of the session's own file — for CLIs that keep one
 * jsonl/json per session; used to read the model in play. Undefined for SQLite/dir stores.
 */
export function locateLatestSessionFile(toolId: string, cwd: string, sinceMs: number, home: string, sessionId?: string): string | undefined {
  const root = FILE_ROOTS[toolId]
  if (!root) return undefined
  try {
    const dir = root(home)
    const c = path.resolve(cwd)
    return toolId === "cline" ? clineHit(dir, c, sinceMs, sessionId)?.file : jsonlHit(dir, c, sinceMs, sessionId)?.file
  } catch {
    return undefined
  }
}

const FILE_ROOTS: Record<string, (home: string) => string> = {
  pi: (h) => path.join(h, ".pi", "agent", "sessions"),
  omp: (h) => path.join(h, ".omp", "agent", "sessions"),
  "command-code": (h) => path.join(h, ".commandcode", "projects"),
  "prime-agent": (h) => path.join(h, ".prime", "agent", "sessions"),
  droid: (h) => path.join(h, ".factory", "sessions"),
  cline: (h) => path.join(h, ".cline", "data", "sessions"),
}

const LOCATORS: Record<string, Locator> = {
  // `{"type":"session","id":…,"cwd":…}` header line (pi, omp, command-code); omp may put a
  // title line first, so the first few lines are scanned.
  pi: (cwd, since, home) => jsonlHeader(path.join(home, ".pi", "agent", "sessions"), cwd, since),
  omp: (cwd, since, home) => jsonlHeader(path.join(home, ".omp", "agent", "sessions"), cwd, since),
  "command-code": (cwd, since, home) => jsonlHeader(path.join(home, ".commandcode", "projects"), cwd, since),
  "prime-agent": (cwd, since, home) => jsonlHeader(path.join(home, ".prime", "agent", "sessions"), cwd, since),
  // `{"type":"session_start","id":…,"cwd":…}`
  droid: (cwd, since, home) => jsonlHeader(path.join(home, ".factory", "sessions"), cwd, since),

  copilot: (cwd, since, home) => copilot(path.join(home, ".copilot", "session-state"), cwd, since),
  cline: (cwd, since, home) => cline(path.join(home, ".cline", "data", "sessions"), cwd, since),
  kimi: (cwd, since, home) => newestSubdir(path.join(home, ".kimi", "sessions", md5(cwd)), since),
  cursor: (cwd, since, home) =>
    newestSubdir(path.join(home, ".cursor", "projects", cwd.replace(/^[/\\]/, "").replace(/[/\\]/g, "-"), "agent-transcripts"), since),
  amp: (cwd, since, home) => amp(path.join(home, ".local", "share", "amp", "threads"), cwd, since),

  antigravity: (cwd, since, home) => antigravity(path.join(home, ".gemini", "antigravity-cli"), cwd, since),

  opencode: (cwd, since, home) => opencodeDb(path.join(home, ".local", "share", "opencode", "opencode.db"), cwd, since),
  mimo: (cwd, since, home) => opencodeDb(path.join(home, ".local", "share", "mimocode", "mimocode.db"), cwd, since),
  kilo: (cwd, since, home) => opencodeDb(path.join(home, ".local", "share", "kilo", "kilo.db"), cwd, since),
  goose: (cwd, since, home) => gooseDb(path.join(home, ".local", "share", "goose", "sessions", "sessions.db"), cwd, since),
}

function sameDir(a: string, b: string): boolean {
  return samePath(a, b)
}

/** Antigravity (`agy`) keeps `cache/last_conversations.json` (cwd → newest conversation id)
 * next to one SQLite file per conversation; that file's mtime says whether it is this tab's.
 * (`cache/conversation_metadata.json` exists too but lags and often lacks the workspace.) */
function antigravity(root: string, cwd: string, since: number): string | undefined {
  const index = path.join(root, "cache", "last_conversations.json")
  if (!fs.existsSync(index)) return undefined
  const map = JSON.parse(fs.readFileSync(index, "utf8")) as Record<string, string>
  const id = Object.entries(map).find(([dir]) => sameDir(dir, cwd))?.[1]
  if (!id) return undefined
  const m = mtimeMs(path.join(root, "conversations", `${id}.db`))
  return m !== undefined && m >= since ? id : undefined
}

function jsonlHeader(root: string, cwd: string, since: number): string | undefined {
  return jsonlHit(root, cwd, since)?.id
}

/**
 * Session files to look at: those modified since `since`, newest first — or, for a known
 * `sessionId`, first the files named after it at any age (pi, omp, droid and cline put the id in
 * the file name; a session resumed in this tab may not have been written since it
 * opened), then the recent ones. The callers only accept that very id then: another session's
 * file must never stand in for it.
 */
function candidates(root: string, keep: (name: string) => boolean, since: number, sessionId?: string): string[] {
  const recent = newestFiles(root, keep, { depth: 2, sinceMs: since })
  if (!sessionId) return recent
  // Matched on the name before any stat: this runs on every model refresh.
  const named = newestFiles(root, (n) => keep(n) && n.includes(sessionId), { depth: 2 })
  return [...named, ...recent.filter((f) => !named.includes(f))]
}

/** Newest session file for `cwd`; with `sessionId`, that session's file or nothing. */
function jsonlHit(root: string, cwd: string, since: number, sessionId?: string): { id: string; file: string } | undefined {
  for (const file of candidates(root, (n) => n.endsWith(".jsonl") && !n.endsWith(".checkpoints.jsonl"), since, sessionId)) {
    for (const line of head(file, HEAD_BYTES).split("\n").slice(0, 5)) {
      let rec: { type?: unknown; id?: unknown; cwd?: unknown }
      try {
        rec = JSON.parse(line)
      } catch {
        continue
      }
      if ((rec.type === "session" || rec.type === "session_start") && typeof rec.id === "string") {
        if (typeof rec.cwd === "string" && sameDir(rec.cwd, cwd)) {
          if (!sessionId || rec.id === sessionId) return { id: rec.id, file }
        }
        break
      }
    }
  }
  return undefined
}

/** `~/.copilot/session-state/<id>/workspace.yaml` with `id:` and `cwd:` lines. */
function copilot(root: string, cwd: string, since: number): string | undefined {
  for (const file of newestFiles(root, (n) => n === "workspace.yaml", { depth: 2, sinceMs: since })) {
    const text = head(file, HEAD_BYTES)
    const id = /^id:\s*(\S+)/m.exec(text)?.[1]
    const dir = /^cwd:\s*(.+)$/m.exec(text)?.[1]?.trim()
    if (id && dir && sameDir(dir, cwd)) return id
  }
  return undefined
}

/** `~/.cline/data/sessions/<id>/<id>.json` with `session_id` and `cwd`. */
function cline(root: string, cwd: string, since: number): string | undefined {
  return clineHit(root, cwd, since)?.id
}

function clineHit(root: string, cwd: string, since: number, sessionId?: string): { id: string; file: string } | undefined {
  for (const file of candidates(root, (n) => n.endsWith(".json") && !n.endsWith(".messages.json"), since, sessionId)) {
    try {
      const rec = JSON.parse(fs.readFileSync(file, "utf8")) as { session_id?: unknown; cwd?: unknown }
      if (typeof rec.session_id === "string" && typeof rec.cwd === "string" && sameDir(rec.cwd, cwd)) {
        if (!sessionId || rec.session_id === sessionId) return { id: rec.session_id, file }
      }
    } catch {
      continue
    }
  }
  return undefined
}

/** Session id = name of the newest subdirectory (kimi, cursor). */
function newestSubdir(root: string, since: number): string | undefined {
  if (!fs.existsSync(root)) return undefined
  let best: { id: string; m: number } | undefined
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    if (!e.isDirectory()) continue
    const m = mtimeMs(path.join(root, e.name))
    if (m === undefined || m < since) continue
    if (!best || m > best.m) best = { id: e.name, m }
  }
  return best?.id
}

/**
 * `~/.local/share/amp/threads/T-<id>.json`. A thread names its folder in
 * `env.initial.trees[].uri` (file://…), written after the messages — so the end of the file
 * is read. A thread with no folder (never used) cannot be this tab's: no guess, since the
 * machine's newest thread is as likely another project's.
 */
function amp(root: string, cwd: string, since: number): string | undefined {
  for (const file of newestFiles(root, (n) => n.startsWith("T-") && n.endsWith(".json"), { depth: 2, sinceMs: since })) {
    const text = tail(file, TAIL_BYTES)
    const env = text.lastIndexOf('"env"')
    if (env === -1) continue
    for (const m of text.slice(env).matchAll(/"uri"\s*:\s*"(file:[^"]+)"/g)) {
      let dir: string
      try {
        dir = fileURLToPath(m[1]!)
      } catch {
        continue
      }
      if (sameDir(dir, cwd)) return path.basename(file, ".json")
    }
  }
  return undefined
}

const TAIL_BYTES = 16 * 1024

function tail(file: string, bytes: number): string {
  const fd = fs.openSync(file, "r")
  try {
    const size = fs.fstatSync(fd).size
    const buf = Buffer.alloc(Math.min(bytes, size))
    const n = fs.readSync(fd, buf, 0, buf.length, size - buf.length)
    return buf.subarray(0, n).toString("utf8")
  } finally {
    fs.closeSync(fd)
  }
}

function md5(text: string): string {
  return createHash("md5").update(text).digest("hex")
}

// SQLite stores are read through node:sqlite (Node ≥ 22.13, present in VS Code's extension
// host); under bun (unit tests) the equivalent bun:sqlite is used. Required lazily and
// untyped so the bundle and older hosts do not break on it.
export type SqliteDb = { prepare(sql: string): { get(...args: unknown[]): Record<string, unknown> | undefined }; close(): void }
export function openDb(file: string): SqliteDb | undefined {
  if (!fs.existsSync(file)) return undefined
  try {
    const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (p: string, o: { readOnly: boolean }) => SqliteDb }
    return new DatabaseSync(file, { readOnly: true })
  } catch {
    try {
      const { Database } = require("bun:sqlite") as { Database: new (p: string, o: { readonly: boolean }) => SqliteDb }
      return new Database(file, { readonly: true })
    } catch {
      return undefined
    }
  }
}

/** opencode and its forks: `session(id, parent_id, directory, time_updated)`; child
 * sessions (parent_id set) are subagents, never the tab's own conversation. */
function opencodeDb(file: string, cwd: string, since: number): string | undefined {
  const db = openDb(file)
  if (!db) return undefined
  try {
    const row = db.prepare("SELECT id FROM session WHERE directory = ? AND parent_id IS NULL AND time_updated >= ? ORDER BY time_updated DESC LIMIT 1").get(cwd, since)
    return typeof row?.id === "string" ? row.id : undefined
  } finally {
    db.close()
  }
}

/** goose ≥ 1.10: `sessions(id, working_dir, updated_at)`; updated_at may be epoch or ISO text. */
function gooseDb(file: string, cwd: string, since: number): string | undefined {
  const db = openDb(file)
  if (!db) return undefined
  try {
    const row = db.prepare("SELECT id, updated_at FROM sessions WHERE working_dir = ? ORDER BY updated_at DESC LIMIT 1").get(cwd)
    if (!row || typeof row.id !== "string") return undefined
    const at = typeof row.updated_at === "number" ? row.updated_at : Date.parse(String(row.updated_at))
    return Number.isFinite(at) && at >= since ? row.id : undefined
  } finally {
    db.close()
  }
}
