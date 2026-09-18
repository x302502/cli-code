// Launches a real VS Code twice (stage 1, then stage 2 against the same user-data-dir so
// the workbench restores stage 1's tabs) and runs dist-test/suite/index.js inside it.
import { runTests } from "@vscode/test-electron"
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

async function runStage(stage) {
  await runTests({
    extensionDevelopmentPath: root,
    extensionTestsPath: path.join(root, "dist-test", "suite", "index.js"),
    launchArgs,
    extensionTestsEnv: { HOME: dirs.home, CLI_CODE_ITEST_OUT: dirs.out, CLI_CODE_ITEST_STAGE: String(stage) },
  })
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
