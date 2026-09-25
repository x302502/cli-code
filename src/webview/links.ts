import type { IBufferLine, IBufferRange, ILink, ILinkProvider, IMarker, Terminal } from "@xterm/xterm"
import { SNAPSHOT_LINKS_OSC } from "../lib/osc-link.js"
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

/**
 * OSC 8 links a snapshot carries in SNAPSHOT_LINKS_OSC (the serializer keeps only their text).
 * Each is pinned to its row with a marker, so it scrolls with the text, and is dropped once
 * that text is overwritten. xterm has no markers on the alternate screen (a full-screen TUI),
 * so there a link holds on to its row's line object instead: xterm moves those objects when it
 * scrolls, inserts or deletes lines, so the link's row is wherever that object sits now (the
 * screen has no scrollback: `rows` lines to look through). A full-screen scroll recycles the
 * line that left the top as the new bottom one — same object, new text — so the list's
 * recycle() is watched and ends that very line's links (a trim event would not do: a resize
 * fires it too, for lines still on screen). It lives only on that screen. Only honoured between begin() and end() — while the daemon's own
 * snapshot is being written, never from what a CLI prints.
 */
export function createSnapshotLinks(
  term: Terminal,
  onActivate: (event: MouseEvent, uri: string, range: IBufferRange) => void,
  onHover: (event: MouseEvent, uri: string) => void,
  onLeave: () => void,
): { provider: ILinkProvider; begin: () => void; end: () => void } {
  type Row = { marker: IMarker } | { alt: unknown }
  type LineList = { get(i: number): unknown; recycle?: () => unknown }
  let links: { row: Row; x: number; cells: number; text: string; uri: string }[] = []
  let writing = false
  const textAt = (y: number, x: number, cells: number) => term.buffer.active.getLine(y)?.translateToString(false, x, x + cells) ?? ""
  const alt = () => term.buffer.active.type === "alternate"
  // xterm's own line list (internal): its entries are the line objects that move with the text.
  const lineList = () => (term as unknown as { _core?: { buffer?: { lines?: LineList } } })._core?.buffer?.lines
  // Line lists whose recycle() already ends the links of the line it hands back.
  const watched = new WeakSet<LineList>()
  const watchRecycle = (list: LineList) => {
    const recycle = list.recycle
    if (watched.has(list) || !recycle) return
    watched.add(list)
    list.recycle = () => {
      const line = recycle.call(list)
      links = links.filter((l) => !("alt" in l.row) || l.row.alt !== line)
      return line
    }
  }
  const altLineAt = (y: number) => lineList()?.get(term.buffer.active.baseY + y)
  /** The link's buffer row now, or undefined once it is gone (trimmed, scrolled off, or its screen left). */
  const lineOf = (row: Row): number | undefined => {
    if ("marker" in row) return row.marker.isDisposed || alt() ? undefined : row.marker.line
    if (!alt()) return undefined
    for (let y = 0; y < term.rows; y++) if (altLineAt(y) === row.alt) return term.buffer.active.baseY + y
    return undefined
  }
  term.parser.registerOscHandler(SNAPSHOT_LINKS_OSC, (data) => {
    if (!writing) return true
    try {
      for (const [dy, x, cells, uri] of JSON.parse(data) as [number, number, number, string][]) {
        let row: Row | undefined
        if (alt()) {
          const line = altLineAt(term.buffer.active.cursorY + dy)
          if (line) row = { alt: line }
          const list = lineList()
          if (list) watchRecycle(list)
        } else {
          const marker = term.registerMarker(dy)
          if (marker) row = { marker }
        }
        if (row) links.push({ row, x, cells, uri, text: textAt(lineOf(row)!, x, cells) })
      }
    } catch {
      // malformed: no links restored
    }
    return true
  })
  return {
    begin: () => {
      for (const l of links) if ("marker" in l.row) l.row.marker.dispose()
      links = []
      writing = true
    },
    end: () => (writing = false),
    provider: {
      provideLinks(y, callback) {
        // A link whose screen is not showing is kept (it may come back); one whose text is gone is not.
        links = links.filter((l) => {
          const line = lineOf(l.row)
          // An alternate-screen link whose line scrolled off is gone for good.
          if (line === undefined) return "marker" in l.row ? !l.row.marker.isDisposed : !alt()
          return textAt(line, l.x, l.cells) === l.text
        })
        const out = links
          .filter((l) => lineOf(l.row) === y - 1)
          .map((l): ILink => {
            const range = { start: { x: l.x + 1, y }, end: { x: l.x + l.cells, y } }
            return { text: l.uri, range, activate: (e) => onActivate(e, l.uri, range), hover: (e) => onHover(e, l.uri), leave: onLeave }
          })
        callback(out.length ? out : undefined)
      },
    },
  }
}

/** Selects the cells a link occupies, so a plain Cmd+C copies the whole link. */
export function selectRange(term: Terminal, range: IBufferRange): void {
  // The length runs on across rows, so a link wrapped over several rows is selected whole.
  term.select(range.start.x - 1, range.start.y - 1, (range.end.y - range.start.y) * term.cols + range.end.x - range.start.x + 1)
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
