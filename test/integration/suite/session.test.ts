import * as assert from "node:assert/strict"
import * as fs from "node:fs"
import type * as vscode from "vscode"
import { api, inputFile, makeTool, openReady, pidAlive, readEnvFile, readFileOr, waitFor } from "./helpers.js"

describe("session (checklist A-a, A-d, B OSC 7)", () => {
  // A failed assertion must not leak the panel (and its PTY) into the next test.
  let openPanel: vscode.WebviewPanel | undefined
  afterEach(() => {
    openPanel?.dispose()
    openPanel = undefined
  })

  it("opens a tab whose PTY is stamped with the session id and daemon socket", async () => {
    const { a, panel, env } = await openReady("open")
    openPanel = panel
    assert.equal(env.CLI_CODE_SESSION_ID, a.inspectPanel(panel).sessionId)
    assert.ok(env.CLI_CODE_DAEMON_SOCK.endsWith(".sock"), env.CLI_CODE_DAEMON_SOCK)
    assert.match(env.CLI_CODE_HOOK, /dist\/hook\.js/)
    // What VS Code's own terminal sets: Claude Code auto-connects to the IDE on it.
    assert.equal(env.TERM_PROGRAM, "vscode")
    // ...but it must not make Claude Code install its extension behind the user's back.
    assert.equal(env.CLAUDE_CODE_IDE_SKIP_AUTO_INSTALL, "1")
    assert.equal(panel.title, "itest open", `expected panel.title "itest open", got ${JSON.stringify(panel.title)}`)
    // The experimental composer follows the cliCode.composer setting (default off) through a body attribute.
    assert.ok(panel.webview.html.includes('data-composer="off"'), "composer off by default")
  })

  it("delivers typed bytes to the PTY verbatim", async () => {
    const { a, panel } = await openReady("type")
    openPanel = panel
    // `tee` creates $TAG.in only after `stty raw`, so its existence is a true "raw mode on,
    // ready for bytes" signal — the env file alone is written earlier.
    await waitFor(() => fs.existsSync(inputFile("type")), 10_000, "tee ready")
    const wrote = a.writeToActivePanel("hi\r")
    assert.ok(wrote, `writeToActivePanel returned ${wrote} (panel.active=${panel.active}, in activePanels=${a.activePanels().includes(panel)})`)
    try {
      await waitFor(() => readFileOr(inputFile("type")) === "hi\r", 10_000, "hi\\r in type.in")
    } catch (err) {
      throw new Error(`${(err as Error).message}; actual type.in = ${JSON.stringify(readFileOr(inputFile("type")))}`)
    }
  })

  it("tracks the cwd reported through OSC 7", async () => {
    const { a, panel } = await openReady("osc7")
    openPanel = panel
    try {
      await waitFor(() => a.inspectPanel(panel).cwd === "/tmp", 10_000, "cwd from OSC 7")
    } catch (err) {
      throw new Error(`${(err as Error).message}; actual cwd = ${JSON.stringify(a.inspectPanel(panel).cwd)}`)
    }
  })

  it("kills the PTY when the tab is closed", async () => {
    const { a, panel, env } = await openReady("close")
    openPanel = panel
    const pid = Number(env.pid)
    assert.ok(pidAlive(pid))
    panel.dispose()
    await waitFor(() => !pidAlive(pid), 5_000, `pid ${pid} to exit`)
    assert.ok(!a.activePanels().includes(panel))
  })

  it("a Claude-family tab spawns with one --settings statusLine and the statusLine env", async () => {
    const a = await api()
    const tool = { ...makeTool("claude-sl"), historyToolId: "claude" }
    const before = new Set(a.activePanels())
    await a.openTerminalPanel(a.context, tool)
    const panel = await waitFor(() => a.activePanels().find((p) => !before.has(p)), 15_000, "claude-sl panel")
    openPanel = panel
    const env = await waitFor(() => readEnvFile("claude-sl"), 15_000, "claude-sl.env")
    assert.equal(env.argv.match(/--settings/g)?.length, 1)
    assert.match(env.argv, /"statusLine"/)
    assert.match(env.CLI_CODE_STATUSLINE, /dist\/statusline\.js/)
    // Restart re-spawns from the stored command: still exactly one --settings.
    await a.restartPanel(a.context, panel)
    const env2 = await waitFor(() => { const e = readEnvFile("claude-sl"); return e && e.pid !== env.pid ? e : undefined }, 20_000, "restarted env")
    assert.equal(env2.argv.match(/--settings/g)?.length, 1)
  })
})
