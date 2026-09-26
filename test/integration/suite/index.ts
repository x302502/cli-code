// Runs inside the VS Code extension host. Mocha's bdd globals must exist before the
// bundled suites are evaluated, so emit "pre-require" first and require them afterwards.
const Mocha = require("mocha") as typeof import("mocha")

export function run(): Promise<void> {
  // 120 s: the lifecycle suite's cumulative waits (spawn, exit, restart, gone, respawn) exceed 60 s.
  const mocha = new Mocha({ ui: "bdd", timeout: 120_000, color: true })
  mocha.suite.emit("pre-require", globalThis, "bundle", mocha)

  const stage = process.env.CLI_CODE_ITEST_STAGE === "2" ? "2" : "1"
  if (stage === "1") {
    require("./smoke.test.js")
    require("./session.test.js")
    require("./hooks.test.js")
    require("./commands.test.js")
    require("./menu.test.js")
    require("./lifecycle.test.js")
  }
  require("./reload.test.js")

  return new Promise((resolve, reject) => {
    mocha.run((failures) => {
      // Written even on success so run.mjs can read the result if the window ever has to
      // be force-killed by its own watchdog (see STAGE_DEADLINE_MS in run.mjs).
      try {
        if (process.env.CLI_CODE_ITEST_OUT) {
          require("node:fs").writeFileSync(
            require("node:path").join(process.env.CLI_CODE_ITEST_OUT, "result.json"),
            JSON.stringify({ failures }),
          )
        }
      } catch {
        // best effort
      }
      failures > 0 ? reject(new Error(`${failures} integration test(s) failed`)) : resolve()
    })
  })
}
