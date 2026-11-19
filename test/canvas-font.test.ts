import { describe, expect, it } from "bun:test"
import { trimCanvasFont } from "../src/webview/canvas-font.js"

// Mimics Chromium 14x (Electron 43): a font string with leading whitespace is ignored.
class FakeContext {
  private value = "10px sans-serif"
  get font(): string {
    return this.value
  }
  set font(v: string) {
    if (/^\s/.test(v)) return
    this.value = v
  }
}

describe("trimCanvasFont", () => {
  it("a regular glyph's font (xterm's ' normal 26px …') is no longer dropped", () => {
    trimCanvasFont(FakeContext.prototype)
    const ctx = new FakeContext()
    ctx.font = " normal 26px Menlo, monospace"
    expect(ctx.font).toBe("normal 26px Menlo, monospace")
    ctx.font = "italic bold 26px Menlo"
    expect(ctx.font).toBe("italic bold 26px Menlo")
  })
  it("a missing prototype (no OffscreenCanvas) is skipped", () => {
    expect(() => trimCanvasFont(undefined)).not.toThrow()
  })
})
