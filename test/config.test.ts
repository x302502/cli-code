import { describe, expect, it } from "bun:test"
import { CLI_TOOLS } from "../src/lib/config.js"

describe("CLI_TOOLS", () => {
  it("has unique ids", () => {
    const ids = CLI_TOOLS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("gives every tool a non-empty label, command, icon, and themeIcon", () => {
    for (const tool of CLI_TOOLS) {
      expect(tool.label.length).toBeGreaterThan(0)
      expect(tool.command.length).toBeGreaterThan(0)
      expect(tool.icon.length, `${tool.id} needs an icon`).toBeGreaterThan(0)
      expect(tool.icon, `${tool.id} icon must be svg or png`).toMatch(/\.(svg|png)$/)
      expect(tool.themeIcon.length, `${tool.id} needs a themeIcon`).toBeGreaterThan(0)
    }
  })

  it("requires HTTP-aware tools to define the fields they need", () => {
    for (const tool of CLI_TOOLS.filter((t) => t.hasHttpApi)) {
      expect(tool.portEnvVar, `${tool.id} needs portEnvVar`).toBeDefined()
      expect(tool.appendPromptPath, `${tool.id} needs appendPromptPath`).toBeDefined()
      expect(tool.readyCheckPath, `${tool.id} needs readyCheckPath`).toBeDefined()
      expect(tool.command, `${tool.id} command must template the port`).toContain("{port}")
    }
  })

  it("does not put a {port} placeholder on non-HTTP tools", () => {
    for (const tool of CLI_TOOLS.filter((t) => !t.hasHttpApi)) {
      expect(tool.command).not.toContain("{port}")
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
      expect(t.continueCommand || id === "cline").toBeTruthy()
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
