import * as assert from "node:assert/strict"
import * as fs from "node:fs"
import * as path from "node:path"
import * as vscode from "vscode"
import type { TestApi } from "../../../src/extension.js"
import { CLI_TOOLS } from "../../../src/lib/config.js"
import { api, fixture, outDir, pidAlive, readEnvFile, stage, waitFor } from "./helpers.js"

const STATE = () => path.join(outDir(), "stage1.json")

// Internal key panel.ts uses to remember which daemon this workspace spawned
// (`context.workspaceState.get<string>(DAEMON_ID_KEY)`). Not part of TestApi; see the
// stage-2 comment below for why this test reads/writes it directly.
const DAEMON_ID_KEY = "cliCode.daemonId"

if (stage() === "1") {
  describe("reload — stage 1 (leaves a renamed tab open)", () => {
    it("opens and renames a tab, records pids", async () => {
      // restoreTerminalPanel resolves the tool from CLI_TOOLS by id, so the restored tab must
      // carry a real tool id. Use the real "codex" tool but run the fake CLI through the
      // command override; the fake tool's env comes in through the command's env prefix
      // because extraEnv belongs to the (real) tool.
      const a = await api()
      const codex = CLI_TOOLS.find((t) => t.id === "codex")!
      const command = `ITEST_OUT="${outDir()}" ITEST_TAG=reload sh "${fixture("echo-tool.sh")}"`
      const before = new Set(a.activePanels())
      await a.openTerminalPanel(a.context, codex, { command })
      const panel = await waitFor(() => a.activePanels().find((p) => !before.has(p)), 15_000, "reload panel")
      await waitFor(() => a.inspectPanel(panel).ready, 15_000, "reload webview ready")
      const env = await waitFor(() => readEnvFile("reload"), 15_000, "reload.env")
      a.setCustomTitle(panel, "Tab qua reload")
      assert.equal(panel.title, "Tab qua reload")
      const daemonPid = a.daemonPid()
      assert.ok(daemonPid)
      fs.writeFileSync(path.join(outDir(), "daemon.pid"), String(daemonPid))
      fs.writeFileSync(
        STATE(),
        JSON.stringify({
          sessionId: a.inspectPanel(panel).sessionId,
          toolPid: Number(env.pid),
          daemonPid,
          title: panel.title,
          // VS Code extension-test mode uses in-memory storage, so the id our serializer
          // would otherwise find in workspaceState must be replayed by stage 2 (see there).
          daemonId: a.context.workspaceState.get(DAEMON_ID_KEY),
        }),
      )
      // Deliberately NOT disposed: VS Code must restore it in stage 2.
    })
  })
} else {
  describe("reload — stage 2 (checklist A-b, A-f)", () => {
    type Saved = { sessionId: string; toolPid: number; daemonPid: number; title: string; daemonId: string | undefined }
    const saved = (): Saved => JSON.parse(fs.readFileSync(STATE(), "utf8"))

    // VS Code's own reload/restart calls our webview serializer using state it reads back
    // from workspaceState and the workbench's persisted editor layout. Extension-test mode
    // (`--extensionTestsPath`) runs with in-memory storage, so nothing written in stage 1
    // survives into this process — VS Code itself never restores the tab or calls the
    // serializer here, and no two-launch test can make it (see docs/superpowers/specs/
    // 2026-09-18-integration-tests-design.md, "Two-stage reload"; that behaviour stays a
    // manual check, Reload Window). These tests instead replay the one piece of state test
    // mode drops (the daemon id) and call the serializer's own body, restoreTerminalPanel,
    // directly — that body is exactly what VS Code would run.
    async function restoredPanel(a: TestApi, state: Pick<Saved, "sessionId" | "title" | "daemonId">) {
      if (state.daemonId) await a.context.workspaceState.update(DAEMON_ID_KEY, state.daemonId)
      const panel = vscode.window.createWebviewPanel("cliCode.terminal", "restored", vscode.ViewColumn.One, {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.file(a.context.extensionPath)],
      })
      await a.restoreTerminalPanel(a.context, panel, { sessionId: state.sessionId, toolId: "codex", customTitle: state.title })
      return panel
    }

    // A failed assertion must not leak the panel (and its PTY) into the next test.
    let openPanel: vscode.WebviewPanel | undefined
    afterEach(() => {
      openPanel?.dispose()
      openPanel = undefined
    })

    it("after a VS Code restart, the serializer's restore path re-attaches the same session with the same title and a live PTY", async () => {
      const a = await api()
      const s = saved()
      assert.ok(pidAlive(s.daemonPid), "daemon from stage 1 must still be running (stage 2 must start within its 60 s idle window)")
      assert.ok(pidAlive(s.toolPid), "the CLI process must survive the VS Code restart")

      const panel = await restoredPanel(a, s)
      openPanel = panel
      await waitFor(() => a.inspectPanel(panel).ready, 15_000, "restored webview ready")
      assert.equal(a.inspectPanel(panel).sessionId, s.sessionId)
      assert.equal(panel.title, s.title)
      assert.ok(pidAlive(s.toolPid))
      panel.dispose()
      openPanel = undefined
      await waitFor(() => !pidAlive(s.toolPid), 5_000, "PTY killed on close")
    })

    // Regression: the failed-attach path never ran wirePanel, so showGone had no tool
    // recorded for the panel and "Khởi động lại" silently did nothing on a tab restored
    // after Reload Window whose session was gone.
    it("a restored tab whose session is gone shows the gone page, and its restart opens a fresh tab with the saved title", async () => {
      const a = await api()
      const panel = await restoredPanel(a, { ...saved(), sessionId: "00000000-0000-0000-0000-000000000000", title: "Mất phiên" })
      openPanel = panel
      await waitFor(() => a.inspectPanel(panel).gone, 15_000, "gone page")
      assert.ok(panel.webview.html.includes("Khởi động lại"))

      // Spawns the real `codex` command (no command override survives a restore); it may
      // not be installed — the tab still opens, the shell reports the missing command.
      await a.restartFromGone(a.context, panel)
      const fresh = await waitFor(() => a.activePanels().find((p) => p !== panel), 20_000, "fresh panel")
      openPanel = fresh
      await waitFor(() => a.inspectPanel(fresh).ready, 15_000, "fresh webview ready")
      assert.equal(fresh.title, "Mất phiên")
    })
  })
}
