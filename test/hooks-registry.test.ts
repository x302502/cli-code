import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { HOOK_COMMAND } from "../src/lib/claude-hooks.js"
import { MANAGED_HEADER } from "../src/lib/hooks/plugin-template.js"
import { GROK_HOOK_COMMAND, STATUS_HOOK_INSTALLERS } from "../src/lib/hooks/registry.js"

// Every installer runs against a throwaway home; the real one is never read or written here.
let home: string
// A developer's own CODEX_HOME must never redirect these tests to their real Codex folder.
const savedCodexHome = process.env.CODEX_HOME
beforeEach(() => {
  delete process.env.CODEX_HOME
  home = fs.mkdtempSync(path.join(os.tmpdir(), "cli-code-hooks-home-"))
})
afterEach(() => {
  if (savedCodexHome === undefined) delete process.env.CODEX_HOME
  else process.env.CODEX_HOME = savedCodexHome
  fs.rmSync(home, { recursive: true, force: true })
})

const byId = (id: string) => STATUS_HOOK_INSTALLERS.find((i) => i.id === id)!
const write = (rel: string, text: string) => {
  const p = path.join(home, rel)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, text)
}
const read = (rel: string) => fs.readFileSync(path.join(home, rel), "utf8")

describe("status hook installers", () => {
  it("every installer round-trips: install → installed → uninstall → not installed, and repeats are no-ops", () => {
    for (const inst of STATUS_HOOK_INSTALLERS) {
      expect(inst.installed(home)).toBe(false)
      expect(inst.install(home)).toBe(true)
      expect(inst.installed(home)).toBe(true)
      expect(inst.install(home)).toBe(false)
      for (const f of inst.files(home)) expect(fs.existsSync(f)).toBe(true)
      expect(inst.uninstall(home)).toBe(true)
      expect(inst.installed(home)).toBe(false)
      expect(inst.uninstall(home)).toBe(false)
    }
  })
  it("droid: merges into ~/.factory/settings.json next to the user's hooks and other keys", () => {
    write(".factory/settings.json", '{"model":"x","hooks":{"Stop":[{"hooks":[{"type":"command","command":"say done"}]}]}}')
    byId("droid").install(home)
    const s = JSON.parse(read(".factory/settings.json"))
    expect(s.model).toBe("x")
    expect(s.hooks.Stop.map((g: { hooks: { command: string }[] }) => g.hooks[0]!.command)).toEqual(["say done", HOOK_COMMAND])
    expect(Object.keys(s.hooks).sort()).toEqual(["Notification", "Stop", "UserPromptSubmit"])
    expect(read(".factory/settings.json.cli-code.bak")).toContain('"say done"')
    byId("droid").uninstall(home)
    expect(JSON.parse(read(".factory/settings.json")).hooks.Stop.length).toBe(1)
  })
  it("codex: appends our group to hooks.json and trust tables to config.toml; uninstall removes both", () => {
    write(".codex/hooks.json", '{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"mine","timeout":5}]}]}}')
    write(".codex/config.toml", 'model = "gpt-5"\n\n[hooks.state."/x/hooks.json:stop:0:0"]\ntrusted_hash = "sha256:user"\n')
    const codex = byId("codex")
    codex.install(home)
    const hooks = JSON.parse(read(".codex/hooks.json")).hooks
    expect(hooks.Stop[0].hooks[0].command).toBe("mine")
    expect(hooks.Stop[1].hooks[0]).toEqual({ type: "command", command: HOOK_COMMAND, timeout: 10 })
    const toml = read(".codex/config.toml")
    const hooksFile = path.join(home, ".codex", "hooks.json")
    for (const key of ["stop:1:0", "user_prompt_submit:0:0", "permission_request:0:0"]) {
      expect(toml).toContain(`[hooks.state."${hooksFile}:${key}"]\nenabled = true\ntrusted_hash = "sha256:`)
    }
    expect(toml).toContain('trusted_hash = "sha256:user"')
    expect(codex.installed(home)).toBe(true)
    codex.uninstall(home)
    expect(read(".codex/config.toml")).toBe('model = "gpt-5"\n\n[hooks.state."/x/hooks.json:stop:0:0"]\ntrusted_hash = "sha256:user"\n')
    expect(JSON.parse(read(".codex/hooks.json")).hooks.Stop.length).toBe(1)
  })
  it("codex: follows CODEX_HOME, the folder Codex itself reads, and leaves ~/.codex alone", () => {
    const custom = path.join(home, "custom-codex")
    process.env.CODEX_HOME = custom
    expect(byId("codex").install(home)).toBe(true)
    expect(fs.existsSync(path.join(custom, "hooks.json"))).toBe(true)
    expect(read("custom-codex/config.toml")).toContain(`[hooks.state."${path.join(custom, "hooks.json")}:stop:0:0"]`)
    expect(fs.existsSync(path.join(home, ".codex"))).toBe(false)
  })
  it("rewrites keep a file's permissions; new files are private (0600)", () => {
    if (process.platform === "win32") return
    write(".factory/settings.json", "{}")
    fs.chmodSync(path.join(home, ".factory/settings.json"), 0o600)
    write(".codex/config.toml", 'model = "x"\n')
    fs.chmodSync(path.join(home, ".codex/config.toml"), 0o640)
    byId("droid").install(home)
    byId("codex").install(home)
    const mode = (rel: string) => fs.statSync(path.join(home, rel)).mode & 0o777
    expect(mode(".factory/settings.json")).toBe(0o600)
    expect(mode(".codex/config.toml")).toBe(0o640)
    expect(mode(".codex/hooks.json")).toBe(0o600)
    expect(mode(".factory/settings.json.cli-code.bak")).toBe(0o600)
  })
  it("codex: a hooks.json entry without its trust table counts as not installed and gets repaired", () => {
    const codex = byId("codex")
    codex.install(home)
    fs.rmSync(path.join(home, ".codex", "config.toml"))
    expect(codex.installed(home)).toBe(false)
    expect(codex.install(home)).toBe(true)
    expect(codex.installed(home)).toBe(true)
  })
  it("copilot and grok never remove a cli-code.json they did not write (turning statusHooks off runs uninstall unattended)", () => {
    for (const id of ["copilot", "grok"]) {
      const file = byId(id).files(home)[0]!
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "echo mine" }] }] } }))
      expect(byId(id).installed(home)).toBe(false)
      expect(byId(id).uninstall(home)).toBe(false)
      expect(fs.existsSync(file)).toBe(true)
    }
  })
  it("copilot and grok refuse to overwrite a cli-code.json they did not write (install runs unattended)", () => {
    for (const id of ["copilot", "grok"]) {
      const file = byId(id).files(home)[0]!
      const mine = JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "echo mine" }] }] } })
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, mine)
      expect(() => byId(id).install(home)).toThrow(/not managed/)
      expect(fs.readFileSync(file, "utf8")).toBe(mine)
    }
  })
  it("an outdated cli-code.json of ours (older hook line) is rewritten and removable", () => {
    const file = byId("grok").files(home)[0]!
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: HOOK_COMMAND }] }] } }))
    expect(byId("grok").install(home)).toBe(true)
    expect(byId("grok").installed(home)).toBe(true)
    fs.writeFileSync(file, JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: HOOK_COMMAND }] }] } }))
    expect(byId("grok").uninstall(home)).toBe(true)
    expect(fs.existsSync(file)).toBe(false)
  })
  it("copilot and grok own their file; other files in the hooks dir are untouched", () => {
    write(".copilot/hooks/mine.json", "{}")
    byId("copilot").install(home)
    expect(JSON.parse(read(".copilot/hooks/cli-code.json")).version).toBe(1)
    byId("copilot").uninstall(home)
    expect(fs.existsSync(path.join(home, ".copilot/hooks/mine.json"))).toBe(true)
    expect(fs.existsSync(path.join(home, ".copilot/hooks/cli-code.json"))).toBe(false)
    byId("grok").install(home)
    const grok = JSON.parse(read(".grok/hooks/cli-code.json")).hooks
    expect(Object.keys(grok).sort()).toEqual(["Notification", "Stop", "StopCancelled", "StopFailure", "UserPromptSubmit"])
    // Grok validates `$VAR` references before running a hook; ours must not contain one.
    expect(grok.Stop[0].hooks[0].command).toBe(GROK_HOOK_COMMAND)
    expect(grok.Stop[0].hooks[0].command).not.toMatch(/\$[A-Z_{]/)
  })
  it("plugins: managed header, refuses to overwrite a user's file of the same name, never deletes it", () => {
    byId("opencode").install(home)
    expect(read(".config/opencode/plugins/cli-code-status.ts").startsWith(MANAGED_HEADER)).toBe(true)
    write(".pi/agent/extensions/cli-code-status.ts", "export default function () {}")
    expect(() => byId("pi").install(home)).toThrow(/not managed/)
    expect(byId("pi").uninstall(home)).toBe(false)
    expect(read(".pi/agent/extensions/cli-code-status.ts")).toBe("export default function () {}")
  })
  it("an outdated managed plugin is rewritten in place", () => {
    write(".omp/agent/extensions/cli-code-status.ts", `${MANAGED_HEADER}\n// old body\n`)
    expect(byId("omp").installed(home)).toBe(false)
    expect(byId("omp").install(home)).toBe(true)
    expect(byId("omp").installed(home)).toBe(true)
  })
})
