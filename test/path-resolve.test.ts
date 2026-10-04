import { describe, expect, it } from "bun:test"
import { findOpenTab, insideFolders, openMode, parsePathLink, pathCandidates } from "../src/lib/path-resolve.js"

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

describe("insideFolders", () => {
  it("true only for paths under one of the workspace folders", () => {
    expect(insideFolders("/w/docs", ["/w"])).toBe(true)
    expect(insideFolders("/w", ["/w"])).toBe(true)
    expect(insideFolders("/w2/docs", ["/w"])).toBe(false)
    expect(insideFolders("/other", ["/w", "/x"])).toBe(false)
    expect(insideFolders("/w/../elsewhere", ["/w"])).toBe(false)
  })
})

describe("findOpenTab", () => {
  const text = (path: string, group: number, active = false) => ({ kind: "text" as const, path, group, active })
  const preview = (path: string, group: number, active = false) => ({ kind: "markdownPreview" as const, path, group, active })

  it("một file đã mở ở group khác: trả về tab đó để focus thay vì mở tab mới", () => {
    expect(findOpenTab([text("/w/a.ts", 1), text("/w/b.ts", 1)], "/w/b.ts", "editor")).toEqual(text("/w/b.ts", 1))
  })

  it("chưa mở thì không có tab nào: mở tab mới", () => {
    expect(findOpenTab([text("/w/a.ts", 1)], "/w/c.ts", "editor")).toBeUndefined()
  })

  it("so path đã chuẩn hoá (../, dấu / thừa)", () => {
    expect(findOpenTab([text("/w/src/a.ts", 2)], "/w/lib/../src/a.ts", "editor")).toEqual(text("/w/src/a.ts", 2))
  })

  it("mở ở nhiều group: ưu tiên tab đang hiển thị trong group của nó", () => {
    expect(findOpenTab([text("/w/a.ts", 1), text("/w/a.ts", 3, true)], "/w/a.ts", "editor")).toEqual(text("/w/a.ts", 3, true))
  })

  it("markdown chỉ khớp tab preview, không khớp tab source của cùng file (và ngược lại)", () => {
    const tabs = [text("/w/README.md", 1), preview("/w/README.md", 2)]
    expect(findOpenTab(tabs, "/w/README.md", "markdown")).toEqual(preview("/w/README.md", 2))
    expect(findOpenTab([text("/w/README.md", 1)], "/w/README.md", "markdown")).toBeUndefined()
    expect(findOpenTab([preview("/w/a.ts", 1)], "/w/a.ts", "editor")).toBeUndefined()
  })
})
