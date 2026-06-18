import { describe, expect, it } from "bun:test"
import { CLI_TOOLS } from "../src/lib/config.js"

describe("CLI_TOOLS", () => {
  it("has unique ids", () => {
    const ids = CLI_TOOLS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("gives every tool a non-empty label and command", () => {
    for (const tool of CLI_TOOLS) {
      expect(tool.label.length).toBeGreaterThan(0)
      expect(tool.command.length).toBeGreaterThan(0)
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
