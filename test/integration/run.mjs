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
// No HOME override: overriding HOME for the Electron process breaks Chromium's
// sandbox/helper path resolution on macOS, which silently kills webview script execution
// and console/stdout forwarding from the extension host — see task-2-report.md ("Fix round
// 1"). Tests run against the real HOME instead; smoke.test.ts snapshots the real Claude
// settings file and checkClaudeSettingsUntouched() below is the safety net that fails
// loudly if anything ever touches it.
const dirs = { udd: path.join(tmp, "udd"), ws: path.join(tmp, "ws"), out: path.join(tmp, "out") }
for (const d of Object.values(dirs)) fs.mkdirSync(d, { recursive: true })
fs.writeFileSync(path.join(dirs.ws, "README.md"), "# itest workspace\n")

const launchArgs = [dirs.ws, "--user-data-dir", dirs.udd, "--disable-extensions", "--disable-workspace-trust", "--skip-welcome", "--skip-release-notes"]

// Safety net: fails loudly if any test wrote to the real Claude settings file, its backup, or
// its atomic-write temp file (see writeSettingsFile in src/lib/claude-hooks.ts). smoke.test.ts
// snapshots the settings file itself (path/exists/bytes) into claude-settings.before at the
// start of stage 1; the .bak/.tmp siblings never legitimately exist, so they're snapshotted
// right here, before any test window launches.
function statFile(p) {
  const exists = fs.existsSync(p)
  return { path: p, exists, base64: exists ? fs.readFileSync(p).toString("base64") : "" }
}
const realClaudeSettingsPath = path.join(os.homedir(), ".claude", "settings.json")
const beforeSiblings = [statFile(`${realClaudeSettingsPath}.cli-code.bak`), statFile(`${realClaudeSettingsPath}.tmp`)]

function checkClaudeSettingsUntouched() {
  const snapshotFile = path.join(dirs.out, "claude-settings.before")
  if (fs.existsSync(snapshotFile)) {
    const before = JSON.parse(fs.readFileSync(snapshotFile, "utf8"))
    const existsNow = fs.existsSync(before.path)
    const base64Now = existsNow ? fs.readFileSync(before.path).toString("base64") : ""
    if (existsNow !== before.exists || base64Now !== before.base64) {
      throw new Error(`integration tests modified the real Claude settings file at ${before.path} — this must never happen`)
    }
  } // else: stage hasn't reached the snapshot test yet (e.g. an early crash)
  for (const before of beforeSiblings) {
    const now = statFile(before.path)
    if (now.exists !== before.exists || now.base64 !== before.base64) {
      throw new Error(`integration tests modified ${before.path} — this must never happen`)
    }
  }
}

// Safety net, not the normal path: with HOME left alone (above) the window exits on its
// own within seconds. This only matters if something else ever makes it hang again — race
// runTests() against a deadline, and if it fires, read the pass/fail count index.ts wrote
// to result.json and kill every process under this run's unique --user-data-dir.
// Best-effort/POSIX-only; on a platform without pkill this just falls through to the error.
// 10 minutes: more suites are coming (hooks, commands, lifecycle, reload) and each stage
// launches a real VS Code window on top of running its own tests.
const STAGE_DEADLINE_MS = 10 * 60_000

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
      extensionTestsEnv: { CLI_CODE_ITEST_OUT: dirs.out, CLI_CODE_ITEST_STAGE: String(stage) },
    }).then(
      () => ({ kind: "exited" }),
      (err) => ({ kind: "exited", err }),
    ),
    new Promise((resolve) => setTimeout(() => resolve({ kind: "timeout" }), STAGE_DEADLINE_MS)),
  ])
  if (outcome.kind === "timeout") {
    // Still alive even though the tests inside it are done (or hung past mocha's own
    // 60s per-test timeout, in which case result.json is absent).
    forceKillTestWindow()
  }
  // Runs regardless of pass/fail/timeout: a real-settings write is a bigger problem than
  // any test failure, so it must never be masked by one.
  checkClaudeSettingsUntouched()
  if (outcome.kind === "exited") {
    if (outcome.err) throw outcome.err
    return
  }
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
