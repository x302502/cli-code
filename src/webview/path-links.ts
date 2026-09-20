import type { IBufferLine, ILink, ILinkProvider, Terminal } from "@xterm/xterm"
import { findPathTokens } from "../lib/path-link.js"

export type ProbeResult = Record<string, { kind: "file" | "dir" } | null>

/** Sends `{type:"probePaths", id, texts}` to the host; the host answers through `resolve`. */
export type Prober = (texts: string[]) => Promise<ProbeResult>

// Results are cached briefly so hovering along a row does not re-stat the same tokens; the
// TTL keeps a file created after the first hover from staying a dead link for long.
const CACHE_TTL_MS = 5_000

/**
 * Recognises file/directory paths (optionally :line:col) on one buffer row. Like Orca, a
 * token only becomes a link once the host has confirmed it exists on disk — a truncated
 * table cell or a random `foo.bar` word never gets underlined.
 */
export function createPathLinkProvider(
  term: Terminal,
  probe: Prober,
  onActivate: (event: MouseEvent, text: string, kind: "file" | "dir") => void,
): ILinkProvider {
  const cache = new Map<string, { at: number; result: { kind: "file" | "dir" } | null }>()

  return {
    provideLinks(y, callback) {
      const line = term.buffer.active.getLine(y - 1)
      if (!line) return callback(undefined)
      const row = readRow(line)
      const tokens = findPathTokens(row.text)
      if (tokens.length === 0) return callback(undefined)

      const now = Date.now()
      const unknown = [...new Set(tokens.map((t) => t.text))].filter((text) => {
        const hit = cache.get(text)
        return !hit || now - hit.at > CACHE_TTL_MS
      })
      const build = () => {
        const links: ILink[] = []
        for (const t of tokens) {
          const result = cache.get(t.text)?.result
          if (!result) continue
          const last = t.start + t.text.length - 1
          links.push({
            text: t.text,
            // xterm ranges are 1-based, end-inclusive cell columns.
            range: { start: { x: row.col[t.start]! + 1, y }, end: { x: row.col[last]! + row.width[last]!, y } },
            activate: (e) => onActivate(e, t.text, result.kind),
          })
        }
        callback(links.length ? links : undefined)
      }
      if (unknown.length === 0) return build()
      probe(unknown).then(
        (results) => {
          const at = Date.now()
          for (const text of unknown) cache.set(text, { at, result: results[text] ?? null })
          build()
        },
        () => callback(undefined),
      )
    },
  }
}

/**
 * Row text plus, for every string index, the cell column it sits in and that cell's width.
 * String indices and columns diverge with combining marks (macOS writes Vietnamese filenames
 * in NFD, so "ế" is two code units in one cell) and with wide CJK glyphs (one code unit, two
 * cells); using indices as columns would underline the wrong span.
 */
function readRow(line: IBufferLine): { text: string; col: number[]; width: number[] } {
  let text = ""
  const col: number[] = []
  const width: number[] = []
  for (let x = 0; x < line.length; x++) {
    const cell = line.getCell(x)
    if (!cell) break
    const w = cell.getWidth()
    if (w === 0) continue // right half of a wide glyph
    const chars = cell.getChars() || " "
    for (let i = 0; i < chars.length; i++) {
      col.push(x)
      width.push(w)
    }
    text += chars
  }
  return { text, col, width }
}
