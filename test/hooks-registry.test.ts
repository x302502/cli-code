import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { HOOK_COMMAND } from "../src/lib/claude-hooks.js"
import { MANAGED_HEADER } from "../src/lib/hooks/plugin-template.js"
import { STATUS_HOOK_INSTALLERS } from "../src/lib/hooks/registry.js"

// Every installer runs against a throwaway home; the real one is never read or written here.
let home: string
beforeEach(() => (home = fs.mkdtempSync(path.join(os.tmpdir(), "cli-code-hooks-home-"))))
afterEach(() => fs.rmSync(home, { recursive: true, force: true }))

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
  it("codex: a hooks.json entry without its trust table counts as not installed and gets repaired", () => {
    const codex = byId("codex")
    codex.install(home)
    fs.rmSync(path.join(home, ".codex", "config.toml"))
    expect(codex.installed(home)).toBe(false)
    expect(codex.install(home)).toBe(true)
    expect(codex.installed(home)).toBe(true)
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
