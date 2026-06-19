import { afterEach, describe, expect, it } from "bun:test"
import { makeTerminal, makeTerminalTab, resetVscodeMock, state } from "./vscode-mock.js"
import { buildEnv, findCliColumn, randomPort, readTerminalPort, terminalName } from "../src/lib/terminal.js"
import type { CliTool } from "../src/lib/config.js"

const httpTool: CliTool = {
  id: "opencode",
  label: "opencode",
  emoji: "🔓",
  command: "opencode --port {port}",
  hasHttpApi: true,
  portEnvVar: "_PORT",
  extraEnv: { OPENCODE_CALLER: "vscode" },
}

const plainTool: CliTool = {
  id: "claude",
  label: "Claude Code",
  emoji: "🟠",
  command: "claude",
  hasHttpApi: false,
}

describe("terminalName", () => {
  it("combines the emoji and label", () => {
    expect(terminalName(plainTool)).toBe("🟠 Claude Code")
    expect(terminalName(httpTool)).toBe("🔓 opencode")
  })
})

describe("buildEnv", () => {
  it("includes extraEnv and the port var for HTTP tools", () => {
    expect(buildEnv(httpTool, 9000)).toEqual({
      OPENCODE_CALLER: "vscode",
      _PORT: "9000",
    })
  })

  it("returns an empty env for plain tools", () => {
    expect(buildEnv(plainTool, undefined)).toEqual({})
  })

  it("omits the port var when no port is given", () => {
    expect(buildEnv(httpTool, undefined)).toEqual({ OPENCODE_CALLER: "vscode" })
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
      { viewColumn: 2, tabs: [makeTerminalTab("🟠 Claude Code")] },
    ]
    expect(findCliColumn()).toBe(2)
  })

  it("ignores non-terminal tabs that happen to share a CLI name", () => {
    state.tabGroups = [{ viewColumn: 3, tabs: [{ label: "🟠 Claude Code", input: {} }] }]
    expect(findCliColumn()).toBeUndefined()
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
