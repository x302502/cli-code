import { createHash } from "node:crypto"
import * as fs from "node:fs"
import * as path from "node:path"

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
  // Threads carry no cwd; the newest thread started after this tab is the best available guess.
  amp: (_cwd, since, home) => amp(path.join(home, ".local", "share", "amp", "threads"), since),

  opencode: (cwd, since, home) => opencodeDb(path.join(home, ".local", "share", "opencode", "opencode.db"), cwd, since),
  mimo: (cwd, since, home) => opencodeDb(path.join(home, ".local", "share", "mimocode", "mimocode.db"), cwd, since),
  kilo: (cwd, since, home) => opencodeDb(path.join(home, ".local", "share", "kilo", "kilo.db"), cwd, since),
  goose: (cwd, since, home) => gooseDb(path.join(home, ".local", "share", "goose", "sessions", "sessions.db"), cwd, since),
}

const HEAD_BYTES = 16 * 1024

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

function mtime(p: string): number | undefined {
  try {
    return fs.statSync(p).mtimeMs
  } catch {
    return undefined
  }
}

function sameDir(a: string, b: string): boolean {
  return path.resolve(a) === path.resolve(b)
}

/** Files under `root` (up to two levels deep) modified at/after `since`, newest first. */
function recentFiles(root: string, since: number, keep: (name: string) => boolean): string[] {
  if (!fs.existsSync(root)) return []
  const out: { f: string; m: number }[] = []
  const visit = (dir: string, depth: number) => {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (depth < 2) visit(p, depth + 1)
      } else if (keep(e.name)) {
        const m = mtime(p)
        if (m !== undefined && m >= since) out.push({ f: p, m })
      }
    }
  }
  visit(root, 0)
  return out.sort((a, b) => b.m - a.m).map((x) => x.f)
}

function jsonlHeader(root: string, cwd: string, since: number): string | undefined {
  for (const file of recentFiles(root, since, (n) => n.endsWith(".jsonl") && !n.endsWith(".checkpoints.jsonl"))) {
    for (const line of head(file).split("\n").slice(0, 5)) {
      let rec: { type?: unknown; id?: unknown; cwd?: unknown }
      try {
        rec = JSON.parse(line)
      } catch {
        continue
      }
      if ((rec.type === "session" || rec.type === "session_start") && typeof rec.id === "string") {
        if (typeof rec.cwd === "string" && sameDir(rec.cwd, cwd)) return rec.id
        break
      }
    }
  }
  return undefined
}

/** `~/.copilot/session-state/<id>/workspace.yaml` with `id:` and `cwd:` lines. */
function copilot(root: string, cwd: string, since: number): string | undefined {
  for (const file of recentFiles(root, since, (n) => n === "workspace.yaml")) {
    const text = head(file)
    const id = /^id:\s*(\S+)/m.exec(text)?.[1]
    const dir = /^cwd:\s*(.+)$/m.exec(text)?.[1]?.trim()
    if (id && dir && sameDir(dir, cwd)) return id
  }
  return undefined
}

/** `~/.cline/data/sessions/<id>/<id>.json` with `session_id` and `cwd`. */
function cline(root: string, cwd: string, since: number): string | undefined {
  for (const file of recentFiles(root, since, (n) => n.endsWith(".json") && !n.endsWith(".messages.json"))) {
    try {
      const rec = JSON.parse(fs.readFileSync(file, "utf8")) as { session_id?: unknown; cwd?: unknown }
      if (typeof rec.session_id === "string" && typeof rec.cwd === "string" && sameDir(rec.cwd, cwd)) return rec.session_id
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
    const m = mtime(path.join(root, e.name))
    if (m === undefined || m < since) continue
    if (!best || m > best.m) best = { id: e.name, m }
  }
  return best?.id
}

function amp(root: string, since: number): string | undefined {
  for (const file of recentFiles(root, since, (n) => n.startsWith("T-") && n.endsWith(".json"))) {
    const id = path.basename(file, ".json")
    if (id) return id
  }
  return undefined
}

function md5(text: string): string {
  return createHash("md5").update(text).digest("hex")
}

// SQLite stores are read through node:sqlite (Node ≥ 22.13, present in VS Code's extension
// host); under bun (unit tests) the equivalent bun:sqlite is used. Required lazily and
// untyped so the bundle and older hosts do not break on it.
type SqliteDb = { prepare(sql: string): { get(...args: unknown[]): Record<string, unknown> | undefined }; close(): void }
function openDb(file: string): SqliteDb | undefined {
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

/** opencode and its forks: `session(id, directory, time_updated)`. */
function opencodeDb(file: string, cwd: string, since: number): string | undefined {
  const db = openDb(file)
  if (!db) return undefined
  try {
    const row = db.prepare("SELECT id FROM session WHERE directory = ? AND time_updated >= ? ORDER BY time_updated DESC LIMIT 1").get(cwd, since)
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
