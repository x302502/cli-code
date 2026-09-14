import { describe, expect, it } from "bun:test"
import { HOOK_COMMAND, hooksInstalled, installHooks, uninstallHooks } from "../src/lib/claude-hooks.js"

describe("claude hooks merge", () => {
  it("thêm entry vào 4 sự kiện, giữ hook sẵn có", () => {
    const before = { hooks: { Stop: [{ hooks: [{ type: "command", command: "say done" }] }] }, other: 1 }
    const { settings, changed } = installHooks(before)
    expect(changed).toBe(true)
    const hooks = settings.hooks as Record<string, { hooks: { command: string }[] }[]>
    expect(hooks.Stop![0]!.hooks[0]!.command).toBe("say done")
    expect(hooks.Stop!.some((g) => g.hooks.some((h) => h.command === HOOK_COMMAND))).toBe(true)
    expect(hooks.UserPromptSubmit!.length).toBe(1)
    expect(hooks.Notification!.length).toBe(1)
    expect(hooks.PermissionRequest!.length).toBe(1)
    expect(settings.other).toBe(1)
    expect(hooksInstalled(settings)).toBe(true)
  })
  it("cài lần hai không đổi gì", () => {
    const once = installHooks({}).settings
    expect(installHooks(once).changed).toBe(false)
  })
  it("gỡ chỉ bỏ entry của mình", () => {
    const before = installHooks({ hooks: { Stop: [{ hooks: [{ type: "command", command: "say done" }] }] } }).settings
    const { settings, changed } = uninstallHooks(before)
    expect(changed).toBe(true)
    const hooks = settings.hooks as Record<string, unknown[]>
    expect(hooks.Stop!.length).toBe(1)
    expect(hooks.UserPromptSubmit).toBeUndefined()
    expect(hooksInstalled(settings)).toBe(false)
  })
  it("settings không phải object → coi như rỗng", () => {
    expect(hooksInstalled(null)).toBe(false)
    expect(installHooks("x").changed).toBe(true)
  })
  it("không mutate input gốc", () => {
    const before = { hooks: { Stop: [{ hooks: [{ type: "command", command: "say done" }] }] } }
    installHooks(before)
    expect(before.hooks.Stop.length).toBe(1)
  })
  it("hooks.<Event> không phải mảng → coi như rỗng", () => {
    const before = { hooks: { Stop: "not-an-array" } }
    const { settings, changed } = installHooks(before)
    expect(changed).toBe(true)
    const hooks = settings.hooks as Record<string, unknown[]>
    expect(hooks.Stop!.length).toBe(1)
  })
})
