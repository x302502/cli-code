import * as assert from "node:assert/strict"
import type * as vscode from "vscode"
import { fixture, inputFile, openReady, readEnvFile, readFileOr, waitFor } from "./helpers.js"

describe("commands (checklist E)", () => {
  // A failed assertion must not leak the panel (and its PTY) into the next test.
  let openPanel: vscode.WebviewPanel | undefined
  afterEach(() => {
    openPanel?.dispose()
    openPanel = undefined
  })

  it("a tab opened with a resume command restarts with the same command", async () => {
    const command = `sh "${fixture("echo-tool.sh")}" --resume abc123`
    const { a, panel, env } = await openReady("resume", {}, { command, title: "Phiên cũ" })
    openPanel = panel
    assert.equal(env.argv, "--resume abc123")
    assert.equal(panel.title, "Phiên cũ")
    const firstPid = env.pid

    await a.restartPanel(a.context, panel)
    const again = await waitFor(() => {
      const e = readEnvFile("resume")
      return e && e.pid !== firstPid ? e : undefined
    }, 15_000, "env file from the restarted tool")
    assert.equal(again.argv, "--resume abc123")
    assert.equal(panel.title, "Phiên cũ")
  })

  it("a multi-line quick command arrives as one bracketed paste followed by a single Enter", async () => {
    const { a, panel } = await openReady("quick")
    openPanel = panel
    await new Promise((r) => setTimeout(r, 300))
    assert.ok(a.pasteToActivePanel("dòng 1\ndòng 2\ndòng 3", true))
    const expected = "\x1b[200~dòng 1\rdòng 2\rdòng 3\x1b[201~\r"
    try {
      await waitFor(() => readFileOr(inputFile("quick")) === expected, 10_000, "bracketed paste in quick.in")
    } catch (err) {
      throw new Error(`${(err as Error).message}; actual quick.in = ${JSON.stringify(readFileOr(inputFile("quick")))}`)
    }
  })
})
