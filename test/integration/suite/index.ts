// Runs inside the VS Code extension host. Mocha's bdd globals must exist before the
// bundled suites are evaluated, so emit "pre-require" first and require them afterwards.
const Mocha = require("mocha") as typeof import("mocha")

export function run(): Promise<void> {
  const mocha = new Mocha({ ui: "bdd", timeout: 60_000, color: true })
  mocha.suite.emit("pre-require", globalThis, "bundle", mocha)

  const stage = process.env.CLI_CODE_ITEST_STAGE === "2" ? "2" : "1"
  if (stage === "1") {
    require("./smoke.test.js")
    require("./session.test.js")
    require("./hooks.test.js")
    require("./commands.test.js")
    require("./lifecycle.test.js")
  }
  require("./reload.test.js")

  return new Promise((resolve, reject) => {
    mocha.run((failures) => {
      // The test window on this machine never becomes the OS-focused app, and its Code
      // process does not reliably quit on its own once this run() promise settles —
      // runTests() then hangs forever waiting for the process to exit. Two mitigations:
      // (1) write the result where run.mjs can read it even if the process has to be
      // force-killed later, and (2) try exiting the extension host ourselves, which is
      // enough on some machines.
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
      setTimeout(() => process.exit(failures > 0 ? 1 : 0), 500)
    })
  })
}
