import * as assert from "node:assert/strict"
import * as fs from "node:fs"
import * as path from "node:path"
import { spawnSync } from "node:child_process"
import { api, fixture, openReady, outDir, readEnvFile, waitFor } from "./helpers.js"

const HOOK = path.resolve(__dirname, "..", "..", "dist", "hook.js")

function fireHook(env: Record<string, string>, payload: Record<string, unknown>, from?: string): void {
  // The extension host's execPath is Electron; run it as node, exactly as CLI_CODE_HOOK does.
  const r = spawnSync(process.execPath, [HOOK], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", CLI_CODE_SESSION_ID: env.CLI_CODE_SESSION_ID, CLI_CODE_DAEMON_SOCK: env.CLI_CODE_DAEMON_SOCK,
      ...(from ? { CLI_CODE_FROM: from, CLI_CODE_FAMILY: from } : {}) },
    input: JSON.stringify(payload),
    encoding: "utf8",
    timeout: 5_000,
  })
  assert.equal(r.status, 0, `hook exit ${r.status}: ${r.stderr}`)
  assert.equal(r.stdout, "", "hook must never print to stdout")
}

describe("claude hooks (checklist D)", () => {
  it("live model changes reach only their tab immediately and old transcript data cannot overwrite them", async () => {
    const { a, panel, env, tool } = await openReady("model-live")
    const sibling = await openReady("model-live-sibling")
    tool.historyToolId = "omp"
    const file = path.join(outDir(), "model-live.jsonl")
    fs.writeFileSync(file, '{"type":"session","id":"selected"}\n{"type":"model_change","modelId":"old-model"}\n')
    const model = () => (a.inspectPanel(panel) as { model?: string }).model
    try {
      fireHook(env, { hook_event_name: "UserPromptSubmit", prompt: "hello", session_id: "selected" })
      await waitFor(() => a.inspectPanel(panel).status?.state === "working", 5_000, "working state")
      for (const id of ["old-model", "new-model"]) {
        fireHook(env, { hook_event_name: "ModelChange", model: id, session_id: "selected", session_file: file }, "omp")
        await waitFor(() => model() === id, 1_500, "immediate model header update")
      }
      await new Promise((r) => setTimeout(r, 1_500))
      assert.equal(model(), "new-model", "an old transcript must not replace a live selected model")
      assert.equal(a.inspectPanel(panel).status?.state, "working", "model changes must not end an active turn")
      assert.equal((a.inspectPanel(sibling.panel) as { model?: string }).model, undefined)
    } finally { panel.dispose(); sibling.panel.dispose() }
  })
  it("a transcript model change is refreshed promptly without an agent hook or another prompt", async () => {
    const { a, panel, env, tool } = await openReady("model-transcript")
    tool.historyToolId = "omp"
    const file = path.join(outDir(), "model-transcript.jsonl")
    fs.writeFileSync(file, '{"type":"session","id":"selected"}\n{"type":"model_change","modelId":"old-model"}\n')
    const model = () => (a.inspectPanel(panel) as { model?: string }).model
    try {
      fireHook(env, { hook_event_name: "SessionStart", session_id: "selected", session_file: file }, "omp")
      await waitFor(() => model() === "old-model", 1_500, "initial transcript model")
      fs.appendFileSync(file, '{"type":"model_change","modelId":"new-model"}\n')
      await waitFor(() => model() === "new-model", 1_500, "prompt transcript model refresh")
    } finally { panel.dispose() }
  })
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
    for (const ev of ["UserPromptSubmit", "Stop", "Notification", "PermissionRequest", "PostToolUse", "PostToolBatch"]) {
      assert.ok(Array.isArray(settings.hooks?.[ev]), `hooks.${ev} missing`)
    }
    assert.equal(fs.readFileSync(`${settingsPath}.cli-code.bak`, "utf8"), '{"foo":1}\n')

    assert.equal(a.uninstallHooksFromDisk(settingsPath), true)
    assert.equal(a.hooksInstalledOnDisk(settingsPath), false)
    assert.equal(JSON.parse(fs.readFileSync(settingsPath, "utf8")).foo, 1)
  })

  it("Khởi động lại phiên resumes the session id the hook reported", async () => {
    const { a, panel, env, tool } = await openReady("hook-resume")
    // Give the fixture tool a resume form so the restart can address the session by id.
    tool.resumeCommand = `sh "${fixture("echo-tool.sh")}" --resume {sessionId}`
    fireHook(env, { hook_event_name: "UserPromptSubmit", prompt: "xin chào", session_id: "sess-abc-123" })
    await waitFor(() => panel.title.startsWith("⟳ "), 10_000, "hook delivered")

    await a.restartPanel(a.context, panel)
    const again = await waitFor(() => {
      const e = readEnvFile("hook-resume")
      return e && e.pid !== env.pid ? e : undefined
    }, 15_000, "restarted tool env")
    assert.equal(again.argv, "--resume sess-abc-123")
    panel.dispose()
  })
})
