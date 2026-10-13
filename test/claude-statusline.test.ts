import { describe, expect, it } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { STATUSLINE_COMMAND, isClaudeFamily, resolveUserStatusLine, statuslineSettingsArg } from "../src/lib/claude-statusline.js"

describe("statuslineSettingsArg", () => {
  it("one --settings with our statusLine, quoted for sh", () => {
    const arg = statuslineSettingsArg()
    expect(arg.startsWith("--settings '")).toBe(true)
    const json = JSON.parse(arg.slice("--settings '".length, -1).replaceAll(`'\\''`, "'"))
    expect(json).toEqual({ statusLine: { type: "command", command: STATUSLINE_COMMAND } })
  })
})

describe("resolveUserStatusLine — Claude's own precedence", () => {
  it("local project, then project, then user; none → undefined", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sl-"))
    const cwd = path.join(root, "p")
    const home = path.join(root, "h")
    const write = (file: string, v: unknown) => {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, JSON.stringify(v))
    }
    expect(resolveUserStatusLine(cwd, home)).toBeUndefined()
    write(path.join(home, ".claude/settings.json"), { statusLine: { type: "command", command: "user-cmd" } })
    expect(resolveUserStatusLine(cwd, home)).toBe("user-cmd")
    write(path.join(cwd, ".claude/settings.json"), { statusLine: { type: "command", command: "project-cmd" } })
    expect(resolveUserStatusLine(cwd, home)).toBe("project-cmd")
    write(path.join(cwd, ".claude/settings.local.json"), { statusLine: { command: "local-cmd" } })
    expect(resolveUserStatusLine(cwd, home)).toBe("local-cmd")
    fs.writeFileSync(path.join(cwd, ".claude/settings.local.json"), "{ broken")
    expect(resolveUserStatusLine(cwd, home)).toBe("project-cmd")
  })
})

describe("isClaudeFamily", () => {
  it("claude and tools whose history is claude's", () => {
    expect(isClaudeFamily({ id: "claude" })).toBe(true)
    expect(isClaudeFamily({ id: "claude-agent-teams", historyToolId: "claude" })).toBe(true)
    expect(isClaudeFamily({ id: "codex" })).toBe(false)
  })
})
