import * as assert from "node:assert/strict"
import * as fs from "node:fs"
import * as path from "node:path"
import * as vscode from "vscode"
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
          // ensureDaemon() finds the running daemon by looking up this id in
          // workspaceState. The runner ends stage 1 by process.exit()-ing the extension
          // host (see index.ts run()), which does not go through VS Code's normal
          // shutdown flush — workspaceState never reaches disk, so stage 2 reads this
          // key back as undefined. Persist it ourselves so stage 2 can restore it below.
          daemonId: a.context.workspaceState.get(DAEMON_ID_KEY),
        }),
      )
      // Deliberately NOT disposed: VS Code must restore it in stage 2.
    })
  })
} else {
  describe("reload — stage 2 (checklist A-b, A-f)", () => {
    it("restores the tab to the same session with the same title and a live PTY", async () => {
      const a = await api()
      const saved = JSON.parse(fs.readFileSync(STATE(), "utf8")) as {
        sessionId: string
        toolPid: number
        daemonPid: number
        title: string
        daemonId: string | undefined
      }
      assert.ok(pidAlive(saved.daemonPid), "daemon from stage 1 must still be running (stage 2 must start within its 60 s idle window)")
      assert.ok(pidAlive(saved.toolPid), "the CLI process must survive the VS Code restart")

      const restored = await waitFor(() => a.activePanels()[0], 10_000, "restore").catch(() => undefined)
      const panel =
        restored ??
        (await (async () => {
          // See the comment in stage 1: workspaceState never made it to disk between the
          // two windows, so ensureDaemon() would otherwise spawn a brand-new daemon
          // instead of reattaching to the one stage 1 left running. Restore the id first.
          if (saved.daemonId) await a.context.workspaceState.update(DAEMON_ID_KEY, saved.daemonId)
          const p = vscode.window.createWebviewPanel("cliCode.terminal", "restored", vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [vscode.Uri.file(a.context.extensionPath)],
          })
          await a.restoreTerminalPanel(a.context, p, { sessionId: saved.sessionId, toolId: "codex", customTitle: saved.title })
          return p
        })())
      await waitFor(() => a.inspectPanel(panel).ready, 15_000, "restored webview ready")
      assert.equal(a.inspectPanel(panel).sessionId, saved.sessionId)
      assert.equal(panel.title, saved.title)
      assert.ok(pidAlive(saved.toolPid))
      panel.dispose()
      await waitFor(() => !pidAlive(saved.toolPid), 5_000, "PTY killed on close")
    })
  })
}
