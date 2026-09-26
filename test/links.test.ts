import { describe, expect, it } from "bun:test"
import { Terminal } from "@xterm/headless"
import type { ILink, Terminal as XTerm } from "@xterm/xterm"
import { createTerminalLinkProvider, selectRange } from "../src/webview/links.js"

function linksOn(term: Terminal, y: number): Promise<ILink[]> {
  const provider = createTerminalLinkProvider(term as unknown as XTerm, async () => ({}), () => {})
  return new Promise((resolve) => provider.provideLinks(y, (links) => resolve(links ?? [])))
}

describe("createTerminalLinkProvider — soft-wrapped lines", () => {
  const url = "https://example.com/projects/my-project/issues/12345?view=details"
  it("a URL the terminal wrapped is one link, on every row it covers, with a range spanning the rows", async () => {
    const term = new Terminal({ cols: 40, rows: 5, allowProposedApi: true })
    await new Promise<void>((r) => term.write(`${url}\r\nnext`, r))
    expect(term.buffer.active.getLine(1)!.isWrapped).toBe(true)
    for (const y of [1, 2]) {
      const links = await linksOn(term, y)
      expect(links.map((l) => l.text)).toEqual([url])
      expect(links[0]!.range).toEqual({ start: { x: 1, y: 1 }, end: { x: url.length - 40, y: 2 } })
    }
    expect(await linksOn(term, 3)).toEqual([])
    term.dispose()
  })
  it("rows joined by a hard newline stay separate lines", async () => {
    const term = new Terminal({ cols: 40, rows: 5, allowProposedApi: true })
    await new Promise<void>((r) => term.write("https://example.com/a\r\nb/c", r))
    expect((await linksOn(term, 1)).map((l) => l.text)).toEqual(["https://example.com/a"])
    term.dispose()
  })
})

describe("selectRange", () => {
  it("selects a link wrapped over rows whole: the length runs on across rows", () => {
    const calls: number[][] = []
    const term = { cols: 40, select: (...a: number[]) => calls.push(a) } as unknown as XTerm
    selectRange(term, { start: { x: 1, y: 1 }, end: { x: 25, y: 2 } })
    expect(calls).toEqual([[0, 0, 65]])
    selectRange(term, { start: { x: 3, y: 4 }, end: { x: 7, y: 4 } })
    expect(calls[1]).toEqual([2, 3, 5])
  })
})
