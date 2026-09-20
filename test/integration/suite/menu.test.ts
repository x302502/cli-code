import * as assert from "node:assert/strict"
import * as fs from "node:fs"
import * as vscode from "vscode"
import { inputFile, openReady, readEnvFile, readFileOr, waitFor } from "./helpers.js"

// The right-click menu items are plain commands; running them through the command service
// exercises exactly what a click on the menu does (activeTerminalPanel → webview message).
describe("context-menu commands (checklist C-5)", () => {
  let openPanel: vscode.WebviewPanel | undefined
  let savedClipboard = ""
  before(async () => {
    savedClipboard = await vscode.env.clipboard.readText()
  })
  afterEach(() => {
    openPanel?.dispose()
    openPanel = undefined
  })
  after(async () => {
    await vscode.env.clipboard.writeText(savedClipboard)
  })

  it("Dán: pastes the clipboard as one bracketed paste, without Enter", async () => {
    const { panel } = await openReady("menu-paste")
    openPanel = panel
    await waitFor(() => fs.existsSync(inputFile("menu-paste")), 10_000, "tee ready")
    await vscode.env.clipboard.writeText("dán từ menu\nhai dòng")
    await vscode.commands.executeCommand("cli-code.paste")
    const expected = "\x1b[200~dán từ menu\rhai dòng\x1b[201~"
    await waitFor(() => readFileOr(inputFile("menu-paste")) === expected, 10_000, `paste bytes, got ${JSON.stringify(readFileOr(inputFile("menu-paste")))}`)
  })

  it("Chọn tất cả + Sao chép: copies the screen; Sao chép ngữ cảnh copies the tail", async () => {
    const { a, panel } = await openReady("menu-copy")
    openPanel = panel
    await waitFor(() => fs.existsSync(inputFile("menu-copy")), 10_000, "tee ready")
    // tee echoes what it receives, so typed text shows up on screen. The PTY is in raw mode
    // (no ONLCR), so send an explicit \r\n: xterm's clear() keeps the cursor row, and the
    // text must end up on a row above it for the clear assertion to mean anything.
    a.writeToActivePanel("xin chào menu\r\n")
    await new Promise((r) => setTimeout(r, 500))

    await vscode.env.clipboard.writeText("")
    await vscode.commands.executeCommand("cli-code.selectAll")
    await vscode.commands.executeCommand("cli-code.copySelection")
    await waitFor(async () => (await vscode.env.clipboard.readText()).includes("xin chào menu"), 10_000, "selection copied")

    await vscode.env.clipboard.writeText("")
    await vscode.commands.executeCommand("cli-code.copyContext")
    await waitFor(async () => (await vscode.env.clipboard.readText()).includes("xin chào menu"), 10_000, "context copied")
  })

  it("Phiên mới: opens another tab of the same CLI in the same directory", async () => {
    const { a, panel, env } = await openReady("menu-new")
    openPanel = panel
    const before = a.activePanels().length
    await vscode.commands.executeCommand("cli-code.newSession")
    const fresh = await waitFor(() => a.activePanels().find((p) => p !== panel), 15_000, "second tab")
    try {
      await waitFor(() => a.inspectPanel(fresh).ready, 15_000, "second webview ready")
      assert.equal(a.activePanels().length, before + 1)
      assert.equal(fresh.title, panel.title)
      // Same tool → the fixture rewrote its env file for the new process, spawned in the
      // directory the first tab currently reports (its OSC 7 cwd, /tmp for the fixture).
      const again = await waitFor(() => {
        const e = readEnvFile("menu-new")
        return e && e.pid !== env.pid ? e : undefined
      }, 15_000, "second tool env")
      assert.equal(again.cwd, a.inspectPanel(panel).cwd)
      assert.notEqual(a.inspectPanel(fresh).sessionId, a.inspectPanel(panel).sessionId)
    } finally {
      fresh.dispose()
    }
  })
})
