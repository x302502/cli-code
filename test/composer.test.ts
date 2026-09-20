import { describe, expect, it } from "bun:test"
import { composerHint, composerKeyAction, prepareSubmission } from "../src/lib/composer.js"

describe("composerKeyAction — Enter sends, Shift+Enter breaks a line, IME is respected", () => {
  it("plain Enter submits", () => {
    expect(composerKeyAction({ key: "Enter", shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, isComposing: false })).toBe("submit")
  })
  it("Shift+Enter inserts a newline (left to the textarea)", () => {
    expect(composerKeyAction({ key: "Enter", shiftKey: true, altKey: false, ctrlKey: false, metaKey: false, isComposing: false })).toBe("newline")
  })
  it("Enter while an IME composition is open (Vietnamese Telex) does nothing", () => {
    expect(composerKeyAction({ key: "Enter", shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, isComposing: true })).toBeUndefined()
  })
  it("Escape hands focus back to the terminal; other keys are ignored", () => {
    expect(composerKeyAction({ key: "Escape", shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, isComposing: false })).toBe("blur")
    expect(composerKeyAction({ key: "a", shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, isComposing: false })).toBeUndefined()
  })
})

describe("prepareSubmission — what actually reaches the CLI", () => {
  it("trims trailing whitespace/newlines and refuses empty input", () => {
    expect(prepareSubmission("xin chào  \n\n")).toBe("xin chào")
    expect(prepareSubmission("   \n")).toBeUndefined()
    expect(prepareSubmission("")).toBeUndefined()
  })
  it("keeps internal newlines and leading indentation (pasted code)", () => {
    expect(prepareSubmission("  def f():\n      pass\n")).toBe("  def f():\n      pass")
  })
})

describe("composerHint", () => {
  it("single line: how to send and break lines", () => {
    expect(composerHint("")).toBe("Enter gửi · Shift+Enter xuống dòng")
    expect(composerHint("một dòng")).toBe("Enter gửi · Shift+Enter xuống dòng")
  })
  it("multi-line: says it goes as one block", () => {
    expect(composerHint("a\nb\nc")).toBe("3 dòng · Enter gửi nguyên khối · Shift+Enter xuống dòng")
  })
})
