import { describe, expect, it } from "bun:test"
import { formatPromptTitle } from "../src/lib/title-sync.js"

describe("formatPromptTitle", () => {
  it("formats regular prompt strings", () => {
    expect(formatPromptTitle("hello world")).toBe("hello world")
    expect(formatPromptTitle("Review PR này, https://github.com/foo/bar/very/long/path/indeed")).toBe(
      "Review PR này,…",
    )
  })

  it("cuts long titles at a word boundary", () => {
    expect(formatPromptTitle("Rồi bây giờ bạn xóa cms-demo và làm lại")).toBe("Rồi bây giờ bạn xóa…")
    // Exactly at the cap stays whole.
    expect(formatPromptTitle("a".repeat(20))).toBe("a".repeat(20))
  })

  it("falls back to a hard cut when there is no usable word boundary", () => {
    expect(formatPromptTitle("Data/itsme/study/ai/sdlc-ts")).toBe("Data/itsme/study/ai/…")
    // A space too early in the string is ignored, otherwise the title loses too much.
    expect(formatPromptTitle("run demo-with-a-very-long-flag")).toBe("run demo-with-a-very…")
  })

  it("strips slash commands like /goal, /clear, /plan", () => {
    expect(formatPromptTitle("/goal fix auth bugs")).toBe("fix auth bugs")
    expect(formatPromptTitle("/plan create a new database model")).toBe("create a new…")
    expect(formatPromptTitle("/clear")).toBe("")
  })

  it("strips [Pasted text #...]", () => {
    expect(formatPromptTitle("Check this code\n[Pasted text #3 +14 lines]")).toBe("Check this code")
  })

  it("handles empty or single char inputs", () => {
    expect(formatPromptTitle("")).toBe("")
    expect(formatPromptTitle("a")).toBe("")
    expect(formatPromptTitle("   ")).toBe("")
  })
})
