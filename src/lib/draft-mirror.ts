const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: "grapheme" })

const PASTE_START = "\x1b[200~"
const PASTE_END = "\x1b[201~"

// Claude collapses a paste into "[Pasted text #n +x lines]" once it spans lines or runs long;
// the chip is then edited as one unit (a single Backspace drops all of it).
const COLLAPSE_CHARS = 800

export type DraftSegment =
  | { kind: "typed"; text: string }
  | { kind: "paste"; n: number; text: string }
  /** Ctrl+V: the CLI reads the clipboard image itself; `id` ties it to the image fetched for it. */
  | { kind: "image"; n: number; id: number }

/** Is `text` one absolute path to an image file — what a CLI attaches rather than types? */
export function isImagePath(text: string): boolean {
  return /^(\/|[A-Za-z]:\\)[^\n]*\.(png|jpe?g|gif|webp)$/i.test(text)
}

export type DraftView = {
  segments: DraftSegment[]
  /** Where the CLI's caret is: an offset into one segment's text. */
  caret: { segment: number; offset: number }
  /** A key the mirror cannot replay (history, Tab completion, …) was pressed since the draft began. */
  uncertain: boolean
  pastes: number
  images: number
}

/** One caret step: a grapheme, a whole collapsed paste, or an image. */
type Unit = { text: string; paste?: number; image?: { id: number; n: number } }

/** Everything the mirror knows, as plain JSON: kept in the webview state so a reload of VS Code
 * (the CLI and its unsent draft live on in the daemon) shows the same draft again. */
export type DraftSnapshot = { units: Unit[]; caret: number; uncertain: boolean; pasteCount: number; imageCount: number; nextImageId: number }

/**
 * Rebuilds the CLI's input line from the keys sent to it, caret and all, keeping each
 * bracketed paste apart from typed text so the whole draft can be shown in full. Fed from
 * xterm's onData, which hands over every key and every paste whole.
 */
export function createDraftMirror(opts: { collapsesPastes?: boolean; restore?: DraftSnapshot } = {}): {
  /** Returns the ids of the images Ctrl+V added. */
  feed: (data: string) => number[]
  view: () => DraftView
  reset: () => void
  /** Ctrl+V found no image on the clipboard: the CLI added nothing. */
  dropImage: (id: number) => void
  snapshot: () => DraftSnapshot
} {
  const r = opts.restore
  const valid = r !== undefined && Array.isArray(r.units) && Number.isInteger(r.caret) && r.caret >= 0 && r.caret <= r.units.length
  let units: Unit[] = valid ? r.units : []
  let caret = valid ? r.caret : 0
  let uncertain = valid ? r.uncertain === true : false
  let pasteCount = valid ? r.pasteCount : 0
  let imageCount = valid ? r.imageCount : 0
  // Ids stay unique for the mirror's whole life: a late clipboard answer must not hit a newer image.
  let nextImageId = valid ? r.nextImageId : 1

  const reset = () => {
    units = []
    caret = 0
    uncertain = false
    pasteCount = 0
    imageCount = 0
  }
  const insert = (added: Unit[]) => {
    units.splice(caret, 0, ...added)
    caret += added.length
  }
  const erase = (from: number, to: number) => {
    units.splice(from, to - from)
    caret = from
  }
  const isNewline = (u: Unit | undefined) => u?.text === "\n"
  const isSpace = (u: Unit | undefined) => u !== undefined && /^\s+$/.test(u.text)
  const lineStart = () => {
    let i = caret
    while (i > 0 && !isNewline(units[i - 1])) i--
    return i
  }
  const lineEnd = () => {
    let i = caret
    while (i < units.length && !isNewline(units[i])) i++
    return i
  }
  const wordBack = () => {
    let i = caret
    while (i > 0 && isSpace(units[i - 1])) i--
    while (i > 0 && !isSpace(units[i - 1])) i--
    return i
  }
  const wordForward = () => {
    let i = caret
    while (i < units.length && isSpace(units[i])) i++
    while (i < units.length && !isSpace(units[i])) i++
    return i
  }
  const graphemes = (text: string, paste?: number): Unit[] => [...GRAPHEMES.segment(text)].map(({ segment }) => ({ text: segment, paste }))

  // A cursor/edit key named by its CSI or SS3 final byte (and params); false if not one we replay.
  const key = (params: string, final: string): boolean => {
    const plain = params === "" || params === "1"
    const word = params === "1;3" || params === "1;5"
    if (final === "D" && plain) caret = Math.max(0, caret - 1)
    else if (final === "C" && plain) caret = Math.min(units.length, caret + 1)
    else if (final === "D" && word) caret = wordBack()
    else if (final === "C" && word) caret = wordForward()
    else if ((final === "H" && plain) || (final === "~" && (params === "1" || params === "7"))) caret = lineStart()
    else if ((final === "F" && plain) || (final === "~" && (params === "4" || params === "8"))) caret = lineEnd()
    else if (final === "~" && params === "3") units.splice(caret, 1)
    else return false
    return true
  }

  const feed = (data: string): number[] => {
    const added: number[] = []
    const addImage = () => {
      const id = nextImageId++
      insert([{ text: "", image: { id, n: ++imageCount } }])
      added.push(id)
    }
    let i = 0
    while (i < data.length) {
      if (data.startsWith(PASTE_START, i)) {
        const start = i + PASTE_START.length
        const end = data.indexOf(PASTE_END, start)
        const text = data.slice(start, end === -1 ? data.length : end).replace(/\r\n?/g, "\n")
        i = end === -1 ? data.length : end + PASTE_END.length
        // An empty paste is Cmd+V of an image (no text for the terminal): Claude reads the clipboard
        // image on it, as on Ctrl+V.
        if (!text) {
          addImage()
          continue
        }
        const n = ++pasteCount
        // A pasted image path becomes an image chip in the CLIs that take images.
        const atomic = isImagePath(text) || (opts.collapsesPastes && (text.includes("\n") || text.length > COLLAPSE_CHARS))
        insert(atomic ? [{ text, paste: n }] : graphemes(text, n))
        continue
      }
      const ch = data[i]!
      if (ch === "\x1b") {
        const next = data[i + 1]
        if (next === undefined) {
          // A lone Esc: nothing the input shows changes.
          i++
        } else if (next === "\r") {
          insert([{ text: "\n" }])
          i += 2
        } else if (next === "\x7f") {
          erase(wordBack(), caret)
          i += 2
        } else if (next === "b" || next === "f") {
          caret = next === "b" ? wordBack() : wordForward()
          i += 2
        } else if (next === "[") {
          let j = i + 2
          while (j < data.length && !(data.charCodeAt(j) >= 0x40 && data.charCodeAt(j) <= 0x7e)) j++
          const params = data.slice(i + 2, j)
          const final = data[j] ?? ""
          // Mouse reports (SGR "<…") and focus reports (ESC [ I / O) are not edits.
          const ignored = params.startsWith("<") || (params === "" && (final === "I" || final === "O"))
          if (!ignored && !key(params, final)) uncertain = true
          i = j + 1
        } else if (next === "O" && i + 2 < data.length) {
          if (!key("", data[i + 2]!)) uncertain = true
          i += 3
        } else {
          uncertain = true
          i += 2
        }
        continue
      }
      if (ch === "\r" || ch === "\n" || ch === "\x03") reset()
      else if (ch === "\x16") addImage()
      else if (ch === "\x7f" || ch === "\b") {
        if (caret > 0) erase(caret - 1, caret)
      } else if (ch === "\x01") caret = lineStart()
      else if (ch === "\x05") caret = lineEnd()
      else if (ch === "\x17") erase(wordBack(), caret)
      else if (ch === "\x15") erase(lineStart(), caret)
      else if (ch === "\x0b") units.splice(caret, lineEnd() - caret)
      else if (ch < " ") uncertain = true
      else {
        let j = i
        while (j < data.length && data[j]! >= " " && data[j] !== "\x7f") j++
        insert(graphemes(data.slice(i, j)))
        i = j
        continue
      }
      i++
    }
    return added
  }

  const dropImage = (id: number) => {
    const at = units.findIndex((u) => u.image?.id === id)
    if (at === -1) return
    units.splice(at, 1)
    if (caret > at) caret--
  }

  const view = (): DraftView => {
    const segments: DraftSegment[] = []
    // Index of the segment each unit landed in.
    const owner: number[] = []
    let prev: number | undefined | null = null
    for (const u of units) {
      if (u.image) {
        segments.push({ kind: "image", ...u.image })
        prev = null
      } else {
        if (segments.length === 0 || prev === null || u.paste !== prev) {
          segments.push(u.paste === undefined ? { kind: "typed", text: "" } : { kind: "paste", n: u.paste, text: "" })
          prev = u.paste
        }
        const last = segments[segments.length - 1]!
        if (last.kind !== "image") last.text += u.text
      }
      owner.push(segments.length - 1)
    }
    let caretAt = { segment: 0, offset: 0 }
    if (caret > 0) {
      const segment = owner[caret - 1]!
      let offset = 0
      for (let k = 0; k < caret; k++) if (owner[k] === segment) offset += units[k]!.text.length
      caretAt = { segment, offset }
    }
    // By number: typing into the middle of a paste splits it into two segments, still one paste.
    const pastes = new Set(segments.flatMap((s) => (s.kind === "paste" ? [s.n] : []))).size
    return { segments, caret: caretAt, uncertain, pastes, images: segments.filter((s) => s.kind === "image").length }
  }

  const snapshot = (): DraftSnapshot => ({ units, caret, uncertain, pasteCount, imageCount, nextImageId })

  return { feed, view, reset, dropImage, snapshot }
}

const LONG_DRAFT_LINES = 3
const LONG_DRAFT_CHARS = 200

/** Is the draft worth a preview? A paste or an image (the CLI may show only "[Pasted text #1]"),
 * or typing long enough to be hard to read in the CLI's input; short typing the CLI shows whole. */
export function showsDraft(view: DraftView): boolean {
  if (view.pastes > 0 || view.images > 0) return true
  const text = view.segments.map((s) => (s.kind === "image" ? "" : s.text)).join("")
  return text.split("\n").length >= LONG_DRAFT_LINES || text.length >= LONG_DRAFT_CHARS
}

const PREVIEW_MAX_HEIGHT = 300

/**
 * Where the draft preview floats, in px from the viewport bottom: right above the row over the
 * caret (the CLI's input border stays in sight; a multi-line draft's earlier lines are covered,
 * the preview shows them anyway). A caret in the top third means the CLI is not at its input
 * (a menu, a full-screen view): dock at the bottom instead.
 */
export function placeDraftPreview(p: {
  viewportHeight: number
  screenTop: number
  cellHeight: number
  rows: number
  cursorRow: number
  /** Height kept clear at the top (the action bar). */
  topReserve: number
}): { bottom: number; maxHeight: number } {
  if (p.cursorRow < p.rows / 3) return { bottom: 8, maxHeight: Math.min(PREVIEW_MAX_HEIGHT, p.viewportHeight - p.topReserve - 16) }
  const anchor = p.screenTop + (p.cursorRow - 1) * p.cellHeight
  return { bottom: p.viewportHeight - anchor, maxHeight: Math.min(PREVIEW_MAX_HEIGHT, anchor - p.topReserve - 4) }
}

/**
 * The images kept with the draft across a reload, base64 by id: newest first while they fit
 * `budget` bytes (the webview state holds them; a screenshot is 0.2–1 MB).
 */
export function keptImages(images: Map<number, Uint8Array>, budget: number): Record<number, string> {
  const kept: Record<number, string> = {}
  let used = 0
  for (const id of [...images.keys()].sort((a, b) => b - a)) {
    const bytes = images.get(id)!
    if (used + bytes.length > budget) continue
    used += bytes.length
    kept[id] = encodeImage(bytes)
  }
  return kept
}

export function encodeImage(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

export function decodeImage(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}
