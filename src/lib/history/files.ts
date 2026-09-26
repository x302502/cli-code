import * as fs from "node:fs"
import * as path from "node:path"

/** The first `bytes` of a file — session meta and the first prompt, cheap on huge transcripts. */
export function head(file: string, bytes = 64 * 1024): string {
  const fd = fs.openSync(file, "r")
  try {
    const buf = Buffer.alloc(bytes)
    const n = fs.readSync(fd, buf, 0, bytes, 0)
    return buf.subarray(0, n).toString("utf8")
  } finally {
    fs.closeSync(fd)
  }
}

/** The last `bytes` of a file (what a session store writes after its messages). */
export function tail(file: string, bytes: number): string {
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

/** mtime of a path, or undefined if it was removed since it was listed. */
export function mtimeMs(p: string): number | undefined {
  try {
    return fs.statSync(p).mtimeMs
  } catch {
    return undefined
  }
}

/**
 * Files under `dir` whose name passes `keep`, newest first. `depth` levels of subdirectories
 * are walked (0: `dir` alone), `sinceMs` drops files modified before it, `limit` caps the count.
 */
export function newestFiles(dir: string, keep: (name: string) => boolean, opts: { depth?: number; sinceMs?: number; limit?: number } = {}): string[] {
  if (!fs.existsSync(dir)) return []
  const { depth = 0, sinceMs, limit = Infinity } = opts
  const out: { f: string; m: number }[] = []
  const walk = (d: string, level: number) => {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) {
        if (level < depth) walk(p, level + 1)
      } else if (keep(e.name)) {
        const m = mtimeMs(p)
        if (m !== undefined && (sinceMs === undefined || m >= sinceMs)) out.push({ f: p, m })
      }
    }
  }
  walk(dir, 0)
  return out
    .sort((a, b) => b.m - a.m)
    .slice(0, limit)
    .map((x) => x.f)
}
