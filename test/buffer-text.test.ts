import { describe, expect, it } from "bun:test"
import { tailText } from "../src/webview/buffer-text.js"

function bufferOf(lines: string[]) {
  return { length: lines.length, getLine: (i: number) => (lines[i] === undefined ? undefined : { translateToString: () => lines[i]! }) }
}

describe("tailText", () => {
  it("lấy tối đa N dòng cuối và bỏ dòng trống ở đuôi", () => {
    const r = tailText(bufferOf(["a", "b", "c", "", ""]), 10)
    expect(r).toEqual({ text: "a\nb\nc", lines: 3 })
  })
  it("cắt đúng N dòng cuối", () => {
    expect(tailText(bufferOf(["1", "2", "3", "4"]), 2)).toEqual({ text: "3\n4", lines: 2 })
  })
  it("buffer rỗng → chuỗi rỗng", () => {
    expect(tailText(bufferOf([]), 5)).toEqual({ text: "", lines: 0 })
  })
})
