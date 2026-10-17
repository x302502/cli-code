import { describe, expect, it } from "bun:test"
import { Terminal } from "@xterm/headless"
import { placeScrollButton, showsScrollButton } from "../src/webview/scroll-button.js"

const write = (term: Terminal, data: string) => new Promise<void>((resolve) => term.write(data, resolve))

describe("showsScrollButton", () => {
  it("shows only while the history is scrolled back", async () => {
    const term = new Terminal({ cols: 20, rows: 5, scrollback: 100, allowProposedApi: true })
    expect(showsScrollButton(term.buffer.active)).toBe(false)
    await write(term, Array.from({ length: 30 }, (_, i) => `line ${i}`).join("\r\n"))
    expect(showsScrollButton(term.buffer.active)).toBe(false)
    term.scrollLines(-3)
    expect(showsScrollButton(term.buffer.active)).toBe(true)
    term.scrollToBottom()
    expect(showsScrollButton(term.buffer.active)).toBe(false)
  })

  it("never shows on the alternate screen, which has no history", async () => {
    const term = new Terminal({ cols: 20, rows: 5, scrollback: 100, allowProposedApi: true })
    await write(term, Array.from({ length: 30 }, (_, i) => `line ${i}`).join("\r\n"))
    await write(term, "\x1b[?1049h")
    term.scrollLines(-3)
    expect(showsScrollButton(term.buffer.active)).toBe(false)
  })
})

describe("placeScrollButton", () => {
  const base = { viewportHeight: 600, screenBottom: 560, height: 30 }

  it("floats just over the last terminal row", () => {
    expect(placeScrollButton(base)).toBe(52)
  })

  it("steps above a draft preview it would overlap", () => {
    expect(placeScrollButton({ ...base, draft: { top: 450, bottom: 590 } })).toBe(156)
  })

  it("stays put when the draft preview is elsewhere", () => {
    expect(placeScrollButton({ ...base, draft: { top: 40, bottom: 200 } })).toBe(52)
  })
})
