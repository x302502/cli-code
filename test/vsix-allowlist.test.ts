import { describe, expect, it } from "bun:test"
// @ts-expect-error — a plain .mjs script with no type declarations
import { unexpectedEntries } from "../scripts/vsix-allowlist.mjs"

const shipped = {
  root: ["extension", "[Content_Types].xml", "extension.vsixmanifest"],
  extension: ["dist", "docs", "images", "media", "node_modules", "package.json", "changelog.md", "LICENSE.txt", "readme.md", "README.ja.md", "README.vi.md", "README.zh.md"],
  nodeModules: ["@xterm", "node-pty"],
}

describe("unexpectedEntries", () => {
  it("accepts what the package ships", () => {
    expect(unexpectedEntries(shipped)).toEqual([])
  })
  it("names the files that only the CI runner has (the 0.2.1 package shipped them)", () => {
    const ext = [...shipped.extension, ".release-please-manifest.json", "release-please-config.json", "linux-prebuilds"]
    expect(unexpectedEntries({ ...shipped, extension: ext })).toEqual([
      "should not ship .release-please-manifest.json",
      "should not ship release-please-config.json",
      "should not ship linux-prebuilds",
    ])
  })
  it("also covers the package root and node_modules", () => {
    expect(unexpectedEntries({ ...shipped, root: [...shipped.root, "stray.txt"], nodeModules: [...shipped.nodeModules, "left-pad"] })).toEqual([
      "should not ship stray.txt (package root)",
      "should not ship node_modules/left-pad",
    ])
  })
  it("compares names without regard to case, as vsce lowercases README and CHANGELOG", () => {
    expect(unexpectedEntries({ ...shipped, extension: ["CHANGELOG.md", "README.md", "package.json"] })).toEqual([])
  })
})
