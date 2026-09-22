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
  it("reset() drops a one-key dialog answer (y, 1) so it is not mistaken for an unsent prompt", () => {
    const { feed, hasDraft, reset } = createPromptTracker()
    feed("1")
    expect(hasDraft()).toBe(true)
    reset()
    expect(hasDraft()).toBe(false)
  })
})
