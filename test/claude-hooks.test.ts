import { afterEach, describe, expect, it } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import {
  HOOK_COMMAND,
  hooksInstalled,
  hooksInstalledOnDisk,
  installHooks,
  installHooksToDisk,
  uninstallHooks,
} from "../src/lib/claude-hooks.js"

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
    // PostToolUse chạy sau mỗi tool call: async để không làm chậm turn.
    expect((hooks.PostToolUse![0]!.hooks[0] as { async?: boolean }).async).toBe(true)
    expect((hooks.Stop!.at(-1)!.hooks[0] as { async?: boolean }).async).toBeUndefined()
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
  it("hooks không phải object (null/array) → cài coi như rỗng, gỡ không đổi gì", () => {
    expect(installHooks({ hooks: null }).changed).toBe(true)
    expect(installHooks({ hooks: [1, 2] }).changed).toBe(true)
    expect(uninstallHooks({ hooks: null }).changed).toBe(false)
    expect(uninstallHooks({ hooks: [1, 2] }).changed).toBe(false)
  })
})

describe("claude hooks disk I/O (temp dir only — never the real ~/.claude/settings.json)", () => {
  const dirs: string[] = []
  function tempSettingsFile(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-code-claude-hooks-"))
    dirs.push(dir)
    return path.join(dir, "settings.json")
  }
  afterEach(() => {
    for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
  })

  it("file JSON không hợp lệ → installHooksToDisk ném lỗi, không đổi bytes", () => {
    const file = tempSettingsFile()
    const original = '{"a":1,}'
    fs.writeFileSync(file, original)
    expect(() => installHooksToDisk(file)).toThrow()
    expect(fs.readFileSync(file, "utf8")).toBe(original)
    expect(fs.existsSync(`${file}.cli-code.bak`)).toBe(false)
  })

  it("file không tồn tại → tạo mới với hook của mình", () => {
    const file = tempSettingsFile()
    expect(installHooksToDisk(file)).toBe(true)
    expect(hooksInstalledOnDisk(file)).toBe(true)
  })

  it("file hợp lệ có hook khác → giữ nguyên hook khác, .bak khớp bytes gốc", () => {
    const file = tempSettingsFile()
    const original = JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "say done" }] }] } })
    fs.writeFileSync(file, original)
    expect(installHooksToDisk(file)).toBe(true)
    const written = JSON.parse(fs.readFileSync(file, "utf8"))
    expect(written.hooks.Stop[0].hooks[0].command).toBe("say done")
    expect(fs.readFileSync(`${file}.cli-code.bak`, "utf8")).toBe(original)
  })

  it("cài hai lần → lần hai trả về false, không ghi đè .bak lần nữa", () => {
    const file = tempSettingsFile()
    fs.writeFileSync(file, JSON.stringify({ other: 1 }))
    expect(installHooksToDisk(file)).toBe(true)
    const bakAfterFirst = fs.readFileSync(`${file}.cli-code.bak`, "utf8")
    expect(installHooksToDisk(file)).toBe(false)
    expect(fs.readFileSync(`${file}.cli-code.bak`, "utf8")).toBe(bakAfterFirst)
  })
})
