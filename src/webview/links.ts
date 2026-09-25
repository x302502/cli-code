import type { IBufferLine, IBufferRange, ILink, ILinkProvider, Terminal } from "@xterm/xterm"
import { findPathTokens, findUrlTokens } from "../lib/path-link.js"

export type ProbeResult = Record<string, { kind: "file" | "dir"; path: string } | null>

/** Sends `{type:"probePaths", id, texts}` to the host; the host answers through `resolve`. */
export type Prober = (texts: string[]) => Promise<ProbeResult>

export type LinkKind = "url" | "file" | "dir"
export type HoveredLink = { text: string; kind: LinkKind; path?: string; event: MouseEvent }

// Results are cached briefly so hovering along a row does not re-stat the same tokens; the
// TTL keeps a file created after the first hover from staying a dead link for long.
const CACHE_TTL_MS = 5_000

// How far a soft-wrapped line is followed up/down from the hovered row: a long URL spans a few
// rows; a minified blob spanning thousands must not be re-read on every hover.
const MAX_WRAP_ROWS = 16

/**
 * Recognises web/mail URLs and file/directory paths (optionally :line:col) on one logical
 * line — buffer rows joined across soft wraps, so a URL the terminal wrapped stays one link.
 * Like Orca, a path token only becomes a link once the host has confirmed it exists
 * on disk — a truncated table cell or a random `foo.bar` word never gets underlined.
 */
export function createTerminalLinkProvider(
  term: Terminal,
  probe: Prober,
  onActivate: (event: MouseEvent, text: string, kind: LinkKind, range: IBufferRange) => void,
  onHover: (link: HoveredLink | undefined) => void = () => {},
): ILinkProvider {
  const cache = new Map<string, { at: number; result: { kind: "file" | "dir"; path: string } | null }>()

  return {
    provideLinks(y, callback) {
      const row = readLogicalLine(term, y - 1)
      if (!row) return callback(undefined)
      // Only tokens that touch the hovered row; the others are found when their row is hovered.
      const onRow = (t: { start: number; text: string }) => row.row[t.start]! <= y - 1 && row.row[t.start + t.text.length - 1]! >= y - 1
      const allUrls = findUrlTokens(row.text)
      const paths = findPathTokens(row.text)
        .filter((p) => !allUrls.some((u) => p.start >= u.start && p.start < u.start + u.text.length))
        .filter(onRow)
      const urls = allUrls.filter(onRow)
      if (urls.length === 0 && paths.length === 0) return callback(undefined)

      const rangeOf = (start: number, len: number): IBufferRange => {
        const last = start + len - 1
        // xterm ranges are 1-based (x and y), end-inclusive cell columns.
        return { start: { x: row.col[start]! + 1, y: row.row[start]! + 1 }, end: { x: row.col[last]! + row.width[last]!, y: row.row[last]! + 1 } }
      }
      const build = () => {
        const links: ILink[] = []
        const link = (text: string, kind: LinkKind, range: IBufferRange, path?: string): ILink => ({
          text,
          range,
          activate: (e) => onActivate(e, text, kind, range),
          hover: (event) => onHover({ text, kind, path, event }),
          leave: () => onHover(undefined),
        })
        for (const u of urls) links.push(link(u.text, "url", rangeOf(u.start, u.text.length)))
        for (const p of paths) {
          const result = cache.get(p.text)?.result
          if (result) links.push(link(p.text, result.kind, rangeOf(p.start, p.text.length), result.path))
        }
        callback(links.length ? links : undefined)
      }

      const now = Date.now()
      const unknown = [...new Set(paths.map((t) => t.text))].filter((text) => {
        const hit = cache.get(text)
        return !hit || now - hit.at > CACHE_TTL_MS
      })
      if (unknown.length === 0) return build()
      probe(unknown).then(
        (results) => {
          const at = Date.now()
          for (const text of unknown) cache.set(text, { at, result: results[text] ?? null })
          build()
        },
        () => build(),
      )
    },
  }
}

/** Selects the cells a link occupies, so a plain Cmd+C copies the whole link. */
export function selectRange(term: Terminal, range: IBufferRange): void {
  term.select(range.start.x - 1, range.start.y - 1, range.end.x - range.start.x + 1)
}

/**
 * Row text plus, for every string index, the cell column it sits in and that cell's width.
 * String indices and columns diverge with combining marks (macOS writes Vietnamese filenames
 * in NFD, so "ế" is two code units in one cell) and with wide CJK glyphs (one code unit, two
 * cells); using indices as columns would underline the wrong span.
 */
/** The rows of the logical line through buffer row `y` (0-based), joined; `row` maps each string
 * index back to its buffer row. */
function readLogicalLine(term: Terminal, y: number): { text: string; col: number[]; width: number[]; row: number[] } | undefined {
  const buf = term.buffer.active
  if (!buf.getLine(y)) return undefined
  let first = y
  while (first > 0 && y - first < MAX_WRAP_ROWS && buf.getLine(first)?.isWrapped) first--
  let last = y
  while (last - y < MAX_WRAP_ROWS && buf.getLine(last + 1)?.isWrapped) last++
  const out = { text: "", col: [] as number[], width: [] as number[], row: [] as number[] }
  for (let r = first; r <= last; r++) {
    const part = readRow(buf.getLine(r)!)
    out.text += part.text
    out.col.push(...part.col)
    out.width.push(...part.width)
    for (let i = 0; i < part.text.length; i++) out.row.push(r)
  }
  return out
}

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
