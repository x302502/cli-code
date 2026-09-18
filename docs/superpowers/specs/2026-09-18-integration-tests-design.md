# Integration tests in a real Extension Host — design

**Date:** 2026-09-18 · **Branch:** `feat/custom-terminal` · **Status:** approved in chat

## Why

Phases 1–9 (56 commits) have only unit tests (fake PTY, `vscode` mock) and read-through reviews. Nothing has run inside a real VS Code. The manual checklist has 45 items; the user asked to automate what a machine can, leaving only the genuinely manual items (IME, right-click, real Claude/Codex, CI on 3 OS).

## What

A second test tier, `bun run test:integration`, that launches a real VS Code (via `@vscode/test-electron`) with this extension in development mode and drives it through the extension's own exported API. It runs on macOS/Linux only (the fake tool is a `sh` script).

### Isolation

- Separate `--user-data-dir` and workspace folder under `os.tmpdir()`, `--disable-extensions`, `--disable-workspace-trust`.
- `HOME` is overridden to a temp dir for the VS Code process → `CLAUDE_SETTINGS_PATH` (`os.homedir()`) never points at the real `~/.claude/settings.json`; the login shell loads no user rc files.
- VS Code binary cached in `.vscode-test/` (gitignored, vscodeignored). Build output in `dist-test/` (same).

### Test API

`activate()` returns an object (VS Code convention: `extension.exports`). Everything is a re-export of existing functions plus three small additions in `src/lib/panel.ts`:

```ts
export type TestApi = {
  openTerminalPanel, restoreTerminalPanel, restartPanel, restartFromGone,
  setCustomTitle, applyFontZoom, currentFontSize, pasteToActivePanel, writeToActivePanel,
  activePanels(): vscode.WebviewPanel[]
  inspectPanel(panel): { sessionId?: string; cwd?: string; status?: { state; prompt? }; ready: boolean; gone: boolean }
  daemonPid(): number | undefined
  installHooksToDisk, uninstallHooksFromDisk, hooksInstalledOnDisk, claudeSettingsPath: string
  context: vscode.ExtensionContext
}
```

Additions: `daemonPid()` (pid recorded in `ensureDaemonUncached`), `inspectPanel()` (reads the registries), `restartFromGone(context, panel)` (the body of the gone page's `restart` handler, extracted so a test can call it).

### Fake tool

`test/integration/fixtures/echo-tool.sh`, launched as `sh <abs path>` through the normal `$SHELL -lc` path, so env stamping, cwd, OSC and kill semantics are the real ones. Driven by `extraEnv` on a per-test `CliTool`:

- `ITEST_OUT` dir, `ITEST_TAG` name → writes `$ITEST_OUT/$TAG.env` (`pid`, `ppid`, `argv`, `cwd`, `CLI_CODE_SESSION_ID`, `CLI_CODE_DAEMON_SOCK`), then on exit `$TAG.exited` (via `trap EXIT`).
- `ITEST_EXIT_CODE` set → exit immediately with that code (exit-overlay/restart tests).
- Otherwise: prints `ESC[?2004h` (bracketed paste on) and `OSC 7 file://localhost/tmp`, `stty raw`, then `exec tee $TAG.in` — every byte the PTY receives lands in `$TAG.in` verbatim.

### Two-stage reload

Reload Window cannot run inside a test (it kills the test host). Instead the runner launches VS Code twice with the same user-data-dir and workspace:

1. Stage 1 opens a tab, renames it, records `sessionId`, tool pid, daemon pid, and the workspaceState daemon id to `$ITEST_OUT/stage1.json`, and exits without disposing the panel.
2. Stage 2 starts within the daemon's 60 s idle window. VS Code runs extension tests (`--extensionTestsPath`) with in-memory storage, so `workspaceState` and the workbench editor layout are never written to disk between the two launches — VS Code itself never calls our webview serializer here, and no two-launch test can make it. The test instead re-seeds the daemon id into `workspaceState` (replaying what test mode skips persisting) and calls the serializer's own body, `restoreTerminalPanel()`, directly, asserting the same `sessionId`, same custom title, tool pid still alive, `ready` true (snapshot delivered), and that closing the panel kills the PTY. VS Code's own invocation of the serializer on a real reload remains a manual check (Reload Window, checklist A-b/A-f).

`CLI_CODE_ITEST_STAGE` selects which suites run. Stage-1-only suites are all others.

### Coverage map

| Checklist | Automated by |
|---|---|
| A-a open/type | session.test: `ready`, `writeToActivePanel("hi\r")` → `.in` = `hi\r` |
| A-b reload keeps process, A-f rename survives | reload.test (two stages) |
| A-d close kills | session.test: `panel.dispose()` → `.exited` |
| A-e daemon dies → gone → restart | lifecycle.test: `process.kill(daemonPid())`, html has "Khởi động lại", `restartFromGone` |
| B zoom, exit→restart, OSC 7 cwd | lifecycle.test + session.test |
| D hook → glyph, installer | hooks.test: spawn `dist/hook.js` with the env from `.env`; `installHooksToDisk()` lands under temp HOME |
| E resume command, quick command paste | commands.test: argv contains `--resume abc`; `.in` = `ESC[200~l1\rl2\rl3ESC[201~\r` |

Not automated (stay manual): Vietnamese IME + Shift+Enter, right-click menu, first-run hook toast, real Claude/Codex status & resume list, link popover, >100 KB clipboard paste, GitHub Actions on 3 OS, Phase 0 probe.

### Non-goals

No CI job in this change (local first; a macOS runner job can follow). No Windows support for the harness. No changes to runtime behaviour beyond the three test-API additions.
