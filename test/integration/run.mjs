// Launches a real VS Code twice (stage 1, then stage 2 against the same user-data-dir so
// the workbench restores stage 1's tabs) and runs dist-test/suite/index.js inside it.
import { runTests } from "@vscode/test-electron"
import { execFileSync } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cli-code-itest-"))
const dirs = { home: path.join(tmp, "home"), udd: path.join(tmp, "udd"), ws: path.join(tmp, "ws"), out: path.join(tmp, "out") }
for (const d of Object.values(dirs)) fs.mkdirSync(d, { recursive: true })
fs.writeFileSync(path.join(dirs.ws, "README.md"), "# itest workspace\n")

const launchArgs = [dirs.ws, "--user-data-dir", dirs.udd, "--disable-extensions", "--disable-workspace-trust", "--skip-welcome", "--skip-release-notes"]

// On some machines the test window's Code process does not quit on its own once
// dist-test/suite/index.js's run() promise settles (its own process.exit() only reaches
// the extension host, not the Electron main process), so runTests() would hang forever.
// Race it against a deadline: if it fires, read the pass/fail count index.ts wrote to
// result.json (real result, even though the process itself had to be force-killed) and
// kill every process launched under this run's unique --user-data-dir. Best-effort on
// POSIX only; on a platform where pkill is unavailable this just falls through to the
// timeout error below.
const STAGE_DEADLINE_MS = 3 * 60_000

function forceKillTestWindow() {
  try {
    // -9: the graceful path is exactly what already failed to exit; nothing left to flush.
    execFileSync("pkill", ["-9", "-f", dirs.udd])
  } catch {
    // no matching process, or pkill unavailable — nothing to do
  }
}

async function runStage(stage) {
  const resultFile = path.join(dirs.out, "result.json")
  fs.rmSync(resultFile, { force: true })
  const outcome = await Promise.race([
    runTests({
      extensionDevelopmentPath: root,
      extensionTestsPath: path.join(root, "dist-test", "suite", "index.js"),
      launchArgs,
      extensionTestsEnv: { HOME: dirs.home, CLI_CODE_ITEST_OUT: dirs.out, CLI_CODE_ITEST_STAGE: String(stage) },
    }).then(
      () => ({ kind: "exited" }),
      (err) => ({ kind: "exited", err }),
    ),
    new Promise((resolve) => setTimeout(() => resolve({ kind: "timeout" }), STAGE_DEADLINE_MS)),
  ])
  if (outcome.kind === "exited") {
    if (outcome.err) throw outcome.err
    return
  }
  // Timed out: the process is still alive even though the tests inside it are done
  // (or hung past mocha's own 60s per-test timeout, in which case result.json is absent).
  forceKillTestWindow()
  const raw = fs.existsSync(resultFile) ? JSON.parse(fs.readFileSync(resultFile, "utf8")) : undefined
  if (!raw) throw new Error(`stage ${stage} did not finish within ${STAGE_DEADLINE_MS}ms and produced no result`)
  if (raw.failures > 0) throw new Error(`${raw.failures} integration test(s) failed (stage ${stage}, window force-killed after it would not exit)`)
}

function killDaemon() {
  const pidFile = path.join(dirs.out, "daemon.pid")
  if (!fs.existsSync(pidFile)) return
  const pid = Number(fs.readFileSync(pidFile, "utf8"))
  try {
    process.kill(pid)
  } catch {
    // already gone
  }
}

let code = 0
try {
  await runStage(1)
  if (!process.env.CLI_CODE_ITEST_SKIP_STAGE2) await runStage(2)
} catch (err) {
  console.error(err)
  code = 1
} finally {
  killDaemon()
  if (process.env.CLI_CODE_ITEST_KEEP) console.log(`kept ${tmp}`)
  else fs.rmSync(tmp, { recursive: true, force: true })
}
process.exit(code)
