import * as assert from "node:assert/strict"
import { createHash } from "node:crypto"
import * as fs from "node:fs"
import * as path from "node:path"
import * as vscode from "vscode"
import { api, EXTENSION_ID, outDir } from "./helpers.js"

// Tests run against the real HOME (overriding it breaks webview script execution — see
// task-2-report.md), so the real `~/.claude/settings.json` is reachable through
// a.claudeSettingsPath. No test may write to it. This root hook runs before any stage-1
// test; it records path/exists/sha256 (never the bytes) and run.mjs compares the file
// against it after every stage and fails loudly on any difference — the actual safety net,
// since a test-side assertion can be skipped by a crash but run.mjs's check cannot.
before(async () => {
  const a = await api()
  const exists = fs.existsSync(a.claudeSettingsPath)
  const sha256 = exists ? createHash("sha256").update(fs.readFileSync(a.claudeSettingsPath)).digest("hex") : ""
  fs.writeFileSync(path.join(outDir(), "claude-settings.before"), JSON.stringify({ path: a.claudeSettingsPath, exists, sha256 }))
})

describe("smoke", () => {
  it("activates and exports the test API", async () => {
    const a = await api()
    assert.ok(vscode.extensions.getExtension(EXTENSION_ID)?.isActive)
    assert.equal(typeof a.openTerminalPanel, "function")
    assert.deepEqual(a.activePanels(), [])
  })
})
