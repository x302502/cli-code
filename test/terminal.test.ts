import { afterEach, describe, expect, it } from "bun:test"
import { makeTerminal, makeTerminalTab, resetVscodeMock, state } from "./vscode-mock.js"
import { buildEnv, findCliColumn, randomPort, readTerminalPort, terminalName } from "../src/lib/terminal.js"
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

describe("findCliColumn", () => {
  afterEach(resetVscodeMock)

  it("returns undefined when no CLI terminal tab is open", () => {
    state.tabGroups = [{ viewColumn: 1, tabs: [{ label: "index.ts", input: {} }] }]
    expect(findCliColumn()).toBeUndefined()
  })

  it("returns the column of the group hosting a CLI terminal tab", () => {
    state.tabGroups = [
      { viewColumn: 1, tabs: [{ label: "index.ts", input: {} }] },
      { viewColumn: 2, tabs: [makeTerminalTab("Claude Code")] },
    ]
    expect(findCliColumn()).toBe(2)
  })

  it("ignores non-terminal tabs that happen to share a CLI name", () => {
    state.tabGroups = [{ viewColumn: 3, tabs: [{ label: "Claude Code", input: {} }] }]
    expect(findCliColumn()).toBeUndefined()
  })

  it("matches a tab retitled by the CLI via a live terminal's env stamp", () => {
    state.terminals = [makeTerminal("Pull các FE từ nhánh chính", { _CLI_CODE_TOOL_ID: "claude" })]
    state.tabGroups = [
      { viewColumn: 1, tabs: [{ label: "index.ts", input: {} }] },
      { viewColumn: 2, tabs: [makeTerminalTab("Pull các FE từ nhánh chính")] },
    ]
    expect(findCliColumn()).toBe(2)
  })
})

describe("readTerminalPort", () => {
  it("parses the port from the terminal env", () => {
    const terminal = makeTerminal("opencode", { _PORT: "12345" })
    expect(readTerminalPort(terminal as never, "_PORT")).toBe(12345)
  })

  it("returns undefined when the env var is missing", () => {
    const terminal = makeTerminal("opencode", { OTHER: "x" })
    expect(readTerminalPort(terminal as never, "_PORT")).toBeUndefined()
  })

  it("returns undefined when the terminal has no env", () => {
    const terminal = makeTerminal("claude")
    expect(readTerminalPort(terminal as never, "_PORT")).toBeUndefined()
  })
})

describe("findToolByTabLabel", () => {
  it("matches exact tool labels", () => {
    const { findToolByTabLabel } = require("../src/lib/terminal.js")
    expect(findToolByTabLabel("Claude Code")?.id).toBe("claude")
    expect(findToolByTabLabel("Codex CLI")?.id).toBe("codex")
    expect(findToolByTabLabel("Antigravity")?.id).toBe("antigravity")
  })

  it("matches exact tool IDs and binary names", () => {
    const { findToolByTabLabel } = require("../src/lib/terminal.js")
    expect(findToolByTabLabel("claude")?.id).toBe("claude")
    expect(findToolByTabLabel("codex")?.id).toBe("codex")
    expect(findToolByTabLabel("agy")?.id).toBe("antigravity")
  })

  it("matches dynamic prompt titles (e.g. Claude • <prompt>)", () => {
    const { findToolByTabLabel } = require("../src/lib/terminal.js")
    expect(findToolByTabLabel("Claude • Fix auth issue in login.ts")?.id).toBe("claude")
    expect(findToolByTabLabel("Claude Code: Refactoring router")?.id).toBe("claude")
    expect(findToolByTabLabel("Codex - Generate unit tests")?.id).toBe("codex")
    expect(findToolByTabLabel("Antigravity • Review PR")?.id).toBe("antigravity")
    expect(findToolByTabLabel("Claude Code (2)")?.id).toBe("claude")
  })

  it("returns undefined for standard non-CLI terminals", () => {
    const { findToolByTabLabel } = require("../src/lib/terminal.js")
    expect(findToolByTabLabel("zsh")).toBeUndefined()
    expect(findToolByTabLabel("bash")).toBeUndefined()
    expect(findToolByTabLabel("npm run build")).toBeUndefined()
    expect(findToolByTabLabel("")).toBeUndefined()
    expect(findToolByTabLabel(undefined)).toBeUndefined()
  })
})

describe("findToolForTerminal", () => {
  it("finds tool by env stamp even if renamed", () => {
    const { findToolForTerminal } = require("../src/lib/terminal.js")
    const terminal = makeTerminal("Custom Random Name", { _CLI_CODE_TOOL_ID: "antigravity" })
    expect(findToolForTerminal(terminal as never)?.id).toBe("antigravity")
  })

  it("finds tool by dynamic tab name when env is missing (after reload)", () => {
    const { findToolForTerminal } = require("../src/lib/terminal.js")
    const terminal = makeTerminal("Claude • Fix auth issue")
    expect(findToolForTerminal(terminal as never)?.id).toBe("claude")
  })
})
