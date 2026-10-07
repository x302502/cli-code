import * as assert from "node:assert/strict"
import * as fs from "node:fs"
import * as path from "node:path"
import { spawnSync } from "node:child_process"
import * as vscode from "vscode"
import { api, fixture, openReady, outDir, pidAlive, readEnvFile, waitFor } from "./helpers.js"

const quote = (value: string) => `'${value.replace(/'/g, "'\\''")}'`

describe("CLI update and restart", () => {
  for (const identity of ["selected", "unknown", "unsaved"] as const) {
    it(`OMP ${identity}: update resumes only the clicked tab's current conversation or keeps it running`, async () => {
      const tag = `omp-${identity}`
      const selectedId = `${tag}-selected`
      const sessionFile = path.join(outDir(), "OMP profile's sessions", `${selectedId}.jsonl`)
      const config = vscode.workspace.getConfiguration("cliCode")
      const previous = config.get<Record<string, unknown>>("cliUpdates", {})
      const versionFile = path.join(outDir(), `${tag}.version`)
      fs.writeFileSync(versionFile, "1.0.0")
      await config.update("cliUpdates", {
        ...previous,
        [`itest-${tag}`]: {
          versionCommand: `cat ${quote(versionFile)}`,
          latestVersionCommand: "printf '1.1.0'",
          updateCommand: `printf '1.1.0' > ${quote(versionFile)}`,
        },
      }, vscode.ConfigurationTarget.Global)
      const opened = await openReady(tag)
      const sibling = await openReady(`${tag}-sibling`)
      const { a, panel, env, tool } = opened
      tool.historyToolId = "omp"
      tool.resumeCommand = `sh "${fixture("echo-tool.sh")}" --resume {sessionId}`
      sibling.tool.historyToolId = "omp"
      try {
        const oldSession = a.inspectPanel(panel).sessionId
        const siblingSession = a.inspectPanel(sibling.panel).sessionId
        if (identity !== "unknown") {
          for (const id of ["original", selectedId]) {
            const r = spawnSync(process.execPath, [path.resolve(__dirname, "..", "..", "dist", "hook.js")], {
              env: { ...process.env, ...env, ELECTRON_RUN_AS_NODE: "1", CLI_CODE_FROM: "omp", CLI_CODE_FAMILY: "omp" },
              input: JSON.stringify({ hook_event_name: "SessionStart", session_id: id, session_file: sessionFile }),
              encoding: "utf8", timeout: 5_000,
            })
            assert.equal(r.status, 0)
            await waitFor(() => a.inspectPanel(panel).cliSessionId === id, 5_000, "OMP session identity")
          }
          assert.equal(a.inspectPanel(panel).status, undefined, "session selection must not fake agent activity")
          if (identity === "selected") {
            const sessionDir = path.dirname(sessionFile)
            fs.mkdirSync(sessionDir, { recursive: true })
            fs.writeFileSync(sessionFile, JSON.stringify({ type: "session", id: selectedId, cwd: "/tmp" }) + "\n")
          }
        }
        await a.updatePanelCli(a.context, panel)
        assert.equal(fs.readFileSync(versionFile, "utf8"), "1.1.0")
        assert.equal(a.inspectPanel(sibling.panel).sessionId, siblingSession)
        assert.ok(pidAlive(Number(sibling.env.pid)), "sibling must keep running")
        if (identity === "selected") {
          const again = await waitFor(() => {
            const e = readEnvFile(tag)
            return e && e.pid !== env.pid ? e : undefined
          }, 15_000, "OMP restarted process")
          assert.equal(again.argv, `--resume ${sessionFile}`)
          assert.notEqual(a.inspectPanel(panel).sessionId, oldSession)
          assert.equal(a.inspectPanel(panel).cliSessionId, selectedId)
        } else {
          assert.equal(a.inspectPanel(panel).sessionId, oldSession)
          assert.ok(pidAlive(Number(env.pid)), "unknown identity must not kill the running conversation")
        }
      } finally {
        panel.dispose()
        sibling.panel.dispose()
        await config.update("cliUpdates", previous, vscode.ConfigurationTarget.Global)
      }
    })
  }
  for (const mode of ["success", "failure", "external"] as const) {
    it(`${mode}: restarts only after the new version is installed and preserves restore state`, async () => {
      const tag = `update-${mode}`
      const versionFile = path.join(outDir(), `${tag}.version`)
      fs.writeFileSync(versionFile, "1.0.0")
      const config = vscode.workspace.getConfiguration("cliCode")
      const previous = config.get<Record<string, unknown>>("cliUpdates", {})
      await config.update(
        "cliUpdates",
        {
          ...previous,
          [`itest-${tag}`]: {
            versionCommand: `cat ${quote(versionFile)}`,
            latestVersionCommand: "printf '1.1.0'",
            updateCommand: mode === "success" ? `printf '1.1.0' > ${quote(versionFile)}` : "exit 1",
          },
        },
        vscode.ConfigurationTarget.Global,
      )
      let panel: vscode.WebviewPanel | undefined
      try {
        const opened = await openReady(tag)
        panel = opened.panel
        const a = await api()
        const oldSession = a.inspectPanel(panel).sessionId
        const oldPid = Number(opened.env.pid)
        if (mode === "external") fs.writeFileSync(versionFile, "1.1.0")
        await a.updatePanelCli(a.context, panel)
        if (mode === "failure") {
          assert.equal(a.inspectPanel(panel).sessionId, oldSession)
          assert.ok(pidAlive(oldPid), "failed update killed the running CLI")
          assert.equal(fs.readFileSync(versionFile, "utf8"), "1.0.0")
        } else {
          assert.notEqual(a.inspectPanel(panel).sessionId, oldSession)
          await waitFor(
            () => readEnvFile(tag)?.pid && Number(readEnvFile(tag)?.pid) !== oldPid,
            15_000,
            "new CLI process",
          )
          await waitFor(() => !pidAlive(oldPid), 15_000, "old CLI ended")
          const saved = await waitFor(
            () =>
              a.context.workspaceState
                .get<{ state: { sessionId: string; runningCliVersion?: string } }[]>("cliCode.openTabs")
                ?.find((entry) => entry.state.sessionId === a.inspectPanel(panel!).sessionId),
            5_000,
            "updated restore state",
          )
          assert.equal(saved.state.runningCliVersion, "1.1.0")
        }
      } finally {
        panel?.dispose()
        await config.update("cliUpdates", previous, vscode.ConfigurationTarget.Global)
      }
    })
  }
})
