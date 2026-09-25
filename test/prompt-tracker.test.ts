import { describe, expect, it } from "bun:test"
import { createPromptTracker } from "../src/lib/prompt-tracker.js"

describe("createPromptTracker", () => {
  it("emits a title on Enter, then resets", () => {
    const { feed } = createPromptTracker()
    expect(feed("fix login bug")).toBeUndefined()
    expect(feed("\r")).toBe("fix login bug")
    expect(feed("\r")).toBeUndefined()
  })
  it("types characters and deletes with backspace", () => {
    const { feed } = createPromptTracker()
    for (const ch of "abcd") feed(ch)
    feed("\x7f")
    expect(feed("\r")).toBe("abc")
  })
  it("skips CSI (arrow keys) and lone ESC, keeps printable characters", () => {
    const { feed } = createPromptTracker()
    feed("a\x1b[Ab\x1b[D\x1bc")
    expect(feed("\r")).toBe("abc")
  })
  it("takes bracketed paste content verbatim", () => {
    const { feed } = createPromptTracker()
    feed("\x1b[200~review PR\x1b[201~")
    expect(feed("\r")).toBe("review PR")
  })
  it("Shift+Enter (ESC CR) is a soft newline, not a submit", () => {
    const { feed } = createPromptTracker()
    feed("line one\x1b\rline two")
    expect(feed("\r")).toBe("line one")
  })
  it("does not emit when the formatted line is under 2 characters", () => {
    const { feed } = createPromptTracker()
    feed("y")
    expect(feed("\r")).toBeUndefined()
    feed("/clear")
    expect(feed("\r")).toBeUndefined()
  })
  it("Ctrl+C cancels the line being typed", () => {
    const { feed } = createPromptTracker()
    feed("halfway\x03")
    expect(feed("\r")).toBeUndefined()
  })
  it("hasDraft: text typed and not yet sent; Enter, Ctrl+C and backspacing it all clear it", () => {
    const { feed, hasDraft } = createPromptTracker()
    expect(hasDraft()).toBe(false)
    feed("ab\x1b[A")
    expect(hasDraft()).toBe(true)
    feed("\r")
    expect(hasDraft()).toBe(false)
    feed("x\x03")
    expect(hasDraft()).toBe(false)
    feed("x\x7f")
    expect(hasDraft()).toBe(false)
  })
  it("after a reattach the input's content is unknown: assume a draft until Enter / Ctrl+C / reset() says otherwise", () => {
    const { feed, hasDraft, reset } = createPromptTracker({ draftUnknown: true })
    expect(hasDraft()).toBe(true)
    feed("\x1b[A")
    expect(hasDraft()).toBe(true)
    feed("\r")
    expect(hasDraft()).toBe(false)
    const other = createPromptTracker({ draftUnknown: true })
    other.feed("abc\x03")
    expect(other.hasDraft()).toBe(false)
    const third = createPromptTracker({ draftUnknown: true })
    third.reset()
    expect(third.hasDraft()).toBe(false)
    expect(createPromptTracker().hasDraft()).toBe(false)
  })
  it("reset() drops a one-key dialog answer (y, 1) so it is not mistaken for an unsent prompt", () => {
    const { feed, hasDraft, reset } = createPromptTracker()
    feed("1")
    expect(hasDraft()).toBe(true)
    reset()
    expect(hasDraft()).toBe(false)
  })
})

describe("createPromptTracker — promptStarted (the CLI's hook reports a prompt began)", () => {
  it("keeps a draft typed after the Enter: the hook for the sent prompt may arrive after it", () => {
    const t = createPromptTracker()
    t.feed("prompt A\r")
    t.feed("draft B")
    t.promptStarted()
    expect(t.hasDraft()).toBe(true)
  })
  it("clears state nothing was typed over since the last submit (e.g. an unknown draft after reattach)", () => {
    const t = createPromptTracker({ draftUnknown: true })
    t.promptStarted()
    expect(t.hasDraft()).toBe(false)
    const u = createPromptTracker()
    u.feed("A\r")
    u.promptStarted()
    expect(u.hasDraft()).toBe(false)
  })
})

describe("createPromptTracker — history recall", () => {
  it("↑/↓ (CSI or SS3) and Ctrl+P/Ctrl+N recall a prompt the tracker cannot see: the draft becomes unknown", () => {
    for (const key of ["\x1b[A", "\x1b[B", "\x1bOA", "\x1bOB", "\x10", "\x0e"]) {
      const t = createPromptTracker()
      expect(t.hasDraft()).toBe(false)
      t.feed(key)
      expect(t.hasDraft()).toBe(true)
      t.feed("\r")
      expect(t.hasDraft()).toBe(false)
    }
  })
  it("SS3 arrows are skipped whole, not typed as text", () => {
    const t = createPromptTracker()
    t.feed("ab\x1bOCc")
    expect(t.feed("\r")).toBe("abc")
  })
})

describe("createPromptTracker — edits it cannot replay", () => {
  it("after the caret moves (Home/←/→/End, Ctrl+A/E) the line is unknown: Backspace no longer means 'delete the last char'", () => {
    for (const move of ["\x1b[H", "\x1bOH", "\x1b[D", "\x1b[1~", "\x01", "\x02"]) {
      const t = createPromptTracker()
      t.feed("abc")
      t.feed(move)
      t.feed("\x7f\x7f\x7f")
      expect(t.hasDraft()).toBe(true)
    }
  })
  it("other editing keys it does not model (Tab completion, Ctrl+W/K/Y) also make the draft unknown", () => {
    for (const key of ["\t", "\x17", "\x0b", "\x19"]) {
      const t = createPromptTracker()
      t.feed(key)
      expect(t.hasDraft()).toBe(true)
    }
  })
  it("focus reports (ESC [ I / ESC [ O) are not edits", () => {
    const t = createPromptTracker()
    t.feed("\x1b[I\x1b[O")
    expect(t.hasDraft()).toBe(false)
  })
})
