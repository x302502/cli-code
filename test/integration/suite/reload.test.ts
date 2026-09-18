import * as assert from "node:assert/strict"
import * as fs from "node:fs"
import * as path from "node:path"
import * as vscode from "vscode"
import { CLI_TOOLS } from "../../../src/lib/config.js"
import { api, fixture, outDir, pidAlive, readEnvFile, stage, waitFor } from "./helpers.js"

const STATE = () => path.join(outDir(), "stage1.json")

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
      fs.writeFileSync(STATE(), JSON.stringify({ sessionId: a.inspectPanel(panel).sessionId, toolPid: Number(env.pid), daemonPid, title: panel.title }))
      // Deliberately NOT disposed: VS Code must restore it in stage 2.
    })
  })
} else {
  describe("reload — stage 2 (checklist A-b, A-f)", () => {
    it("restores the tab to the same session with the same title and a live PTY", async () => {
      const a = await api()
      const saved = JSON.parse(fs.readFileSync(STATE(), "utf8")) as { sessionId: string; toolPid: number; daemonPid: number; title: string }
      assert.ok(pidAlive(saved.daemonPid), "daemon from stage 1 must still be running (stage 2 must start within its 60 s idle window)")
      assert.ok(pidAlive(saved.toolPid), "the CLI process must survive the VS Code restart")

      const restored = await waitFor(() => a.activePanels()[0], 30_000, "VS Code to restore the webview tab and call the serializer").catch(() => undefined)

      if (!restored) {
        // Diagnostic only: exercises the same restore path the serializer would have taken,
        // to tell apart "the daemon/session attach is broken" from "VS Code just never called
        // the serializer" — but this must not paper over the real failure, which is that the
        // serializer did not fire. The test still fails below regardless of what this finds.
        let diagnostic: string
        try {
          const p = vscode.window.createWebviewPanel("cliCode.terminal", "restored", vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [vscode.Uri.file(a.context.extensionPath)],
          })
          await a.restoreTerminalPanel(a.context, p, { sessionId: saved.sessionId, toolId: "codex", customTitle: saved.title })
          await waitFor(() => a.inspectPanel(p).ready, 15_000, "manually-restored webview ready")
          const ok = a.inspectPanel(p).sessionId === saved.sessionId && p.title === saved.title && pidAlive(saved.toolPid)
          diagnostic = ok
            ? "manual restoreTerminalPanel() DID reattach to the saved session/PTY successfully — the daemon and session are fine, only VS Code's own serializer failed to fire"
            : `manual restoreTerminalPanel() also failed to reattach cleanly (sessionId=${a.inspectPanel(p).sessionId}, title=${JSON.stringify(p.title)}, toolPidAlive=${pidAlive(saved.toolPid)})`
          p.dispose()
        } catch (err) {
          diagnostic = `manual restoreTerminalPanel() threw: ${(err as Error).message}`
        }
        throw new Error(`VS Code did not restore the webview tab on its own (no serializer call within 30s). Diagnostic: ${diagnostic}`)
      }

      const panel = restored
      await waitFor(() => a.inspectPanel(panel).ready, 15_000, "restored webview ready")
      assert.equal(a.inspectPanel(panel).sessionId, saved.sessionId)
      assert.equal(panel.title, saved.title)
      assert.ok(pidAlive(saved.toolPid))
      panel.dispose()
      await waitFor(() => !pidAlive(saved.toolPid), 5_000, "PTY killed on close")
    })
  })
}
