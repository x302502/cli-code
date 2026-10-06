import { describe, expect, it } from "bun:test"
import { createDraftMirror, decodeImage, keptImages, placeDraftPreview, showsDraft } from "../src/lib/draft-mirror.js"

const PASTE = (text: string) => `\x1b[200~${text}\x1b[201~`
const LEFT = "\x1b[D"
const RIGHT = "\x1b[C"

describe("createDraftMirror", () => {
  it("keeps typed text and pastes apart, in order", () => {
    const d = createDraftMirror()
    d.feed("fix ")
    d.feed(PASTE("a\nb"))
    d.feed(" please")
    expect(d.view().segments).toEqual([
      { kind: "typed", text: "fix " },
      { kind: "paste", n: 1, text: "a\nb" },
      { kind: "typed", text: " please" },
    ])
    expect(d.view().pastes).toBe(1)
  })
  it("counts a paste typed into the middle of once, though it shows as two pieces", () => {
    const d = createDraftMirror()
    d.feed(PASTE("abcd") + LEFT + LEFT + "X")
    expect(d.view().segments.length).toBe(3)
    expect(d.view().pastes).toBe(1)
  })
  it("numbers pastes within a draft and starts over after a submit", () => {
    const d = createDraftMirror()
    d.feed(PASTE("one") + PASTE("two"))
    expect(d.view().segments.map((s) => (s.kind === "paste" ? s.n : 0))).toEqual([1, 2])
    d.feed("\r")
    d.feed(PASTE("three"))
    expect(d.view().segments).toEqual([{ kind: "paste", n: 1, text: "three" }])
  })
  it("turns CRLF and CR inside a paste into newlines", () => {
    const d = createDraftMirror()
    d.feed(PASTE("a\r\nb\rc"))
    expect(d.view().segments).toEqual([{ kind: "paste", n: 1, text: "a\nb\nc" }])
  })
  it("clears on Enter, Ctrl+C and reset", () => {
    const d = createDraftMirror()
    for (const clear of ["\r", "\x03"]) {
      d.feed("x" + PASTE("y"))
      d.feed(clear)
      expect(d.view().segments).toEqual([])
    }
    d.feed("x")
    d.reset()
    expect(d.view().segments).toEqual([])
  })
  it("Shift+Enter (ESC CR) is a newline in the draft", () => {
    const d = createDraftMirror()
    d.feed("a\x1b\rb")
    expect(d.view().segments).toEqual([{ kind: "typed", text: "a\nb" }])
  })
  it("Backspace erases one grapheme before the caret", () => {
    const d = createDraftMirror()
    d.feed("ab👍\x7f")
    expect(d.view().segments).toEqual([{ kind: "typed", text: "ab" }])
  })
  it("a collapsed paste is one unit: one Backspace erases all of it", () => {
    const d = createDraftMirror({ collapsesPastes: true })
    d.feed("x" + PASTE("line 1\nline 2") + "\x7f")
    expect(d.view().segments).toEqual([{ kind: "typed", text: "x" }])
  })
  it("a short one-line paste is not collapsed, even where pastes collapse", () => {
    const d = createDraftMirror({ collapsesPastes: true })
    d.feed(PASTE("word") + "\x7f")
    expect(d.view().segments).toEqual([{ kind: "paste", n: 1, text: "wor" }])
  })
  it("an inline paste is edited character by character", () => {
    const d = createDraftMirror()
    d.feed(PASTE("a\nb") + "\x7f")
    expect(d.view().segments).toEqual([{ kind: "paste", n: 1, text: "a\n" }])
  })
  it("inserts at the caret after ← and →", () => {
    const d = createDraftMirror()
    d.feed("ac" + LEFT + "b" + RIGHT + "d")
    expect(d.view().segments).toEqual([{ kind: "typed", text: "abcd" }])
  })
  it("reads application-mode arrows (ESC O D) too", () => {
    const d = createDraftMirror()
    d.feed("ac\x1bODb")
    expect(d.view().segments).toEqual([{ kind: "typed", text: "abc" }])
  })
  it("Home/End and Ctrl+A/Ctrl+E move within the current line", () => {
    const d = createDraftMirror()
    d.feed("one\x1b\rtwo\x1b[H>\x05<")
    expect(d.view().segments).toEqual([{ kind: "typed", text: "one\n>two<" }])
    d.feed("\x01[\x1b[F]")
    expect(d.view().segments).toEqual([{ kind: "typed", text: "one\n[>two<]" }])
  })
  it("Delete erases the grapheme after the caret", () => {
    const d = createDraftMirror()
    d.feed("abc" + LEFT + LEFT + "\x1b[3~")
    expect(d.view().segments).toEqual([{ kind: "typed", text: "ac" }])
  })
  it("Ctrl+W and Alt+Backspace erase the word before the caret", () => {
    const d = createDraftMirror()
    d.feed("fix the bug  \x17")
    expect(d.view().segments).toEqual([{ kind: "typed", text: "fix the " }])
    d.feed("\x1b\x7f")
    expect(d.view().segments).toEqual([{ kind: "typed", text: "fix " }])
  })
  it("Ctrl+U erases to the line start, Ctrl+K to the line end", () => {
    const d = createDraftMirror()
    d.feed("keep\x1b\rdrop this" + LEFT + LEFT + "\x15")
    expect(d.view().segments).toEqual([{ kind: "typed", text: "keep\nis" }])
    d.feed(RIGHT + "\x0b")
    expect(d.view().segments).toEqual([{ kind: "typed", text: "keep\ni" }])
  })
  it("Alt+← / Alt+→ jump by word (ESC b / ESC f and CSI 1;3 D / C)", () => {
    const d = createDraftMirror()
    d.feed("one two\x1bb_")
    expect(d.view().segments).toEqual([{ kind: "typed", text: "one _two" }])
    d.feed("\x1b[1;3D\x1b[1;3D^\x1b[1;3C$")
    expect(d.view().segments).toEqual([{ kind: "typed", text: "^one$ _two" }])
  })
  it("reports the caret as a segment and an offset in it", () => {
    const d = createDraftMirror()
    expect(d.view().caret).toEqual({ segment: 0, offset: 0 })
    d.feed("ab" + PASTE("p\nq") + "cd" + LEFT)
    expect(d.view().caret).toEqual({ segment: 2, offset: 1 })
    d.feed(LEFT + LEFT)
    expect(d.view().caret).toEqual({ segment: 1, offset: 2 })
  })
  it("the caret right after a collapsed paste sits at that paste's end", () => {
    const d = createDraftMirror({ collapsesPastes: true })
    d.feed("ab" + PASTE("p\nq"))
    expect(d.view().caret).toEqual({ segment: 1, offset: 3 })
  })
  it("keys it cannot replay (↑, Tab, Ctrl+R …) mark the draft uncertain until it is cleared", () => {
    for (const key of ["\x1b[A", "\t", "\x12", "\x1b[5~"]) {
      const d = createDraftMirror()
      d.feed("a" + key)
      expect(d.view().uncertain).toBe(true)
      d.feed("\r")
      expect(d.view().uncertain).toBe(false)
    }
  })
  // Fed from xterm onData, which hands over every key and every paste whole.
  it("focus reports, mouse reports and a lone Esc change nothing", () => {
    const d = createDraftMirror()
    d.feed("a\x1b[I\x1b[O\x1b[<0;10;5M\x1b[<0;10;5m\x1b")
    d.feed("b")
    expect(d.view()).toEqual({ segments: [{ kind: "typed", text: "ab" }], caret: { segment: 0, offset: 2 }, uncertain: false, pastes: 0, images: 0 })
  })
})

describe("placeDraftPreview", () => {
  const screen = { viewportHeight: 600, screenTop: 40, cellHeight: 20, rows: 27, topReserve: 40 }
  it("sits just above the row over the caret, leaving the input's top border in sight", () => {
    // Caret on row 25 → row 24 (the border) starts at 40 + 24*20 = 520.
    expect(placeDraftPreview({ ...screen, cursorRow: 25 })).toEqual({ bottom: 80, maxHeight: 300 })
  })
  it("gives up height before covering the top bar", () => {
    expect(placeDraftPreview({ ...screen, cursorRow: 12 })).toEqual({ bottom: 340, maxHeight: 216 })
  })
  it("docks at the bottom when the caret is in the top third (the CLI is not at its input)", () => {
    expect(placeDraftPreview({ ...screen, cursorRow: 8 })).toEqual({ bottom: 8, maxHeight: 300 })
  })
})

describe("createDraftMirror with images", () => {
  it("a pasted image path is one unit in every CLI (it becomes an image chip)", () => {
    const d = createDraftMirror()
    d.feed("see " + PASTE("/tmp/shot.png") + "\x7f")
    expect(d.view().segments).toEqual([{ kind: "typed", text: "see " }])
  })
  it("Ctrl+V (the CLI reads the clipboard image itself) adds an image at the caret and returns its id", () => {
    const d = createDraftMirror()
    expect(d.feed("see \x16")).toEqual([1])
    expect(d.view()).toEqual({
      segments: [{ kind: "typed", text: "see " }, { kind: "image", n: 1, id: 1 }],
      caret: { segment: 1, offset: 0 },
      uncertain: false,
      pastes: 0,
      images: 1,
    })
  })
  it("an empty paste (Cmd+V of an image: no text for the terminal) is an image too — Claude reads the clipboard on it", () => {
    const d = createDraftMirror()
    expect(d.feed("see " + PASTE(""))).toEqual([1])
    expect(d.view().segments).toEqual([{ kind: "typed", text: "see " }, { kind: "image", n: 1, id: 1 }])
  })
  it("drops an image the clipboard did not hold", () => {
    const d = createDraftMirror()
    const [id] = d.feed("a\x16b")
    d.dropImage(id!)
    expect(d.view().segments).toEqual([{ kind: "typed", text: "ab" }])
    expect(d.view().images).toBe(0)
  })
  it("one Backspace erases an image", () => {
    const d = createDraftMirror()
    d.feed("a\x16\x7f")
    expect(d.view().segments).toEqual([{ kind: "typed", text: "a" }])
  })
  it("images are numbered apart from pastes, like the CLIs' [Image #n]", () => {
    const d = createDraftMirror()
    d.feed(PASTE("x\ny") + "\x16\x16")
    expect(d.view().segments.map((s) => s.kind + ("n" in s ? s.n : ""))).toEqual(["paste1", "image1", "image2"])
  })
})


describe("createDraftMirror snapshot", () => {
  it("restores a draft after a reload exactly as it was, caret and all", () => {
    const d = createDraftMirror({ collapsesPastes: true })
    d.feed("fix " + PASTE("a\nb") + "\x16 now" + LEFT)
    const restored = createDraftMirror({ collapsesPastes: true, restore: JSON.parse(JSON.stringify(d.snapshot())) })
    expect(restored.view()).toEqual(d.view())
  })
  it("keeps editing where it left off: numbering and image ids carry on", () => {
    const d = createDraftMirror()
    d.feed(PASTE("one") + "\x16")
    const restored = createDraftMirror({ restore: d.snapshot() })
    expect(restored.feed(PASTE("two") + "\x16")).toEqual([2])
    expect(restored.view().segments.map((s) => s.kind + ("n" in s ? s.n : ""))).toEqual(["paste1", "image1", "paste2", "image2"])
  })
  it("ignores a snapshot that is not one (an older or damaged state)", () => {
    const d = createDraftMirror({ restore: { units: "nope" } as never })
    expect(d.view().segments).toEqual([])
  })
})

describe("keptImages", () => {
  it("keeps the images that fit the budget, base64-encoded, newest first", () => {
    const images = new Map([
      [1, new Uint8Array([1, 2, 3])],
      [2, new Uint8Array(10)],
      [3, new Uint8Array([255])],
    ])
    expect(keptImages(images, 5)).toEqual({ 3: "/w==", 1: "AQID" })
  })
  it("round-trips through decodeImage", () => {
    expect(decodeImage(keptImages(new Map([[1, new Uint8Array([0, 128, 255])]]), 100)[1]!)).toEqual(new Uint8Array([0, 128, 255]))
  })
})

describe("showsDraft", () => {
  const view = (feed: string) => {
    const d = createDraftMirror()
    d.feed(feed)
    return d.view()
  }
  it("shows any paste or image", () => {
    expect(showsDraft(view(PASTE("x")))).toBe(true)
    expect(showsDraft(view("\x16"))).toBe(true)
  })
  it("shows a long typed draft: 3 lines or more, or 200 characters or more", () => {
    expect(showsDraft(view("one\x1b\rtwo\x1b\rthree"))).toBe(true)
    expect(showsDraft(view("a".repeat(200)))).toBe(true)
  })
  it("leaves a short typed draft to the CLI, which shows it whole", () => {
    expect(showsDraft(view("one\x1b\rtwo"))).toBe(false)
    expect(showsDraft(view("a".repeat(199)))).toBe(false)
    expect(showsDraft(view(""))).toBe(false)
  })
})
