import { describe, expect, it } from "bun:test"
import { classifyOscLink } from "../src/lib/osc-link.js"

describe("classifyOscLink", () => {
  it("http/https/mailto → link", () => {
    expect(classifyOscLink("https://claude.ai/docs")).toEqual({ kind: "link", uri: "https://claude.ai/docs" })
    expect(classifyOscLink("http://x.test/a?b=1")).toEqual({ kind: "link", uri: "http://x.test/a?b=1" })
    expect(classifyOscLink("mailto:a@b.c")).toEqual({ kind: "link", uri: "mailto:a@b.c" })
  })
  it("file:// → path (percent-decoded, host dropped)", () => {
    expect(classifyOscLink("file:///Volumes/Data/x%20y.ts")).toEqual({ kind: "path", path: "/Volumes/Data/x y.ts" })
    expect(classifyOscLink("file://localhost/tmp/a.ts")).toEqual({ kind: "path", path: "/tmp/a.ts" })
  })
  it("file:// with a line fragment keeps the line", () => {
    expect(classifyOscLink("file:///w/a.ts#L12")).toEqual({ kind: "path", path: "/w/a.ts", line: 12 })
    expect(classifyOscLink("file:///w/a.ts#12")).toEqual({ kind: "path", path: "/w/a.ts", line: 12 })
  })
  it("a scheme-less relative path (OMP's markdown links) → path, line suffix kept", () => {
    expect(classifyOscLink("explorations/2026-10-11-sdp-operator.md")).toEqual({ kind: "path", path: "explorations/2026-10-11-sdp-operator.md" })
    expect(classifyOscLink("src/a.ts:12:4")).toEqual({ kind: "path", path: "src/a.ts", line: 12, col: 4 })
    expect(classifyOscLink("README.md")).toEqual({ kind: "path", path: "README.md" })
  })
  it("GitHub-style line fragments on relative and file:// paths; a range opens at its start", () => {
    expect(classifyOscLink("src/a.ts#L12")).toEqual({ kind: "path", path: "src/a.ts", line: 12 })
    expect(classifyOscLink("src/a.ts#L12C4")).toEqual({ kind: "path", path: "src/a.ts", line: 12, col: 4 })
    expect(classifyOscLink("src/a.ts#L12-L20")).toEqual({ kind: "path", path: "src/a.ts", line: 12 })
    expect(classifyOscLink("file:///w/a.ts#L12-L20")).toEqual({ kind: "path", path: "/w/a.ts", line: 12 })
    expect(classifyOscLink("src/a.ts#intro")).toEqual({ kind: "path", path: "src/a.ts" })
  })
  it("other schemes and junk → copy-only", () => {
    expect(classifyOscLink("javascript:alert(1)")).toEqual({ kind: "other" })
    expect(classifyOscLink("vscode://x")).toEqual({ kind: "other" })
    expect(classifyOscLink("file://")).toEqual({ kind: "other" })
    expect(classifyOscLink("HTTPS://UPPER.test")).toEqual({ kind: "link", uri: "HTTPS://UPPER.test" })
  })
})
