import { describe, expect, it } from "bun:test"
import { openMode, parsePathLink, pathCandidates } from "../src/lib/path-resolve.js"

describe("parsePathLink", () => {
  it("tách path, line, col", () => {
    expect(parsePathLink("src/lib/panel.ts:42:7")).toEqual({ path: "src/lib/panel.ts", line: 42, col: 7 })
    expect(parsePathLink("/tmp/a.txt:3")).toEqual({ path: "/tmp/a.txt", line: 3 })
    expect(parsePathLink("~/x/y.md")).toEqual({ path: "~/x/y.md" })
  })
  it("từ chối chuỗi không phải đường dẫn", () => {
    expect(parsePathLink("hello")).toBeUndefined()
    expect(parsePathLink("http://a/b")).toBeUndefined()
  })
})

describe("pathCandidates", () => {
  it("tuyệt đối → chỉ chính nó; ~ → home; tương đối → cwd rồi từng folder", () => {
    expect(pathCandidates("/a/b", "/cwd", ["/w1", "/w2"], "/home/u")).toEqual(["/a/b"])
    expect(pathCandidates("~/f", "/cwd", ["/w1"], "/home/u")).toEqual(["/home/u/f"])
    expect(pathCandidates("src/x.ts", "/cwd", ["/w1", "/w2"], "/home/u")).toEqual(["/cwd/src/x.ts", "/w1/src/x.ts", "/w2/src/x.ts"])
    expect(pathCandidates("./x", undefined, ["/w1"], "/home/u")).toEqual(["/w1/x"])
  })
})

describe("openMode", () => {
  it("markdown → preview, html → browser, else editor", () => {
    expect(openMode("/w/README.md")).toBe("markdown")
    expect(openMode("/w/notes.MARKDOWN")).toBe("markdown")
    expect(openMode("/w/index.html")).toBe("browser")
    expect(openMode("/w/a.htm")).toBe("browser")
    expect(openMode("/w/a.ts")).toBe("editor")
    expect(openMode("/w/md")).toBe("editor")
  })
})
