import { describe, expect, it } from "bun:test"
import { buildEnv, findToolByTabLabel, randomPort, terminalName } from "../src/lib/terminal.js"
import type { CliTool } from "../src/lib/config.js"

const httpTool: CliTool = {
  id: "opencode",
  label: "opencode",
  icon: "opencode.svg",
  themeIcon: "terminal",
  command: "opencode --port {port}",
  hasHttpApi: true,
  portEnvVar: "_PORT",
  extraEnv: { OPENCODE_CALLER: "vscode" },
}

const plainTool: CliTool = {
  id: "claude",
  label: "Claude Code",
  icon: "claude.svg",
  themeIcon: "sparkle",
  command: "claude",
  hasHttpApi: false,
}

describe("terminalName", () => {
  it("returns the label (the icon is shown on the tab, not the name)", () => {
    expect(terminalName(plainTool)).toBe("Claude Code")
    expect(terminalName(httpTool)).toBe("opencode")
  })
})

describe("buildEnv", () => {
  it("includes extraEnv, the tool-id stamp, and the port var for HTTP tools", () => {
    expect(buildEnv(httpTool, 9000)).toEqual({
      _CLI_CODE_TOOL_ID: "opencode",
      OPENCODE_CALLER: "vscode",
      _PORT: "9000",
    })
  })

  it("stamps the tool id even for plain tools", () => {
    expect(buildEnv(plainTool, undefined)).toEqual({ _CLI_CODE_TOOL_ID: "claude" })
  })

  it("omits the port var when no port is given", () => {
    expect(buildEnv(httpTool, undefined)).toEqual({
      _CLI_CODE_TOOL_ID: "opencode",
      OPENCODE_CALLER: "vscode",
    })
  })
})

describe("randomPort", () => {
  it("stays within the ephemeral range across many draws", () => {
    for (let i = 0; i < 1000; i++) {
      const port = randomPort()
      expect(port).toBeGreaterThanOrEqual(16384)
      expect(port).toBeLessThanOrEqual(65535)
    }
  })
})

describe("findToolByTabLabel", () => {
  it("matches exact tool labels", () => {
    expect(findToolByTabLabel("Claude Code")?.id).toBe("claude")
    expect(findToolByTabLabel("Codex CLI")?.id).toBe("codex")
    expect(findToolByTabLabel("Antigravity")?.id).toBe("antigravity")
  })

  it("matches exact tool IDs and binary names", () => {
    expect(findToolByTabLabel("claude")?.id).toBe("claude")
    expect(findToolByTabLabel("codex")?.id).toBe("codex")
    expect(findToolByTabLabel("agy")?.id).toBe("antigravity")
  })

  it("matches dynamic prompt titles (e.g. Claude • <prompt>)", () => {
    expect(findToolByTabLabel("Claude • Fix auth issue in login.ts")?.id).toBe("claude")
    expect(findToolByTabLabel("Claude Code: Refactoring router")?.id).toBe("claude")
    expect(findToolByTabLabel("Codex - Generate unit tests")?.id).toBe("codex")
    expect(findToolByTabLabel("Antigravity • Review PR")?.id).toBe("antigravity")
    expect(findToolByTabLabel("Claude Code (2)")?.id).toBe("claude")
  })

  it("returns undefined for standard non-CLI terminals", () => {
    expect(findToolByTabLabel("zsh")).toBeUndefined()
    expect(findToolByTabLabel("bash")).toBeUndefined()
    expect(findToolByTabLabel("npm run build")).toBeUndefined()
    expect(findToolByTabLabel("")).toBeUndefined()
    expect(findToolByTabLabel(undefined)).toBeUndefined()
  })
})
