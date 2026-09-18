// Launches a real VS Code twice (stage 1, then stage 2 against the same user-data-dir so
// the workbench restores stage 1's tabs) and runs dist-test/suite/index.js inside it.
import { runTests } from "@vscode/test-electron"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cli-code-itest-"))
// No HOME override: overriding HOME for the Electron process breaks Chromium's
// sandbox/helper path resolution on macOS, which silently kills webview script execution
// and console/stdout forwarding from the extension host — see task-2-report.md ("Fix round
// 1"). Tests run against the real HOME instead; smoke.test.ts hashes the real Claude
// settings file before any test runs and checkClaudeSettingsUntouched() below is the safety
// net that fails loudly if anything ever touches it.
const dirs = { udd: path.join(tmp, "udd"), ws: path.join(tmp, "ws"), out: path.join(tmp, "out") }
for (const d of Object.values(dirs)) fs.mkdirSync(d, { recursive: true })
fs.writeFileSync(path.join(dirs.ws, "README.md"), "# itest workspace\n")

const launchArgs = [dirs.ws, "--user-data-dir", dirs.udd, "--disable-extensions", "--disable-workspace-trust", "--skip-welcome", "--skip-release-notes"]

// Safety net: fails loudly if any test wrote to the real Claude settings file, its backup, or
// its atomic-write temp file (see writeSettingsFile in src/lib/claude-hooks.ts). smoke.test.ts
// snapshots the settings file itself (path/exists/sha256 — never its bytes) into
// claude-settings.before at the start of stage 1; the .bak/.tmp siblings never legitimately
// exist, so they're snapshotted right here, before any test window launches.
function statFile(p) {
  const exists = fs.existsSync(p)
  return { path: p, exists, sha256: exists ? createHash("sha256").update(fs.readFileSync(p)).digest("hex") : "" }
}
const realClaudeSettingsPath = path.join(os.homedir(), ".claude", "settings.json")
const beforeSiblings = [statFile(`${realClaudeSettingsPath}.cli-code.bak`), statFile(`${realClaudeSettingsPath}.tmp`)]

function checkClaudeSettingsUntouched() {
  const snapshotFile = path.join(dirs.out, "claude-settings.before")
  const befores = [...beforeSiblings]
  if (fs.existsSync(snapshotFile)) befores.push(JSON.parse(fs.readFileSync(snapshotFile, "utf8")))
  // else: stage hasn't reached the snapshot hook yet (e.g. an early crash)
  for (const before of befores) {
    const now = statFile(before.path)
    if (now.exists !== before.exists || now.sha256 !== before.sha256) {
      throw new Error(`${before.path} changed during the run (a test must never write it; if you edited it yourself, rerun)`)
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
  // The killed daemon can't remove its own socket; only the one path stage 1 recorded.
  const sock = fs.existsSync(path.join(dirs.out, "reload.env"))
    ? fs.readFileSync(path.join(dirs.out, "reload.env"), "utf8").match(/^CLI_CODE_DAEMON_SOCK=(.+)$/m)?.[1]
    : undefined
  if (sock) fs.rmSync(sock, { force: true })
}

function cleanup() {
  killDaemon()
  if (process.env.CLI_CODE_ITEST_KEEP) console.log(`kept ${tmp}`)
  else fs.rmSync(tmp, { recursive: true, force: true })
}

process.on("SIGINT", () => {
  cleanup()
  process.exit(130)
})

let code = 0
try {
  await runStage(1)
  if (!process.env.CLI_CODE_ITEST_SKIP_STAGE2) await runStage(2)
} catch (err) {
  console.error(err)
  code = 1
} finally {
  cleanup()
}
process.exit(code)
