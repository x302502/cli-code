import { describe, expect, it } from "bun:test"
import { CLI_TOOLS } from "../src/lib/config.js"

describe("CLI_TOOLS", () => {
  it("has unique ids", () => {
    const ids = CLI_TOOLS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("gives every tool a non-empty label, command and icon", () => {
    for (const tool of CLI_TOOLS) {
      expect(tool.label.length).toBeGreaterThan(0)
      expect(tool.command.length).toBeGreaterThan(0)
      expect(tool.icon.length, `${tool.id} needs an icon`).toBeGreaterThan(0)
      expect(tool.icon, `${tool.id} icon must be svg or png`).toMatch(/\.(svg|png)$/)
    }
  })

})

describe("resume commands", () => {
  it("claude/grok/codex có resumeCommand với {sessionId}", () => {
    for (const id of ["claude", "grok", "codex"]) {
      const t = CLI_TOOLS.find((x) => x.id === id)!
      expect(t.resumeCommand).toContain("{sessionId}")
    }
  })
  it("các CLI có kho phiên riêng: cả continueCommand lẫn resumeCommand theo id", () => {
    for (const id of ["copilot", "opencode", "omp", "amp", "droid", "pi", "cline", "kimi", "cursor", "goose", "antigravity"]) {
      const t = CLI_TOOLS.find((x) => x.id === id)!
      // cline has no --continue; amp's (`--last`) ignores the folder, so it is left out on purpose.
      expect(t.continueCommand || id === "cline" || id === "amp").toBeTruthy()
      expect(t.resumeCommand).toContain("{sessionId}")
    }
  })
  it("các CLI chỉ có --continue", () => {
    for (const id of ["aider", "continue", "crush", "hermes", "devin"]) {
      const t = CLI_TOOLS.find((x) => x.id === id)!
      expect(t.continueCommand).toBeTruthy()
      expect(t.resumeCommand).toBeUndefined()
    }
  })
})
