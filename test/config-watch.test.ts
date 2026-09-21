import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { canAutoRestart, configChangedSince, configPathsFor, newestMtime } from "../src/lib/config-watch.js"

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

describe("configChangedSince", () => {
  it("reports the newest path changed after the spawn, scanning directories two levels deep", () => {
    touch(".codex/config.toml", T0 - 10_000)
    const plugin = touch(".config/opencode/plugins/sub/x.ts", T0 + 5_000)
    expect(configChangedSince([path.join(home, ".codex/config.toml")], T0)).toBeUndefined()
    expect(configChangedSince([path.join(home, ".config/opencode/plugins")], T0)).toBe(path.join(home, ".config/opencode/plugins"))
    // the directory itself was just created, so its own mtime is at least as new as the file
    expect(newestMtime(path.join(home, ".config/opencode/plugins"))!).toBeGreaterThanOrEqual(fs.statSync(plugin).mtimeMs)
    expect(configChangedSince([path.join(home, "missing")], T0)).toBeUndefined()
  })
  it("ignores our own .cli-code.bak and .tmp files inside a directory", () => {
    fs.mkdirSync(path.join(home, ".copilot/hooks"), { recursive: true })
    fs.utimesSync(path.join(home, ".copilot/hooks"), (T0 - 1000) / 1000, (T0 - 1000) / 1000)
    touch(".copilot/hooks/cli-code.json.cli-code.bak", T0 + 5000)
    touch(".copilot/hooks/cli-code.json.tmp", T0 + 5000)
    // touching files bumps the directory mtime; pin it back to before the spawn
    fs.utimesSync(path.join(home, ".copilot/hooks"), (T0 - 1000) / 1000, (T0 - 1000) / 1000)
    expect(configChangedSince([path.join(home, ".copilot/hooks")], T0)).toBeUndefined()
  })
})

describe("canAutoRestart", () => {
  it("only when the agent is idle and the terminal has been quiet", () => {
    expect(canAutoRestart({ state: "done", lastOutputAt: 0, now: 10_000 })).toBe(true)
    expect(canAutoRestart({ state: undefined, lastOutputAt: 0, now: 10_000 })).toBe(true)
    expect(canAutoRestart({ state: "working", lastOutputAt: 0, now: 10_000 })).toBe(false)
    expect(canAutoRestart({ state: "waiting", lastOutputAt: 0, now: 10_000 })).toBe(false)
    expect(canAutoRestart({ state: "done", lastOutputAt: 9_000, now: 10_000 })).toBe(false)
  })
})
