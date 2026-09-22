import { describe, expect, it } from "bun:test"
import { buildEnv, randomPort } from "../src/lib/terminal.js"
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
