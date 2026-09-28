import { describe, expect, it } from "bun:test"
import { HOOK_COMMAND, hookCommand, hooksInstalled, installHooks, uninstallHooks } from "../src/lib/claude-hooks.js"
import { codexHookHash, codexTrustKeys, addTrust, remapTrust, removeTrust, trustedWith } from "../src/lib/hooks/codex-trust.js"
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
    expect(file.hooks.Stop).toEqual([{ type: "command", bash: hookCommand("copilot"), timeoutSec: 5 }])
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

describe("codex trust tables — by hash, not just by key", () => {
  const key = "/h/.codex/hooks.json:stop:0:0"
  const ours = { key, hash: "sha256:ours" }
  it("a table at our key holding another hook's hash is replaced with ours", () => {
    const toml = `model = "x"\n\n[hooks.state."${key}"]\ntrusted_hash = "sha256:users-old-hook"\n`
    const r = addTrust(toml, [ours])
    expect(r.changed).toBe(true)
    expect(r.text).toContain(`[hooks.state."${key}"]\nenabled = true\ntrusted_hash = "sha256:ours"`)
    expect(r.text).not.toContain("users-old-hook")
    expect(addTrust(r.text, [ours]).changed).toBe(false)
    expect(trustedWith(r.text, key, "sha256:ours")).toBe(true)
    expect(trustedWith(toml, key, "sha256:ours")).toBe(false)
  })
  it("removeTrust also removes our table when it ends the file without a newline", () => {
    const toml = `model = "x"\n\n[hooks.state."${key}"]\nenabled = true\ntrusted_hash = "sha256:ours"`
    const r = removeTrust(toml, ["sha256:ours"])
    expect(r.changed).toBe(true)
    expect(r.text).toBe(`model = "x"\n`)
  })
  it("removeTrust stops at an indented table header and keeps the user's table after ours", () => {
    const toml = `[hooks.state."${key}"]\nenabled = true\ntrusted_hash = "sha256:ours"\n  [mcp_servers.example]\n  command = "npx"\n`
    const r = removeTrust(toml, ["sha256:ours"])
    expect(r.changed).toBe(true)
    expect(r.text).toBe(`  [mcp_servers.example]\n  command = "npx"\n`)
  })
})

describe("codex trust tables — a key path with quotes or backslashes", () => {
  const key = '/tmp/review"home\\x/.codex/hooks.json:stop:0:0'
  it("is written as an escaped TOML string and still found, replaced, removed and renamed", () => {
    const added = addTrust('model = "x"\n', [{ key, hash: "sha256:ours" }])
    expect(added.text).toContain('[hooks.state."/tmp/review\\"home\\\\x/.codex/hooks.json:stop:0:0"]')
    expect(trustedWith(added.text, key, "sha256:ours")).toBe(true)
    expect(addTrust(added.text, [{ key, hash: "sha256:ours" }]).changed).toBe(false)
    const replaced = addTrust(added.text, [{ key, hash: "sha256:new" }])
    expect(replaced.text.match(/hooks\.state\./g)).toHaveLength(1)
    // The user's hook after ours moves from group 1 to 0 when ours is removed: its trust follows.
    const file = '/tmp/review"home\\x/.codex/hooks.json'
    const userTable = addTrust("", [{ key: `${file}:stop:1:0`, hash: "sha256:user" }]).text
    const mine = { hooks: [{ type: "command", command: HOOK_COMMAND }] }
    const theirs = { hooks: [{ type: "command", command: "say done" }] }
    const moved = remapTrust(userTable, file, { hooks: { Stop: [mine, theirs] } }, { hooks: { Stop: [theirs] } })
    expect(moved.changed).toBe(true)
    expect(trustedWith(moved.text, `${file}:stop:0:0`, "sha256:user")).toBe(true)
    expect(removeTrust(added.text, ["sha256:ours"]).text).toBe('model = "x"\n')
  })
})

describe("codex trust tables — with no blank line between tables", () => {
  const toml = 'model = "example"\n[hooks.state."k"]\nenabled = true\ntrusted_hash = "sha256:ours"\n[projects."/tmp/project"]\ntrust_level = "trusted"\n'
  it("removing or replacing ours keeps the next table on a line of its own", () => {
    expect(removeTrust(toml, ["sha256:ours"]).text).toBe('model = "example"\n[projects."/tmp/project"]\ntrust_level = "trusted"\n')
    expect(addTrust(toml, [{ key: "k", hash: "sha256:new" }]).text.startsWith('model = "example"\n[projects."/tmp/project"]\n')).toBe(true)
  })
})

describe("codex trust tables — spacing around = that a formatter or a hand edit leaves", () => {
  it("trusted_hash   =   \"…\" is still read as the table's hash", () => {
    const toml = '[hooks.state."k"]\nenabled = true\ntrusted_hash   =   "sha256:ours"\n'
    expect(trustedWith(toml, "k", "sha256:ours")).toBe(true)
    expect(removeTrust(toml, ["sha256:ours"]).changed).toBe(true)
  })
})

describe("codex trust tables — a blank line between the header and its keys", () => {
  const toml = 'model = "x"\n\n[hooks.state."k"]\n\nenabled = true\ntrusted_hash = "sha256:ours"\n\n[projects."/p"]\ntrust_level = "trusted"\n'
  it("is still one table: found, removed whole, and replaced without leaving its keys behind", () => {
    expect(trustedWith(toml, "k", "sha256:ours")).toBe(true)
    expect(removeTrust(toml, ["sha256:ours"]).text).toBe('model = "x"\n\n[projects."/p"]\ntrust_level = "trusted"\n')
    const replaced = addTrust(toml, [{ key: "k", hash: "sha256:new" }]).text
    expect(replaced).not.toContain("sha256:ours")
    expect(replaced.match(/enabled = true/g)).toHaveLength(1)
  })
})

describe("codex trust tables — a config.toml with CRLF line ends", () => {
  const entries = [
    { key: "a", hash: "sha256:1" },
    { key: "b", hash: "sha256:2" },
    { key: "c", hash: "sha256:3" },
  ]
  const crlf = addTrust('model = "x"\n', entries).text.replace(/\n/g, "\r\n")
  it("install, update and remove keep one table per key and the file's own line ends", () => {
    expect(entries.every((e) => trustedWith(crlf, e.key, e.hash))).toBe(true)
    expect(addTrust(crlf, entries).changed).toBe(false)
    const updated = addTrust(crlf, [{ key: "b", hash: "sha256:new" }]).text
    expect(updated.match(/enabled = true/g)).toHaveLength(3)
    expect(updated.match(/\[hooks\.state\."b"\]/g)).toHaveLength(1)
    expect(updated.replace(/\r\n/g, "")).not.toContain("\n")
    expect(removeTrust(updated, ["sha256:1", "sha256:new", "sha256:3"]).text).toBe('model = "x"\r\n')
  })
})
