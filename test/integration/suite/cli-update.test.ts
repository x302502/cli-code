import * as assert from "node:assert/strict"
import * as fs from "node:fs"
import * as path from "node:path"
import * as vscode from "vscode"
import { api, openReady, outDir, pidAlive, readEnvFile, waitFor } from "./helpers.js"

const quote = (value: string) => `'${value.replace(/'/g, "'\\''")}'`

describe("CLI update and restart", () => {
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
