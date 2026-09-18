import * as assert from "node:assert/strict"
import * as fs from "node:fs"
import * as path from "node:path"
import * as vscode from "vscode"
import { api, EXTENSION_ID, outDir } from "./helpers.js"

describe("smoke", () => {
  it("activates and exports the test API", async () => {
    const a = await api()
    assert.ok(vscode.extensions.getExtension(EXTENSION_ID)?.isActive)
    assert.equal(typeof a.openTerminalPanel, "function")
    assert.deepEqual(a.activePanels(), [])
  })

  // Tests run against the real HOME (overriding it breaks webview script execution — see
  // task-2-report.md), so the real `~/.claude/settings.json` is reachable through
  // a.claudeSettingsPath. No test may write to it. This snapshot is the first thing stage 1
  // runs; run.mjs compares the file against it after every stage and fails loudly on any
  // difference — the actual safety net, since a test-side assertion can be skipped by a
  // crash but run.mjs's check cannot.
  it("snapshots the real Claude settings file so run.mjs can verify no test ever touches it", async () => {
    const a = await api()
    const exists = fs.existsSync(a.claudeSettingsPath)
    const base64 = exists ? fs.readFileSync(a.claudeSettingsPath).toString("base64") : ""
    fs.writeFileSync(path.join(outDir(), "claude-settings.before"), JSON.stringify({ path: a.claudeSettingsPath, exists, base64 }))
  })
})
