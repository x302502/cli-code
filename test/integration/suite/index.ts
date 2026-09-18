// Runs inside the VS Code extension host. Mocha's bdd globals must exist before the
// bundled suites are evaluated, so emit "pre-require" first and require them afterwards.
const Mocha = require("mocha") as typeof import("mocha")

export function run(): Promise<void> {
  const mocha = new Mocha({ ui: "bdd", timeout: 60_000, color: true })
  mocha.suite.emit("pre-require", globalThis, "bundle", mocha)

  const stage = process.env.CLI_CODE_ITEST_STAGE === "2" ? "2" : "1"
  if (stage === "1") {
    require("./smoke.test.js")
  }
  // Later tasks add: session, hooks, commands, lifecycle (stage 1) and reload (both stages).

  return new Promise((resolve, reject) => {
    mocha.run((failures) => (failures > 0 ? reject(new Error(`${failures} integration test(s) failed`)) : resolve()))
  })
}
