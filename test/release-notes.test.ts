import { describe, expect, it } from "bun:test"
// @ts-expect-error — a plain .mjs script with no type declarations
import { releaseNotes } from "../scripts/release-notes.mjs"

const changelog = `# Changelog

## [0.2.1](https://github.com/x302502/cli-code/compare/v0.2.0...v0.2.1) (2026-10-05)

### Features

* a status bar button

### Bug Fixes

* a restart keeps the tab

## 0.2.0

The big one.

### Built-in terminal

- Own terminal
`

describe("releaseNotes", () => {
  it("returns a release-please section, without its heading", () => {
    const notes = releaseNotes(changelog, "0.2.1")
    expect(notes).toContain("### Features")
    expect(notes).toContain("* a restart keeps the tab")
    expect(notes).not.toContain("## [0.2.1]")
    expect(notes).not.toContain("The big one")
  })
  it("returns a hand-written section up to the end of the file", () => {
    expect(releaseNotes(changelog, "0.2.0")).toBe("The big one.\n\n### Built-in terminal\n\n- Own terminal")
  })
  it("is empty for a version with no section, and for a section with no body", () => {
    expect(releaseNotes(changelog, "0.4.0")).toBe("")
    expect(releaseNotes("# Changelog\n\n## 0.5.0\n\n## 0.4.0\n\nx\n", "0.5.0")).toBe("")
  })
  it("does not take 0.2.1 for 0.2.10 or 10.2.1", () => {
    expect(releaseNotes("## 10.2.1\n\nx\n", "0.2.1")).toBe("")
    expect(releaseNotes("## 0.2.10\n\nx\n", "0.2.1")).toBe("")
  })
})
