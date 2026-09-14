// src/lib/osc-scan.ts

export type OscEvent =
  | { kind: "title"; title: string }
  | { kind: "cwd"; cwd: string }
  | { kind: "status"; payload: string }

const OSC_PREFIX = "\x1b]"
const MAX_PENDING = 64 * 1024

/** Path component of a file:// URL, percent-decoded; undefined for anything else. */
export function parseFileUrlPath(url: string): string | undefined {
  if (!url.startsWith("file://")) return undefined
  const afterScheme = url.slice("file://".length)
  const slash = afterScheme.indexOf("/")
  if (slash === -1) return undefined
  try {
    return decodeURIComponent(afterScheme.slice(slash))
  } catch {
    return undefined
  }
}

function findTerminator(text: string, from: number): { index: number; length: 1 | 2 } | undefined {
  const bel = text.indexOf("\x07", from)
  const st = text.indexOf("\x1b\\", from)
  if (bel === -1 && st === -1) return undefined
  if (bel === -1) return { index: st, length: 2 }
  if (st === -1 || bel < st) return { index: bel, length: 1 }
  return { index: st, length: 2 }
}

function toEvent(body: string): OscEvent | undefined {
  const semi = body.indexOf(";")
  if (semi === -1) return undefined
  const code = body.slice(0, semi)
  const data = body.slice(semi + 1)
  if (code === "0" || code === "1" || code === "2") return { kind: "title", title: data }
  if (code === "7") {
    const cwd = parseFileUrlPath(data)
    return cwd ? { kind: "cwd", cwd } : undefined
  }
  if (code === "9999") return { kind: "status", payload: data }
  return undefined
}

/**
 * Stateful OSC scanner for a PTY stream. The stream is split at arbitrary
 * points, so an escape sequence can straddle chunks — the unfinished tail is
 * kept (bounded) and re-examined when the next chunk arrives.
 */
export function createOscScanner(): (chunk: string) => OscEvent[] {
  let pending = ""

  return (chunk) => {
    const text = pending + chunk
    pending = ""
    const events: OscEvent[] = []
    let cursor = 0

    while (cursor < text.length) {
      const start = text.indexOf(OSC_PREFIX, cursor)
      if (start === -1) {
        // A lone trailing ESC could be the first byte of a prefix split across chunks.
        if (text.endsWith("\x1b")) pending = "\x1b"
        break
      }
      const term = findTerminator(text, start + OSC_PREFIX.length)
      if (!term) {
        const tail = text.slice(start)
        pending = tail.length > MAX_PENDING ? "" : tail
        break
      }
      const event = toEvent(text.slice(start + OSC_PREFIX.length, term.index))
      if (event) events.push(event)
      cursor = term.index + term.length
    }

    return events
  }
}
