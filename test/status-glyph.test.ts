import { describe, expect, it } from "bun:test"
import { decorateTitle } from "../src/lib/status-glyph.js"

describe("decorateTitle", () => {
  it("ghép glyph theo trạng thái", () => {
    expect(decorateTitle("Claude", "working", false)).toBe("⟳ Claude")
    expect(decorateTitle("Claude", "waiting", false)).toBe("? Claude")
    expect(decorateTitle("Claude", "blocked", false)).toBe("? Claude")
    expect(decorateTitle("Claude", "done", true)).toBe("● Claude")
    expect(decorateTitle("Claude", "done", false)).toBe("Claude")
    expect(decorateTitle("Claude", undefined, false)).toBe("Claude")
  })
})
