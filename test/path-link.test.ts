import { describe, expect, it } from "bun:test"
import { findPathTokens, parsePathLink } from "../src/lib/path-link.js"
import { classifyOscLink } from "../src/lib/osc-link.js"
import { resolveLinkTarget } from "../src/lib/path-resolve.js"

describe("parsePathLink — bare filenames and trailing punctuation", () => {
  it("well-known extension-less names and name.ext tokens are paths", () => {
    expect(parsePathLink("README")).toEqual({ path: "README" })
    expect(parsePathLink("Makefile")).toEqual({ path: "Makefile" })
    expect(parsePathLink("README.md")).toEqual({ path: "README.md" })
    expect(parsePathLink("package.json:3")).toEqual({ path: "package.json", line: 3 })
    expect(parsePathLink("app.ts:12:3")).toEqual({ path: "app.ts", line: 12, col: 3 })
  })
  it("directory forms: trailing slash, ./dir, ~/dir, absolute", () => {
    expect(parsePathLink("notes/")).toEqual({ path: "notes/" })
    expect(parsePathLink("./notes")).toEqual({ path: "./notes" })
    expect(parsePathLink("~/Desktop")).toEqual({ path: "~/Desktop" })
    expect(parsePathLink("/Volumes/Data/x/")).toEqual({ path: "/Volumes/Data/x/" })
    expect(parsePathLink("docs")).toBeUndefined()
  })
  it("plain words, versions and domains are not paths", () => {
    expect(parsePathLink("hello")).toBeUndefined()
    expect(parsePathLink("v1.2")).toBeUndefined()
    expect(parsePathLink("1.5")).toBeUndefined()
    expect(parsePathLink("e.g")).toBeUndefined()
  })
})

describe("findPathTokens — tokens inside a terminal row", () => {
  const tokens = (s: string) => findPathTokens(s).map((t) => [t.text, t.start])
  it("trims trailing punctuation and brackets, keeps :line:col", () => {
    expect(tokens("Read(src/x.ts) done.")).toEqual([["src/x.ts", 5]])
    expect(tokens('see "src/lib/panel.ts:12:3", then')).toEqual([["src/lib/panel.ts:12:3", 5]])
    expect(tokens("open src/a.ts. next")).toEqual([["src/a.ts", 5]])
    expect(tokens("⎿  Read docs/guide.md;")).toEqual([["docs/guide.md", 8]])
  })
  it("finds several tokens on one row and bare names", () => {
    expect(tokens("open src/file.txt and docs/readme.md")).toEqual([
      ["src/file.txt", 5],
      ["docs/readme.md", 22],
    ])
    expect(tokens("edit README then package.json")).toEqual([
      ["README", 5],
      ["package.json", 17],
    ])
  })
  it("skips URLs (handled by the web-links addon)", () => {
    expect(tokens("go to https://example.com/a/b.ts now")).toEqual([])
  })
})

describe("classifyOscLink — line and column forms", () => {
  it("#L12C4 and :12:4 suffixes", () => {
    expect(classifyOscLink("file:///w/a.ts#L12C4")).toEqual({ kind: "path", path: "/w/a.ts", line: 12, col: 4 })
    expect(classifyOscLink("file:///w/a.ts:12:4")).toEqual({ kind: "path", path: "/w/a.ts", line: 12, col: 4 })
    expect(classifyOscLink("file:///w/a.ts:12")).toEqual({ kind: "path", path: "/w/a.ts", line: 12 })
  })
})

describe("resolveLinkTarget — first existing candidate, file or directory", () => {
  const stat = (p: string) => (({ "/w/src/a.ts": "file", "/w/docs": "dir", "/home/u/x.md": "file" }) as Record<string, "file" | "dir">)[p]
  it("resolves relative to cwd first, then workspace folders, then ~", () => {
    expect(resolveLinkTarget({ path: "src/a.ts", line: 2 }, "/w", ["/other", "/w"], "/home/u", stat)).toEqual({ path: "/w/src/a.ts", kind: "file", line: 2 })
    expect(resolveLinkTarget({ path: "docs" }, "/elsewhere", ["/w"], "/home/u", stat)).toEqual({ path: "/w/docs", kind: "dir" })
    expect(resolveLinkTarget({ path: "~/x.md" }, "/w", [], "/home/u", stat)).toEqual({ path: "/home/u/x.md", kind: "file" })
  })
  it("returns undefined when nothing exists", () => {
    expect(resolveLinkTarget({ path: "nope.ts" }, "/w", ["/w"], "/home/u", stat)).toBeUndefined()
  })
})

describe("Vietnamese / non-ASCII paths", () => {
  it("letters with diacritics are path characters (NFC and NFD)", () => {
    expect(parsePathLink("docs/hướng-dẫn.md:3")).toEqual({ path: "docs/hướng-dẫn.md", line: 3 })
    expect(parsePathLink("ghi-chú.md")).toEqual({ path: "ghi-chú.md" })
    const nfd = "tài liệu/báo-cáo.md".normalize("NFD")
    expect(parsePathLink(nfd.replace(" ", "-"))).toEqual({ path: nfd.replace(" ", "-") })
    expect(findPathTokens("xem docs/hướng-dẫn.md nhé").map((t) => [t.text, t.start])).toEqual([["docs/hướng-dẫn.md", 4]])
  })
})
