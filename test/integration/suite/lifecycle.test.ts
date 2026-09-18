import * as assert from "node:assert/strict"
import type * as vscode from "vscode"
import { api, openReady, pidAlive, readEnvFile, waitFor } from "./helpers.js"

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

  it("a tool that exits can be restarted in the same tab, keeping its title", async () => {
    const { a, panel, env } = await openReady("exit", { ITEST_EXIT_CODE: "3" }, { title: "Giữ tên" })
    openPanel = panel
    const firstPid = Number(env.pid)
    await waitFor(() => !pidAlive(firstPid), 5_000, "tool to exit")
    assert.ok(a.activePanels().includes(panel), "an exited tab stays open for restart")

    await a.restartPanel(a.context, panel)
    await waitFor(() => Number(readEnvFile("exit")?.pid) !== firstPid, 15_000, "restarted tool")
    assert.equal(panel.title, "Giữ tên")
    assert.ok(a.activePanels().includes(panel))
    panel.dispose()
    openPanel = undefined
  })

  // Runs last in stage 1: it kills this window's daemon.
  it("a dead daemon turns the tab into the gone page, and restart opens a fresh session", async () => {
    const { a, panel, env } = await openReady("gone", {}, { title: "Sau khi chết" })
    openPanel = panel
    const daemon = a.daemonPid()
    assert.ok(daemon, "this window must have spawned the daemon")
    process.kill(daemon)

    await waitFor(() => a.inspectPanel(panel).gone, 15_000, "gone page")
    assert.ok(panel.webview.html.includes("Khởi động lại"))
    assert.ok(!a.activePanels().includes(panel))

    await a.restartFromGone(a.context, panel)
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
