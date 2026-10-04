import * as assert from "node:assert/strict"
import * as vscode from "vscode"
import { api, fixture, openReady, pidAlive, readEnvFile, waitFor } from "./helpers.js"

describe("lifecycle (checklist B, A-e)", () => {
  // A failed assertion must not leak the panel (and its PTY) into the next test.
  let openPanel: vscode.WebviewPanel | undefined
  afterEach(() => {
    openPanel?.dispose()
    openPanel = undefined
  })

  it("font zoom steps and resets the persisted size", async () => {
    const a = await api()
    const base = a.currentFontSize(a.context)
    await a.applyFontZoom(a.context, 1)
    assert.equal(a.currentFontSize(a.context), base + 1)
    await a.applyFontZoom(a.context, -1)
    await a.applyFontZoom(a.context, -1)
    assert.equal(a.currentFontSize(a.context), base - 1)
    await a.applyFontZoom(a.context, "reset")
    assert.equal(a.currentFontSize(a.context), base)
  })

  // Review finding: a tab closed while its restore still awaited the daemon left the attached
  // session running with no tab (and kept the daemon from ever idling out).
  it("closing a tab while it is being restored ends its CLI", async () => {
    const { a, panel: original, env } = await openReady("restore-close")
    const sessionId = a.inspectPanel(original).sessionId!
    const restored = vscode.window.createWebviewPanel("cliCode.terminal", "restoring", vscode.ViewColumn.One, {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(a.context.extensionPath)],
    })
    const restoring = a.restoreTerminalPanel(a.context, restored, { sessionId, toolId: "codex" })
    restored.dispose()
    await restoring
    await waitFor(() => !pidAlive(Number(env.pid)), 5_000, "CLI killed after the restoring tab closed")
    assert.ok(!a.activePanels().includes(restored))
    original.dispose()
  })

  it("a tool that exits can be restarted in the same tab, keeping its title", async () => {
    const { a, panel, env } = await openReady("exit", { ITEST_EXIT_CODE: "3" }, { title: "Giữ tên" })
    openPanel = panel
    const firstPid = Number(env.pid)
    await waitFor(() => !pidAlive(firstPid), 5_000, "tool to exit")
    assert.ok(a.activePanels().includes(panel), "an exited tab stays open for restart")
    // …but takes no input: a quick command must open a new session instead of vanishing.
    await waitFor(() => !a.pasteToActivePanel("x", false), 5_000, "exited tab to refuse a paste")
    assert.equal(a.writeToActivePanel("x"), false)

    await a.restartPanel(a.context, panel)
    await waitFor(() => Number(readEnvFile("exit")?.pid) !== firstPid, 15_000, "restarted tool")
    assert.equal(panel.title, "Giữ tên")
    assert.ok(a.activePanels().includes(panel))
    panel.dispose()
    openPanel = undefined
  })

  // The editor writes its list of open tabs once a minute: killed, it comes back without the
  // newest tabs. The window's own list (written at once) brings them back.
  it("a tab the editor did not restore comes back from the window's own tab list; the editor's late copy of a tab is dropped", async () => {
    const { a, panel } = await openReady("recover")
    openPanel = panel
    type OpenTab = { state: { tabId?: string; sessionId: string; toolId: string; createdAt?: number }; viewColumn?: number }
    const saved = await waitFor(() => a.context.workspaceState.get<OpenTab[]>("cliCode.openTabs")?.find((t) => t.state.sessionId === a.inspectPanel(panel).sessionId), 5_000, "tab saved")
    assert.ok(saved.state.tabId)
    const lost: OpenTab = {
      state: {
        sessionId: "00000000-0000-0000-0000-00000000000a",
        toolId: "codex",
        cwd: "/tmp",
        command: `sh "${fixture("echo-tool.sh")}"`,
        customTitle: "Bị mất",
        tabId: "lost-tab",
        createdAt: Date.now() + 1_000,
      } as OpenTab["state"],
    }
    await a.context.workspaceState.update("cliCode.openTabs", [saved, lost])
    const before = new Set(a.activePanels())
    await a.recoverMissingTabs(a.context)
    const back = await waitFor(() => a.activePanels().find((p) => !before.has(p)), 20_000, "recovered tab")
    try {
      await waitFor(() => a.inspectPanel(back).ready, 15_000, "recovered webview ready")
      assert.equal(back.title, "Bị mất")

      // The editor reviving its own (older) copy of the recovered tab: that copy goes, the CLI stays.
      const sessionId = a.inspectPanel(back).sessionId
      const late = vscode.window.createWebviewPanel("cliCode.terminal", "late", vscode.ViewColumn.One, {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.file(a.context.extensionPath)],
      })
      let disposed = false
      late.onDidDispose(() => (disposed = true))
      await a.restoreTerminalPanel(a.context, late, { sessionId: sessionId!, toolId: "codex", tabId: "lost-tab" })
      assert.ok(disposed, "the duplicate is closed")
      assert.equal(a.inspectPanel(back).sessionId, sessionId)
      assert.ok(a.activePanels().includes(back))
    } finally {
      back.dispose()
    }
    const left = a.context.workspaceState.get<OpenTab[]>("cliCode.openTabs") ?? []
    assert.ok(!left.some((t) => t.state.tabId === "lost-tab"), "a closed tab leaves the list")
  })

  // Runs last in stage 1: it kills this window's daemon.
  it("a dead daemon turns the tab into the gone page, and restart opens a fresh session", async () => {
    const { a, panel, env } = await openReady("gone", {}, { title: "Sau khi chết" })
    openPanel = panel
    const daemon = a.daemonPid()
    assert.ok(daemon, "this window must have spawned the daemon")
    process.kill(daemon)

    // The killed daemon takes its PTY children with it.
    await waitFor(() => !pidAlive(Number(env.pid)), 10_000, "old PTY child to die")
    await waitFor(() => a.inspectPanel(panel).gone, 15_000, "gone page")
    assert.ok(panel.webview.html.includes("Restart"))
    assert.ok(!a.activePanels().includes(panel))

    // Clicked twice (review finding: no in-flight guard opened two tabs resuming one conversation).
    const before = new Set(a.activePanels())
    await Promise.all([a.restartFromGone(a.context, panel), a.restartFromGone(a.context, panel)])
    assert.equal(a.activePanels().filter((p) => !before.has(p)).length, 1)
    const fresh = await waitFor(() => a.activePanels().find((p) => p !== panel), 20_000, "fresh panel")
    openPanel = fresh
    await waitFor(() => a.inspectPanel(fresh).ready, 15_000, "fresh webview ready")
    const again = await waitFor(() => {
      const e = readEnvFile("gone")
      return e && e.pid !== env.pid ? e : undefined
    }, 15_000, "fresh tool env")
    assert.notEqual(again.CLI_CODE_DAEMON_SOCK, undefined)
    assert.equal(fresh.title, "Sau khi chết")
    assert.notEqual(a.daemonPid(), daemon, "a new daemon was spawned")
    fresh.dispose()
    openPanel = undefined
  })
})
