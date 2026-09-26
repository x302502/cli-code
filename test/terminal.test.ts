import { describe, expect, it } from "bun:test"
import { buildEnv } from "../src/lib/terminal.js"
import type { CliTool } from "../src/lib/config.js"

const httpTool: CliTool = {
  id: "opencode",
  label: "opencode",
  icon: "opencode.svg",
 
  command: "opencode --auto",
  extraEnv: { OPENCODE_CALLER: "vscode" },
}

const plainTool: CliTool = {
  id: "claude",
  label: "Claude Code",
  icon: "claude.svg",
 
  command: "claude",
}

describe("buildEnv", () => {
  it("is the tool's extraEnv", () => {
    expect(buildEnv(httpTool)).toEqual({ OPENCODE_CALLER: "vscode" })
    expect(buildEnv(plainTool)).toEqual({})
  })
})
