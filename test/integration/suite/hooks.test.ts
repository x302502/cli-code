import * as assert from "node:assert/strict"
import * as fs from "node:fs"
import * as path from "node:path"
import { spawnSync } from "node:child_process"
import { api, openReady, outDir, waitFor } from "./helpers.js"

const HOOK = path.resolve(__dirname, "..", "..", "dist", "hook.js")

function fireHook(env: Record<string, string>, payload: Record<string, unknown>): void {
  // The extension host's execPath is Electron; run it as node, exactly as CLI_CODE_HOOK does.
  const r = spawnSync(process.execPath, [HOOK], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", CLI_CODE_SESSION_ID: env.CLI_CODE_SESSION_ID, CLI_CODE_DAEMON_SOCK: env.CLI_CODE_DAEMON_SOCK },
    input: JSON.stringify(payload),
    encoding: "utf8",
    timeout: 5_000,
  })
  assert.equal(r.status, 0, `hook exit ${r.status}: ${r.stderr}`)
  assert.equal(r.stdout, "", "hook must never print to stdout")
}

describe("claude hooks (checklist D)", () => {
  it("hook events change the tab glyph: working → waiting, idle ignored, stop clears", async () => {
    const { a, panel, env } = await openReady("hook")
    fireHook(env, { hook_event_name: "UserPromptSubmit", prompt: "sửa bug" })
    await waitFor(() => panel.title.startsWith("⟳ "), 10_000, `working glyph, got ${JSON.stringify(panel.title)}`)
    assert.equal(a.inspectPanel(panel).status?.state, "working")

    fireHook(env, { hook_event_name: "Notification", notification_type: "permission_prompt" })
    await waitFor(() => panel.title.startsWith("? "), 10_000, `waiting glyph, got ${JSON.stringify(panel.title)}`)

    fireHook(env, { hook_event_name: "Notification", notification_type: "idle_prompt" })
    await new Promise((r) => setTimeout(r, 500))
    assert.ok(panel.title.startsWith("? "), `idle_prompt must not change the glyph, got ${panel.title}`)

    fireHook(env, { hook_event_name: "Stop" })
    // The panel is visible, so "done" shows no unread dot — the plain title comes back.
    await waitFor(() => !/^[⟳?●] /.test(panel.title), 10_000, `plain title after Stop, got ${JSON.stringify(panel.title)}`)
    assert.equal(a.inspectPanel(panel).status?.state, "done")
    panel.dispose()
  })

  // HOME is not overridden for the test window (it broke webviews — see task-2-report.md), so
  // a.claudeSettingsPath points at the real ~/.claude/settings.json. Never write there: pass an
  // explicit path under the itest output dir to all three disk functions instead.
  it("installer writes only the file it's given, keeps a backup and other keys", async () => {
    const a = await api()
    const settingsPath = path.join(outDir(), "claude", "settings.json")
    assert.notEqual(a.claudeSettingsPath, settingsPath)
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true })
    fs.writeFileSync(settingsPath, '{"foo":1}\n')

    assert.equal(a.installHooksToDisk(settingsPath), true)
    assert.equal(a.hooksInstalledOnDisk(settingsPath), true)
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"))
    assert.equal(settings.foo, 1)
    for (const ev of ["UserPromptSubmit", "Stop", "Notification", "PermissionRequest"]) {
      assert.ok(Array.isArray(settings.hooks?.[ev]), `hooks.${ev} missing`)
    }
    assert.equal(fs.readFileSync(`${settingsPath}.cli-code.bak`, "utf8"), '{"foo":1}\n')

    assert.equal(a.uninstallHooksFromDisk(settingsPath), true)
    assert.equal(a.hooksInstalledOnDisk(settingsPath), false)
    assert.equal(JSON.parse(fs.readFileSync(settingsPath, "utf8")).foo, 1)
  })
})
