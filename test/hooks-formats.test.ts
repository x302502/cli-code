import { describe, expect, it } from "bun:test"
import { HOOK_COMMAND, hooksInstalled, installHooks, uninstallHooks } from "../src/lib/claude-hooks.js"
import { codexHookHash, codexTrustKeys, addTrust, removeTrust } from "../src/lib/hooks/codex-trust.js"
import { copilotFile, copilotInstalled } from "../src/lib/hooks/copilot.js"

describe("claude-format merge with a custom event list (droid, codex, grok)", () => {
  it("registers only the given events and can carry a timeout", () => {
    const { settings } = installHooks({}, ["UserPromptSubmit", "Stop"], 10)
    const hooks = settings.hooks as Record<string, { hooks: { command: string; timeout?: number }[] }[]>
    expect(Object.keys(hooks).sort()).toEqual(["Stop", "UserPromptSubmit"])
    expect(hooks.Stop![0]!.hooks[0]).toEqual({ type: "command", command: HOOK_COMMAND, timeout: 10 })
    expect(hooksInstalled(settings, ["UserPromptSubmit", "Stop"])).toBe(true)
    expect(hooksInstalled(settings, ["UserPromptSubmit", "Stop", "Notification"])).toBe(false)
    expect(uninstallHooks(settings, ["UserPromptSubmit", "Stop"]).settings.hooks).toBeUndefined()
  })
  it("appends after the user's groups so existing group indices are stable", () => {
    const { settings } = installHooks({ hooks: { Stop: [{ hooks: [{ type: "command", command: "mine" }] }] } }, ["Stop"])
    const stop = (settings.hooks as Record<string, { hooks: { command: string }[] }[]>).Stop!
    expect(stop.map((g) => g.hooks[0]!.command)).toEqual(["mine", HOOK_COMMAND])
  })
})

describe("codex hook trust", () => {
  // Vector computed with the formula that reproduced all 16 trust entries in a real ~/.codex/config.toml.
  const hooksJson = { hooks: { Stop: [{ hooks: [{ type: "command", command: "echo hi", timeout: 5 }] }, { hooks: [{ type: "command", command: HOOK_COMMAND, timeout: 10 }] }] } }
  it("hashes the sorted, compact JSON of {event_name, hooks:[{async,command,timeout,type}]}", () => {
    const expected = new Bun.CryptoHasher("sha256")
      .update(JSON.stringify({ event_name: "stop", hooks: [{ async: false, command: HOOK_COMMAND, timeout: 10, type: "command" }] }))
      .digest("hex")
    expect(codexHookHash("stop", HOOK_COMMAND, 10)).toBe(`sha256:${expected}`)
  })
  it("keys our own hooks by file:event_snake:group:index", () => {
    expect(codexTrustKeys("/h/.codex/hooks.json", hooksJson)).toEqual([{ key: "/h/.codex/hooks.json:stop:1:0", hash: codexHookHash("stop", HOOK_COMMAND, 10) }])
  })
  it("appends trust blocks to the TOML and removes exactly those blocks later", () => {
    const toml = '[projects."/x"]\ntrust_level = "trusted"\n\n[hooks.state."/h/.codex/hooks.json:stop:0:0"]\ntrusted_hash = "sha256:aaaa"\n'
    const entries = codexTrustKeys("/h/.codex/hooks.json", hooksJson)
    const added = addTrust(toml, entries)
    expect(added.changed).toBe(true)
    expect(added.text).toContain(`[hooks.state."/h/.codex/hooks.json:stop:1:0"]\nenabled = true\ntrusted_hash = "${entries[0]!.hash}"\n`)
    expect(addTrust(added.text, entries).changed).toBe(false)
    const removed = removeTrust(added.text, [entries[0]!.hash])
    expect(removed.changed).toBe(true)
    expect(removed.text).toBe(toml)
    expect(removeTrust(toml, [entries[0]!.hash]).changed).toBe(false)
  })
})

describe("copilot hook file", () => {
  it("is a version-1 file with bash handlers for the four events", () => {
    const file = copilotFile()
    expect(file.version).toBe(1)
    expect(Object.keys(file.hooks).sort()).toEqual(["Notification", "PermissionRequest", "Stop", "UserPromptSubmit"])
    expect(file.hooks.Stop).toEqual([{ type: "command", bash: HOOK_COMMAND, timeoutSec: 5 }])
    expect(copilotInstalled(file)).toBe(true)
    expect(copilotInstalled({ version: 1, hooks: { Stop: [{ type: "command", bash: "other" }] } })).toBe(false)
    expect(copilotInstalled(undefined)).toBe(false)
  })
})

describe("uninstall keeps the user's hooks that share a group with ours", () => {
  it("removes only CLI Code's entry from a mixed group", () => {
    const value = { hooks: { Stop: [{ hooks: [{ type: "command", command: "say done" }, { type: "command", command: HOOK_COMMAND }] }] } }
    const { settings, changed } = uninstallHooks(value, ["Stop"])
    expect(changed).toBe(true)
    expect(settings.hooks).toEqual({ Stop: [{ hooks: [{ type: "command", command: "say done" }] }] })
  })
})
