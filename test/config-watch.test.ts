import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { canAutoRestart, changedPath, configPathsFor, configSnapshot, newestMtime } from "../src/lib/config-watch.js"

let home: string
beforeEach(() => (home = fs.mkdtempSync(path.join(os.tmpdir(), "cli-code-cfg-"))))
afterEach(() => fs.rmSync(home, { recursive: true, force: true }))
const touch = (rel: string, mtimeMs: number) => {
  const p = path.join(home, rel)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, "x")
  fs.utimesSync(p, mtimeMs / 1000, mtimeMs / 1000)
  return p
}
const T0 = Date.now() - 60_000

describe("configPathsFor", () => {
  it("lists the CLI's home and project config locations; agent-teams follows claude; unknown CLIs have none", () => {
    expect(configPathsFor("codex", undefined, "/w/proj", "/h")).toEqual(["/h/.codex/config.toml", "/h/.codex/hooks.json", "/w/proj/.codex/config.toml", "/w/proj/.codex/hooks.json"])
    expect(configPathsFor("claude-agent-teams", "claude", undefined, "/h")).toEqual(["/h/.claude/settings.json", "/h/.claude/settings.local.json", "/h/.claude.json"])
    expect(configPathsFor("aider", undefined, "/w", "/h")).toEqual([])
  })
})

describe("configSnapshot / changedPath", () => {
  it("names the path whose content changed; untouched and missing paths stay quiet", () => {
    const toml = touch(".codex/hooks.json", T0 - 10_000)
    const plugins = path.join(home, ".config/opencode/plugins")
    touch(".config/opencode/plugins/a.ts", T0)
    const before = configSnapshot([toml, plugins, path.join(home, "missing")])
    expect(changedPath(before, configSnapshot([toml, plugins, path.join(home, "missing")]))).toBeUndefined()
    fs.writeFileSync(toml, "changed")
    expect(changedPath(before, configSnapshot([toml, plugins]))).toBe(toml)
    touch(".config/opencode/plugins/b.ts", T0 + 5000)
    expect(changedPath(configSnapshot([plugins]), configSnapshot([plugins]))).toBeUndefined()
  })
  it("a config file created after the snapshot counts as a change (checkStale re-reads only the snapshot's keys)", () => {
    const mcp = path.join(home, "proj/.mcp.json")
    const before = configSnapshot([mcp])
    expect(changedPath(before, configSnapshot(Object.keys(before)))).toBeUndefined()
    touch("proj/.mcp.json", T0)
    expect(changedPath(before, configSnapshot(Object.keys(before)))).toBe(mcp)
  })
  it("ignores our own .cli-code.bak and .tmp files inside a directory", () => {
    const dir = path.join(home, ".copilot/hooks")
    touch(".copilot/hooks/cli-code.json", T0)
    const before = configSnapshot([dir])
    touch(".copilot/hooks/cli-code.json.cli-code.bak", T0 + 5000)
    touch(".copilot/hooks/cli-code.json.tmp", T0 + 5000)
    expect(changedPath(before, configSnapshot([dir]))).toBeUndefined()
  })
  it("~/.claude.json: only the MCP servers count — Claude rewrites the rest of the file constantly", () => {
    const f = path.join(home, ".claude.json")
    touch(".claude.json", T0)
    fs.writeFileSync(f, JSON.stringify({ mcpServers: { a: { command: "x" } }, projects: { "/w/proj": { mcpServers: {}, history: [1] } }, numStartups: 1 }))
    const before = configSnapshot([f])
    fs.writeFileSync(f, JSON.stringify({ mcpServers: { a: { command: "x" } }, projects: { "/w/proj": { mcpServers: {}, history: [1, 2] } }, numStartups: 2 }))
    expect(changedPath(before, configSnapshot([f]))).toBeUndefined()
    fs.writeFileSync(f, JSON.stringify({ mcpServers: { a: { command: "x" }, b: { url: "http://x" } }, numStartups: 2 }))
    expect(changedPath(before, configSnapshot([f]))).toBe(f)
  })
  it("~/.codex/config.toml: only [mcp_servers.*] and [hooks.*] tables count — Codex writes notices and trust itself", () => {
    const f = path.join(home, ".codex/config.toml")
    touch(".codex/config.toml", T0)
    const base = 'model = "gpt-5"\n\n[mcp_servers.a]\ncommand = "npx"\n\n[notice.model_migrations]\n"gpt-5.2" = "gpt-5.4"\n'
    fs.writeFileSync(f, base)
    const before = configSnapshot([f])
    fs.writeFileSync(f, base + '\n[projects."/x"]\ntrust_level = "trusted"\n\n[tui.model_availability_nux]\n"gpt-5.5" = 4\n')
    expect(changedPath(before, configSnapshot([f]))).toBeUndefined()
    fs.writeFileSync(f, base.replace('command = "npx"', 'command = "node"'))
    expect(changedPath(before, configSnapshot([f]))).toBe(f)
  })
})

describe("canAutoRestart", () => {
  it("only when a hook said the agent is done and the terminal has been quiet — never on a guess", () => {
    expect(canAutoRestart({ state: "done", lastOutputAt: 0, now: 10_000 })).toBe(true)
    // No hook, no state: the agent may well be working (CLIs without hooks) — notice only.
    expect(canAutoRestart({ state: undefined, lastOutputAt: 0, now: 10_000 })).toBe(false)
    expect(canAutoRestart({ state: "working", lastOutputAt: 0, now: 10_000 })).toBe(false)
    expect(canAutoRestart({ state: "waiting", lastOutputAt: 0, now: 10_000 })).toBe(false)
    expect(canAutoRestart({ state: "done", lastOutputAt: 9_000, now: 10_000 })).toBe(false)
  })
  it("never while a prompt is typed but not yet sent — a restart would throw it away", () => {
    expect(canAutoRestart({ state: "done", lastOutputAt: 0, now: 10_000, hasDraft: true })).toBe(false)
  })
})
