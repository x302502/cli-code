# Integration Tests (real Extension Host) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `bun run test:integration` tier that launches a real VS Code with this extension and machine-checks the daemon/webview/panel behaviour the manual checklist covers (open/type/close, gone/restart, exit/restart, OSC 7 cwd, font zoom, hook bridge → status glyph, hook installer, resume command, quick-command paste, and a real two-stage reload).

**Architecture:** `@vscode/test-electron` downloads VS Code into `.vscode-test/`, launches it with `--extensionDevelopmentPath=<repo>` and a temp `--user-data-dir`/workspace/`HOME`, and runs a mocha bundle (`dist-test/suite/index.js`) inside the extension host. Tests drive the extension through the object `activate()` returns (`extension.exports`). A fake CLI (`test/integration/fixtures/echo-tool.sh`) writes its env/argv/pid and every byte it receives to files the tests read. Reload is tested by running VS Code twice against the same user-data-dir.

**Tech Stack:** `@vscode/test-electron`, `mocha` (+`@types/mocha`), esbuild (existing), bun for scripts, `sh` for the fake tool (macOS/Linux only).

**Spec:** `docs/superpowers/specs/2026-09-18-integration-tests-design.md`

## Global Constraints

- Never touch the real `~/.claude/settings.json`: the VS Code process runs with `HOME` = temp dir; tests must assert the settings path lives under that HOME before writing.
- Never run commands outside this repo (no `code`, no `tccutil`, no system settings). Running `bun run test:integration` opens a VS Code *test* window — that is expected and allowed.
- No runtime behaviour changes beyond the three test-API additions in `src/lib/panel.ts` (`daemonPid`, `inspectPanel`, `restartFromGone`) and `activate()` returning the API.
- User-facing strings stay Vietnamese; test names may be English.
- `bun test` (unit, 147) must keep passing; `bun run compile` and `bun run lint` clean after every task.
- Commit messages end with the attribution lines given in the session's system reminder.

---

## File structure

| Path | Responsibility |
|---|---|
| `test/integration/run.mjs` | Host-side runner: temp dirs, launches VS Code for stage 1 then stage 2, kills the daemon, exits non-zero on failure |
| `test/integration/suite/index.ts` | Mocha entry inside the extension host; registers globals, requires suites by stage |
| `test/integration/suite/helpers.ts` | `api()`, `makeTool()`, `waitFor()`, `readEnvFile()`, `outDir()` |
| `test/integration/suite/session.test.ts` | open/type/OSC 7/close |
| `test/integration/suite/hooks.test.ts` | hook bridge → glyph; installer under temp HOME |
| `test/integration/suite/commands.test.ts` | resume command + restart keeps it; quick-command paste |
| `test/integration/suite/lifecycle.test.ts` | font zoom; exit → restart; daemon killed → gone → restart (runs last in stage 1) |
| `test/integration/suite/reload.test.ts` | stage 1 leaves a tab; stage 2 asserts the restored tab |
| `test/integration/fixtures/echo-tool.sh` | fake CLI |
| `test/integration/tsconfig.json` | type-checks the suite with mocha/node types |
| `src/lib/panel.ts` | + `daemonPid()`, `inspectPanel()`, `restartFromGone()` |
| `src/extension.ts` | `activate()` returns `TestApi` |
| `esbuild.js` | + test bundle entry (only when `--tests`) |
| `package.json` | devDeps + scripts |
| `.gitignore`, `.vscodeignore` | `.vscode-test/`, `dist-test/` |

---

### Task 1: Harness skeleton and smoke test

**Files:**
- Modify: `package.json` (devDependencies, scripts)
- Modify: `esbuild.js`
- Modify: `.gitignore`, `.vscodeignore`
- Modify: `src/extension.ts`
- Create: `test/integration/run.mjs`, `test/integration/suite/index.ts`, `test/integration/suite/helpers.ts`, `test/integration/suite/smoke.test.ts`, `test/integration/tsconfig.json`

**Interfaces:**
- Produces: `TestApi` type exported from `src/extension.ts`; `activate()` returns it. `helpers.ts` exports `api(): Promise<TestApi>`, `waitFor(pred, ms?, label?)`, `outDir(): string`, `stage(): "1" | "2"`.
- Env contract (set by `run.mjs` on the VS Code process): `HOME` (temp), `CLI_CODE_ITEST_OUT` (dir), `CLI_CODE_ITEST_STAGE` (`"1"` or `"2"`).

- [ ] **Step 1: Add dev dependencies and scripts**

```bash
bun add -d @vscode/test-electron@^2.4.1 mocha@^10.7.3 @types/mocha@^10.0.9
```

In `package.json` `scripts`, add:

```json
"build:tests": "bun esbuild.js --tests",
"check-types:integration": "tsc --noEmit --project test/integration/tsconfig.json",
"test:integration": "bun run compile && bun run build:tests && bun run check-types:integration && node test/integration/run.mjs"
```

- [ ] **Step 2: Ignore the VS Code cache and the test bundle**

Append to `.gitignore`:

```
.vscode-test/
dist-test/
```

Append to `.vscodeignore` (before the `node_modules` block):

```
.vscode-test/**
dist-test/**
```

- [ ] **Step 3: Add the test bundle entry to esbuild.js**

Replace the `entries` array and the `production`/`watch` lines with:

```js
const production = process.argv.includes("--production")
const watch = process.argv.includes("--watch")
// `--tests` builds only the integration-test bundle: it must stay out of the
// production build (and the VSIX) and needs `mocha` left external so the
// extension host resolves it from node_modules.
const tests = process.argv.includes("--tests")

const entries = tests
  ? [{ entryPoints: ["test/integration/suite/index.ts"], outfile: "dist-test/suite/index.js", external: ["vscode", "mocha"] }]
  : [
      { entryPoints: ["src/extension.ts"], outfile: "dist/extension.js", external: ["vscode", "node-pty"] },
      { entryPoints: ["src/daemon/entry.ts"], outfile: "dist/daemon.js", external: ["node-pty"] },
      { entryPoints: ["src/hook/entry.ts"], outfile: "dist/hook.js", external: [] },
      { entryPoints: ["src/webview/main.ts"], outfile: "dist/webview.js", platform: "browser", format: "iife" },
    ]
```

- [ ] **Step 4: Return a test API from activate()**

In `src/extension.ts`, add the imports and the type, and make `activate` return it. Keep every existing registration unchanged (the existing imports from `./lib/panel.js` and `./lib/commands.js` stay; merge the new names into them). `listActivePanels` is added in Step 5.

```ts
import * as vscode from "vscode"
import { installHooksToDisk, uninstallHooksFromDisk, hooksInstalledOnDisk, CLAUDE_SETTINGS_PATH } from "./lib/claude-hooks.js"
import { openTerminalPanel, restoreTerminalPanel, restartPanel, setCustomTitle, applyFontZoom, currentFontSize, pasteToActivePanel, writeToActivePanel, listActivePanels, VIEW_TYPE, type PanelState } from "./lib/panel.js"

/** Handed to integration tests via `extension.exports`. Re-exports only; no test-only behaviour. */
export type TestApi = {
  context: vscode.ExtensionContext
  openTerminalPanel: typeof openTerminalPanel
  restoreTerminalPanel: typeof restoreTerminalPanel
  restartPanel: typeof restartPanel
  setCustomTitle: typeof setCustomTitle
  applyFontZoom: typeof applyFontZoom
  currentFontSize: typeof currentFontSize
  pasteToActivePanel: typeof pasteToActivePanel
  writeToActivePanel: typeof writeToActivePanel
  activePanels(): vscode.WebviewPanel[]
  installHooksToDisk: typeof installHooksToDisk
  uninstallHooksFromDisk: typeof uninstallHooksFromDisk
  hooksInstalledOnDisk: typeof hooksInstalledOnDisk
  claudeSettingsPath: string
}

export function activate(context: vscode.ExtensionContext): TestApi {
  // ...existing body unchanged...
  return {
    context,
    openTerminalPanel,
    restoreTerminalPanel,
    restartPanel,
    setCustomTitle,
    applyFontZoom,
    currentFontSize,
    pasteToActivePanel,
    writeToActivePanel,
    activePanels: listActivePanels,
    installHooksToDisk,
    uninstallHooksFromDisk,
    hooksInstalledOnDisk,
    claudeSettingsPath: CLAUDE_SETTINGS_PATH,
  }
}
```

- [ ] **Step 5: Export `listActivePanels` from panel.ts**

In `src/lib/panel.ts`, right after `activeTerminalPanel`:

```ts
/** Snapshot of the open, connected CLI panels (gone panels are excluded). */
export function listActivePanels(): vscode.WebviewPanel[] {
  return [...activePanels]
}
```

- [ ] **Step 6: Create the suite tsconfig**

`test/integration/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "../..",
    "types": ["node", "mocha"],
    "noEmit": true
  },
  "include": ["./suite", "../../src/extension.ts"]
}
```

- [ ] **Step 7: Create helpers.ts**

`test/integration/suite/helpers.ts`:

```ts
import * as vscode from "vscode"
import * as fs from "node:fs"
import * as path from "node:path"
import type { TestApi } from "../../../src/extension.js"

export const EXTENSION_ID = "x302502.cli-code"

export async function api(): Promise<TestApi> {
  const ext = vscode.extensions.getExtension<TestApi>(EXTENSION_ID)
  if (!ext) throw new Error(`extension ${EXTENSION_ID} not found in the test host`)
  return ext.isActive ? ext.exports : await ext.activate()
}

export function outDir(): string {
  const dir = process.env.CLI_CODE_ITEST_OUT
  if (!dir) throw new Error("CLI_CODE_ITEST_OUT is not set — run via test/integration/run.mjs")
  return dir
}

export function stage(): "1" | "2" {
  return process.env.CLI_CODE_ITEST_STAGE === "2" ? "2" : "1"
}

/** Polls `pred` every 50 ms until it returns a truthy value or `ms` elapses. */
export async function waitFor<T>(pred: () => T | undefined | false, ms = 15_000, label = "condition"): Promise<T> {
  const deadline = Date.now() + ms
  for (;;) {
    const v = pred()
    if (v) return v
    if (Date.now() > deadline) throw new Error(`timed out after ${ms} ms waiting for ${label}`)
    await new Promise((r) => setTimeout(r, 50))
  }
}

export function fixture(name: string): string {
  // dist-test/suite/index.js → ../../test/integration/fixtures/<name>
  return path.resolve(__dirname, "..", "..", "test", "integration", "fixtures", name)
}

export function readFileOr(p: string): string | undefined {
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : undefined
}
```

- [ ] **Step 8: Create the mocha entry**

`test/integration/suite/index.ts`:

```ts
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
```

- [ ] **Step 9: Create the smoke test**

`test/integration/suite/smoke.test.ts`:

```ts
import * as assert from "node:assert/strict"
import * as vscode from "vscode"
import { api, EXTENSION_ID } from "./helpers.js"

describe("smoke", () => {
  it("activates and exports the test API", async () => {
    const a = await api()
    assert.ok(vscode.extensions.getExtension(EXTENSION_ID)?.isActive)
    assert.equal(typeof a.openTerminalPanel, "function")
    assert.deepEqual(a.activePanels(), [])
  })

  it("runs with HOME pointed at the temp dir, never the real home", async () => {
    const a = await api()
    assert.ok(process.env.HOME?.includes("cli-code-itest-"), `HOME=${process.env.HOME}`)
    assert.ok(a.claudeSettingsPath.startsWith(process.env.HOME!), a.claudeSettingsPath)
  })
})
```

- [ ] **Step 10: Create the host-side runner**

`test/integration/run.mjs`:

```js
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
```

- [ ] **Step 11: Run it**

Run: `bun run test:integration`
Expected: VS Code downloads into `.vscode-test/` (first run only), a test window opens twice, output shows `smoke` → 2 passing (stage 1) and 0 tests (stage 2), process exits 0. `git status` shows no `.vscode-test/` or `dist-test/`.

If stage 2 fails because the runner tries to run zero suites, that is fine at this task — it just needs to exit 0 (mocha with no tests reports 0 failures).

- [ ] **Step 12: Unit/compile/lint still green, then commit**

Run: `bun test && bun run compile && bun run lint`

```bash
git add package.json bun.lock esbuild.js .gitignore .vscodeignore src/extension.ts src/lib/panel.ts test/integration
git commit -m "test(integration): real Extension Host harness with smoke test and two-stage runner"
```

---

### Task 2: Test-API additions, fake tool, and the session suite (open / type / OSC 7 / close)

**Files:**
- Modify: `src/lib/panel.ts` (`daemonPid`, `inspectPanel`, `restartFromGone`)
- Modify: `src/extension.ts` (add the three to `TestApi`)
- Create: `test/integration/fixtures/echo-tool.sh`
- Modify: `test/integration/suite/helpers.ts` (`makeTool`, `readEnvFile`, `pidAlive`)
- Create: `test/integration/suite/session.test.ts`
- Modify: `test/integration/suite/index.ts`

**Interfaces:**
- Produces in `panel.ts`:
  - `export function daemonPid(): number | undefined`
  - `export function inspectPanel(panel): { sessionId?: string; cwd?: string; status?: { state: AgentState; prompt?: string }; ready: boolean; gone: boolean }`
  - `export async function restartFromGone(context, panel): Promise<void>`
- Produces in `helpers.ts`:
  - `makeTool(tag: string, extraEnv?: Record<string,string>): CliTool` — id `itest-<tag>`, command `sh <abs echo-tool.sh>`, `extraEnv` includes `ITEST_OUT`, `ITEST_TAG`.
  - `readEnvFile(tag): Record<string,string> | undefined` — parses `<out>/<tag>.env` (`KEY=VALUE` lines).
  - `inputFile(tag): string`, `pidAlive(pid): boolean`.

- [ ] **Step 1: Record the daemon pid and expose inspection in panel.ts**

In `src/lib/panel.ts`:

```ts
// pid of the daemon this window spawned (undefined when it attached to one already running).
let spawnedDaemonPid: number | undefined

/** For integration tests: the daemon process this window started, if any. */
export function daemonPid(): number | undefined {
  return spawnedDaemonPid
}
```

Inside `ensureDaemonUncached`, right after `daemon.unref()`:

```ts
  spawnedDaemonPid = daemon.pid
```

After `listActivePanels` add:

```ts
/** For integration tests: what the panel registries currently hold for a panel. */
export function inspectPanel(panel: vscode.WebviewPanel): {
  sessionId?: string
  cwd?: string
  status?: { state: AgentState; prompt?: string }
  ready: boolean
  gone: boolean
} {
  return {
    sessionId: panelConnections.get(panel)?.sessionId,
    cwd: panelCwds.get(panel),
    status: panelStatus.get(panel),
    ready: panelWiring.get(panel)?.ready ?? false,
    gone: panelTools.has(panel) && !activePanels.has(panel),
  }
}
```

- [ ] **Step 2: Extract the gone-page restart into `restartFromGone`**

In `showGone`, replace the message handler body with a call:

```ts
  panel.webview.onDidReceiveMessage((m) => {
    if (m.type === "restart") void restartFromGone(context, panel)
  })
```

and add, right after `showGone`:

```ts
/** Reopens a gone panel's tool in a fresh tab with the same cwd, title and command. */
export async function restartFromGone(context: vscode.ExtensionContext, panel: vscode.WebviewPanel): Promise<void> {
  const tool = panelTools.get(panel)
  if (!tool) return
  const cwd = panelCwds.get(panel)
  const title = customTitles.get(panel)
  const command = panelCommands.get(panel)
  panel.dispose()
  try {
    await openTerminalPanel(context, tool, { cwd, title, command })
  } catch (err) {
    void vscode.window.showErrorMessage(String(err))
  }
}
```

(`showGone` already has `tool` in scope; reading it from `panelTools` inside `restartFromGone` keeps the signature test-friendly. `panelTools` must still hold the tool after `showGone` — check that `showGone` does not delete it; it does not.)

- [ ] **Step 3: Add the three to TestApi**

In `src/extension.ts`: import `daemonPid, inspectPanel, restartFromGone` from `./lib/panel.js`, add to the `TestApi` type

```ts
  daemonPid: typeof daemonPid
  inspectPanel: typeof inspectPanel
  restartFromGone: typeof restartFromGone
```

and to the returned object.

- [ ] **Step 4: Create the fake tool**

`test/integration/fixtures/echo-tool.sh`:

```sh
#!/bin/sh
# Fake CLI for integration tests. Driven entirely by env vars set through CliTool.extraEnv:
#   ITEST_OUT        directory for the files below
#   ITEST_TAG        base name: $TAG.env (env/argv/pid), $TAG.in (every byte received)
#   ITEST_EXIT_CODE  when set, exit with this code right after writing $TAG.env
out="$ITEST_OUT/$ITEST_TAG"
{
  echo "pid=$$"
  echo "ppid=$PPID"
  echo "argv=$*"
  echo "cwd=$(pwd)"
  echo "CLI_CODE_SESSION_ID=$CLI_CODE_SESSION_ID"
  echo "CLI_CODE_DAEMON_SOCK=$CLI_CODE_DAEMON_SOCK"
  echo "CLI_CODE_HOOK=$CLI_CODE_HOOK"
} > "$out.env"
if [ -n "$ITEST_EXIT_CODE" ]; then exit "$ITEST_EXIT_CODE"; fi
# Bracketed paste on (what Claude/Codex do) and an OSC 7 cwd report, then raw mode so
# every byte xterm sends reaches tee unchanged (no ICRNL, no line buffering).
printf '\033[?2004h'
printf '\033]7;file://localhost/tmp\007'
stty raw
exec tee "$out.in"
```

Make it executable: `chmod +x test/integration/fixtures/echo-tool.sh`.

- [ ] **Step 5: Extend helpers.ts**

Append to `test/integration/suite/helpers.ts`:

```ts
import type { CliTool } from "../../../src/lib/config.js"

export function makeTool(tag: string, extraEnv: Record<string, string> = {}): CliTool {
  return {
    id: `itest-${tag}`,
    label: `itest ${tag}`,
    icon: "claude.svg",
    themeIcon: "terminal",
    command: `sh "${fixture("echo-tool.sh")}"`,
    hasHttpApi: false,
    extraEnv: { ITEST_OUT: outDir(), ITEST_TAG: tag, ...extraEnv },
  }
}

export function envFile(tag: string): string {
  return path.join(outDir(), `${tag}.env`)
}
export function inputFile(tag: string): string {
  return path.join(outDir(), `${tag}.in`)
}

export function readEnvFile(tag: string): Record<string, string> | undefined {
  const text = readFileOr(envFile(tag))
  if (!text) return undefined
  const env: Record<string, string> = {}
  for (const line of text.split("\n")) {
    const i = line.indexOf("=")
    if (i > 0) env[line.slice(0, i)] = line.slice(i + 1)
  }
  return env
}

export function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** Opens a panel for `tool`, waits for the webview's ready and the fake tool's env file. */
export async function openReady(tag: string, extraEnv: Record<string, string> = {}, options: Parameters<TestApi["openTerminalPanel"]>[2] = {}) {
  const a = await api()
  const tool = makeTool(tag, extraEnv)
  const before = new Set(a.activePanels())
  await a.openTerminalPanel(a.context, tool, options)
  const panel = await waitFor(() => a.activePanels().find((p) => !before.has(p)), 15_000, `panel for ${tag}`)
  await waitFor(() => a.inspectPanel(panel).ready, 15_000, `webview ready for ${tag}`)
  const env = await waitFor(() => readEnvFile(tag), 15_000, `${tag}.env`)
  return { a, tool, panel, env }
}
```

Note `imports` must be at the top of the file — move the `CliTool` import up with the others.

- [ ] **Step 6: Write the session suite**

`test/integration/suite/session.test.ts`:

```ts
import * as assert from "node:assert/strict"
import { inputFile, openReady, pidAlive, readFileOr, waitFor } from "./helpers.js"

describe("session (checklist A-a, A-d, B OSC 7)", () => {
  it("opens a tab whose PTY is stamped with the session id and daemon socket", async () => {
    const { a, panel, env } = await openReady("open")
    assert.equal(env.CLI_CODE_SESSION_ID, a.inspectPanel(panel).sessionId)
    assert.ok(env.CLI_CODE_DAEMON_SOCK.endsWith(".sock"), env.CLI_CODE_DAEMON_SOCK)
    assert.match(env.CLI_CODE_HOOK, /dist\/hook\.js/)
    assert.equal(panel.title, "itest open")
    panel.dispose()
  })

  it("delivers typed bytes to the PTY verbatim", async () => {
    const { a, panel } = await openReady("type")
    // Let the fake tool reach `tee` before typing; its env file is written first.
    await new Promise((r) => setTimeout(r, 300))
    assert.ok(a.writeToActivePanel("hi\r"))
    await waitFor(() => readFileOr(inputFile("type")) === "hi\r", 10_000, "hi\\r in type.in")
    panel.dispose()
  })

  it("tracks the cwd reported through OSC 7", async () => {
    const { a, panel } = await openReady("osc7")
    await waitFor(() => a.inspectPanel(panel).cwd === "/tmp", 10_000, "cwd from OSC 7")
    panel.dispose()
  })

  it("kills the PTY when the tab is closed", async () => {
    const { a, panel, env } = await openReady("close")
    const pid = Number(env.pid)
    assert.ok(pidAlive(pid))
    panel.dispose()
    await waitFor(() => !pidAlive(pid), 5_000, `pid ${pid} to exit`)
    assert.ok(!a.activePanels().includes(panel))
  })
})
```

- [ ] **Step 7: Register the suite**

In `index.ts` stage 1 block: `require("./session.test.js")` after the smoke test.

- [ ] **Step 8: Run**

Run: `CLI_CODE_ITEST_SKIP_STAGE2=1 bun run test:integration`
Expected: 6 passing. If "delivers typed bytes" fails with `hi\n`, `stty raw` did not apply (zsh `-lc` started a non-tty?) — check `$TAG.in` contents and report; do not weaken the assertion.

- [ ] **Step 9: Commit**

```bash
git add src/lib/panel.ts src/extension.ts test/integration
git commit -m "test(integration): fake CLI, panel inspection API and session suite (open, type, OSC 7, close)"
```

---

### Task 3: Hooks suite (bridge → status glyph, installer under temp HOME)

**Files:**
- Create: `test/integration/suite/hooks.test.ts`
- Modify: `test/integration/suite/index.ts`

**Interfaces:**
- Consumes: `openReady`, `readEnvFile`, `api`, `waitFor`; `dist/hook.js` at `<repo>/dist/hook.js` (`path.resolve(__dirname, "..", "..", "dist", "hook.js")`).

- [ ] **Step 1: Write the suite**

`test/integration/suite/hooks.test.ts`:

```ts
import * as assert from "node:assert/strict"
import * as fs from "node:fs"
import * as path from "node:path"
import { spawnSync } from "node:child_process"
import { api, openReady, waitFor } from "./helpers.js"

const HOOK = path.resolve(__dirname, "..", "..", "dist", "hook.js")

function fireHook(env: Record<string, string>, payload: Record<string, unknown>): void {
  // The extension host's execPath is Electron; run it as node, exactly as CLI_CODE_HOOK does.
  const r = spawnSync(process.execPath, [HOOK], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", CLI_CODE_SESSION_ID: env.CLI_CODE_SESSION_ID, CLI_CODE_DAEMON_SOCK: env.CLI_CODE_DAEMON_SOCK },
    input: JSON.stringify(payload),
    encoding: "utf8",
    timeout: 5_000,
  })
  assert.equal(r.status, 0, `hook exit ${r.status}: ${r.stderr}`)
  assert.equal(r.stdout, "", "hook must never print to stdout")
}

describe("claude hooks (checklist D)", () => {
  it("hook events change the tab glyph: working → waiting, idle ignored, stop clears", async () => {
    const { a, panel, env } = await openReady("hook")
    fireHook(env, { hook_event_name: "UserPromptSubmit", prompt: "sửa bug" })
    await waitFor(() => panel.title.startsWith("⟳ "), 10_000, "working glyph")
    assert.equal(a.inspectPanel(panel).status?.state, "working")

    fireHook(env, { hook_event_name: "Notification", notification_type: "permission_prompt" })
    await waitFor(() => panel.title.startsWith("? "), 10_000, "waiting glyph")

    fireHook(env, { hook_event_name: "Notification", notification_type: "idle_prompt" })
    await new Promise((r) => setTimeout(r, 500))
    assert.ok(panel.title.startsWith("? "), `idle_prompt must not change the glyph, got ${panel.title}`)

    fireHook(env, { hook_event_name: "Stop" })
    // The panel is visible, so "done" shows no unread dot — the plain title comes back.
    await waitFor(() => !/^[⟳?●] /.test(panel.title), 10_000, "plain title after Stop")
    assert.equal(a.inspectPanel(panel).status?.state, "done")
    panel.dispose()
  })

  it("installer writes only under the temp HOME, keeps a backup and other keys", async () => {
    const a = await api()
    assert.ok(a.claudeSettingsPath.startsWith(process.env.HOME!), a.claudeSettingsPath)
    fs.mkdirSync(path.dirname(a.claudeSettingsPath), { recursive: true })
    fs.writeFileSync(a.claudeSettingsPath, '{"foo":1}\n')

    assert.equal(a.installHooksToDisk(), true)
    assert.equal(a.hooksInstalledOnDisk(), true)
    const settings = JSON.parse(fs.readFileSync(a.claudeSettingsPath, "utf8"))
    assert.equal(settings.foo, 1)
    for (const ev of ["UserPromptSubmit", "Stop", "Notification", "PermissionRequest"]) {
      assert.ok(Array.isArray(settings.hooks?.[ev]), `hooks.${ev} missing`)
    }
    assert.equal(fs.readFileSync(`${a.claudeSettingsPath}.cli-code.bak`, "utf8"), '{"foo":1}\n')

    assert.equal(a.uninstallHooksFromDisk(), true)
    assert.equal(a.hooksInstalledOnDisk(), false)
    assert.equal(JSON.parse(fs.readFileSync(a.claudeSettingsPath, "utf8")).foo, 1)
  })
})
```

- [ ] **Step 2: Register** — `require("./hooks.test.js")` in stage 1 after session.

- [ ] **Step 3: Run** — `CLI_CODE_ITEST_SKIP_STAGE2=1 bun run test:integration` → 8 passing.

- [ ] **Step 4: Commit**

```bash
git add test/integration
git commit -m "test(integration): hook bridge drives the status glyph; installer stays under the temp HOME"
```

---

### Task 4: Commands suite (resume command survives restart, quick-command paste)

**Files:**
- Create: `test/integration/suite/commands.test.ts`
- Modify: `test/integration/suite/index.ts`

- [ ] **Step 1: Write the suite**

`test/integration/suite/commands.test.ts`:

```ts
import * as assert from "node:assert/strict"
import { fixture, inputFile, openReady, readEnvFile, readFileOr, waitFor } from "./helpers.js"

describe("commands (checklist E)", () => {
  it("a tab opened with a resume command restarts with the same command", async () => {
    const command = `sh "${fixture("echo-tool.sh")}" --resume abc123`
    const { a, panel, env } = await openReady("resume", {}, { command, title: "Phiên cũ" })
    assert.equal(env.argv, "--resume abc123")
    assert.equal(panel.title, "Phiên cũ")
    const firstPid = env.pid

    await a.restartPanel(a.context, panel)
    const again = await waitFor(() => {
      const e = readEnvFile("resume")
      return e && e.pid !== firstPid ? e : undefined
    }, 15_000, "env file from the restarted tool")
    assert.equal(again.argv, "--resume abc123")
    assert.equal(panel.title, "Phiên cũ")
    panel.dispose()
  })

  it("a multi-line quick command arrives as one bracketed paste followed by a single Enter", async () => {
    const { a, panel } = await openReady("quick")
    await new Promise((r) => setTimeout(r, 300))
    assert.ok(a.pasteToActivePanel("dòng 1\ndòng 2\ndòng 3", true))
    const expected = "\x1b[200~dòng 1\rdòng 2\rdòng 3\x1b[201~\r"
    await waitFor(() => readFileOr(inputFile("quick")) === expected, 10_000, "bracketed paste in quick.in")
    panel.dispose()
  })
})
```

- [ ] **Step 2: Register** — `require("./commands.test.js")` after hooks.

- [ ] **Step 3: Run** — `CLI_CODE_ITEST_SKIP_STAGE2=1 bun run test:integration` → 10 passing. If the paste assertion fails, print the actual bytes (`JSON.stringify(readFileOr(...))`) in the error and report — the expected string encodes the Phase 8 fix (one paste, one Enter), do not change it without a reason.

- [ ] **Step 4: Commit**

```bash
git add test/integration
git commit -m "test(integration): resume command survives restart; quick commands paste once and submit once"
```

---

### Task 5: Lifecycle suite (font zoom, exit → restart, daemon killed → gone → restart)

**Files:**
- Create: `test/integration/suite/lifecycle.test.ts`
- Modify: `test/integration/suite/index.ts`

- [ ] **Step 1: Write the suite**

`test/integration/suite/lifecycle.test.ts`:

```ts
import * as assert from "node:assert/strict"
import { api, openReady, pidAlive, readEnvFile, waitFor } from "./helpers.js"

describe("lifecycle (checklist B, A-e)", () => {
  it("font zoom steps and resets the persisted size", async () => {
    const a = await api()
    const base = a.currentFontSize(a.context)
    await a.applyFontZoom(a.context, 1)
    assert.equal(a.currentFontSize(a.context), base + 1)
    await a.applyFontZoom(a.context, -1)
    await a.applyFontZoom(a.context, -1)
    assert.equal(a.currentFontSize(a.context), base - 1)
    await a.applyFontZoom(a.context, "reset")
    assert.equal(a.currentFontSize(a.context), base)
  })

  it("a tool that exits can be restarted in the same tab, keeping its title", async () => {
    const { a, panel, env } = await openReady("exit", { ITEST_EXIT_CODE: "3" }, { title: "Giữ tên" })
    const firstPid = Number(env.pid)
    await waitFor(() => !pidAlive(firstPid), 5_000, "tool to exit")
    assert.ok(a.activePanels().includes(panel), "an exited tab stays open for restart")

    await a.restartPanel(a.context, panel)
    await waitFor(() => Number(readEnvFile("exit")?.pid) !== firstPid, 15_000, "restarted tool")
    assert.equal(panel.title, "Giữ tên")
    assert.ok(a.activePanels().includes(panel))
    panel.dispose()
  })

  // Runs last in stage 1: it kills this window's daemon.
  it("a dead daemon turns the tab into the gone page, and restart opens a fresh session", async () => {
    const { a, panel, env } = await openReady("gone", {}, { title: "Sau khi chết" })
    const daemon = a.daemonPid()
    assert.ok(daemon, "this window must have spawned the daemon")
    process.kill(daemon)

    await waitFor(() => a.inspectPanel(panel).gone, 15_000, "gone page")
    assert.ok(panel.webview.html.includes("Khởi động lại"))
    assert.ok(!a.activePanels().includes(panel))

    await a.restartFromGone(a.context, panel)
    const fresh = await waitFor(() => a.activePanels().find((p) => p !== panel), 20_000, "fresh panel")
    await waitFor(() => a.inspectPanel(fresh).ready, 15_000, "fresh webview ready")
    const again = await waitFor(() => {
      const e = readEnvFile("gone")
      return e && e.pid !== env.pid ? e : undefined
    }, 15_000, "fresh tool env")
    assert.notEqual(again.CLI_CODE_DAEMON_SOCK, undefined)
    assert.equal(fresh.title, "Sau khi chết")
    assert.notEqual(a.daemonPid(), daemon, "a new daemon was spawned")
    fresh.dispose()
  })
})
```

- [ ] **Step 2: Register** — `require("./lifecycle.test.js")` **last** in stage 1 (before the reload suite added in Task 6).

- [ ] **Step 3: Run** — `CLI_CODE_ITEST_SKIP_STAGE2=1 bun run test:integration` → 13 passing.

- [ ] **Step 4: Commit**

```bash
git add test/integration
git commit -m "test(integration): font zoom, exit→restart and daemon-death→gone→restart"
```

---

### Task 6: Two-stage reload suite and developer docs

**Files:**
- Create: `test/integration/suite/reload.test.ts`
- Modify: `test/integration/suite/index.ts`
- Modify: `README.md` (Development section), `CHANGELOG.md`

**Interfaces:**
- Stage 1 writes `<out>/stage1.json`: `{ sessionId, toolPid, daemonPid, title }` and `<out>/daemon.pid` (for the runner).
- Stage 2 reads them.

- [ ] **Step 1: Write the suite**

`test/integration/suite/reload.test.ts`:

```ts
import * as assert from "node:assert/strict"
import * as fs from "node:fs"
import * as path from "node:path"
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

      const panel = await waitFor(() => a.activePanels()[0], 30_000, "VS Code to restore the webview tab and call the serializer")
      await waitFor(() => a.inspectPanel(panel).ready, 15_000, "restored webview ready")
      assert.equal(a.inspectPanel(panel).sessionId, saved.sessionId)
      assert.equal(panel.title, saved.title)
      assert.ok(pidAlive(saved.toolPid))
      panel.dispose()
      await waitFor(() => !pidAlive(saved.toolPid), 5_000, "PTY killed on close")
    })
  })
}
```

- [ ] **Step 2: Register in index.ts**

Final `index.ts` require block:

```ts
  if (stage === "1") {
    require("./smoke.test.js")
    require("./session.test.js")
    require("./hooks.test.js")
    require("./commands.test.js")
    require("./lifecycle.test.js")
  }
  require("./reload.test.js")
```

- [ ] **Step 3: Run both stages**

Run: `bun run test:integration`
Expected: stage 1 → 14 passing; stage 2 → 1 passing; exit 0.

**If stage 2 times out waiting for the restored tab** (VS Code did not restore the webview after a test-mode quit): keep the assertion but add a fallback path in the stage-2 test *before* the `waitFor`: if `a.activePanels().length === 0` after 10 s, create the panel yourself and call the serializer path directly —

```ts
      const restored = await Promise.race([
        waitFor(() => a.activePanels()[0], 10_000, "restore").catch(() => undefined),
      ])
      const panel = restored ?? (await (async () => {
        const p = vscode.window.createWebviewPanel("cliCode.terminal", "restored", vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.file(a.context.extensionPath)] })
        await a.restoreTerminalPanel(a.context, p, { sessionId: saved.sessionId, toolId: "codex", customTitle: saved.title })
        return p
      })())
```

(`restoreTerminalPanel` resolves the tool from `CLI_TOOLS` by `toolId`, which is why stage 1 opens the real `codex` tool with a command override. Add `import * as vscode from "vscode"` for the fallback.) Record in your report which path ran — the fallback still proves attach-after-restart, but not that VS Code's serializer fired.

- [ ] **Step 4: Docs**

`README.md` — in the development/contributing section (search for `bun test`), add:

```markdown
- `bun run test:integration` — launches a real VS Code (downloaded once into `.vscode-test/`) and runs the suites in `test/integration/suite/` inside the extension host: open/type/close, gone/restart, hook → status glyph, resume/quick commands, and a real two-stage reload. macOS/Linux only; opens a test window; uses a temp `HOME`, so your `~/.claude/settings.json` is never touched.
```

`CHANGELOG.md` under 0.2.0: `- Integration tests in a real Extension Host (`bun run test:integration`).`

- [ ] **Step 5: Full green, commit**

Run: `bun test && bun run compile && bun run lint && bun run test:integration`

```bash
git add test/integration README.md CHANGELOG.md
git commit -m "test(integration): two-stage reload keeps the PTY, session and title; document the tier"
```

---

## Self-review

- **Spec coverage:** isolation (T1 runner + smoke asserts HOME), test API (T1/T2), fake tool (T2), coverage rows A-a/A-d/OSC 7 (T2), D (T3), E (T4), B zoom/exit/A-e gone (T5), A-b/A-f reload (T6), docs (T6). Non-goals untouched.
- **Placeholders:** none; the only conditional is the documented stage-2 fallback.
- **Type consistency:** `inspectPanel` shape identical in panel.ts, TestApi and suites; `openReady` returns `{ a, tool, panel, env }` everywhere; `readEnvFile(tag)` returns `Record<string,string> | undefined`; `daemonPid()` returns `number | undefined`.
