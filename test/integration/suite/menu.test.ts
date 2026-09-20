import * as assert from "node:assert/strict"
import * as fs from "node:fs"
import * as vscode from "vscode"
import { inputFile, openReady, readFileOr, waitFor } from "./helpers.js"

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
})
