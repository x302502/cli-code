import * as assert from "node:assert/strict"
import * as vscode from "vscode"
import { api, EXTENSION_ID } from "./helpers.js"

describe("smoke", () => {
  it("activates and exports the test API", async () => {
    const a = await api()
    assert.ok(vscode.extensions.getExtension(EXTENSION_ID)?.isActive)
    assert.equal(typeof a.openTerminalPanel, "function")
    assert.deepEqual(a.activePanels(), [])
  })

  it("runs with HOME pointed at the temp dir, never the real home", async () => {
    const a = await api()
    assert.ok(process.env.HOME?.includes("cli-code-itest-"), `HOME=${process.env.HOME}`)
    assert.ok(a.claudeSettingsPath.startsWith(process.env.HOME!), a.claudeSettingsPath)
  })
})
