# Multi-CLI status hooks — design

Status: approved in chat 2026-09-21 (scope "nhóm 1 + 2", install policy "tự cài im lặng", approach A).
Research: `.superpowers/cli-hooks-report.md` (each CLI's real hook mechanism, verified on this machine),
`.superpowers/orca-hooks-report.md` (how Orca does it).

## Goal

Every supported CLI tab shows agent state (working / waiting / done), fires the "finished" toast and
reports its own session id (so Restart Session lands in the same conversation) — today only Claude does.

CLIs in this wave: claude (already), codex, copilot, droid, grok, opencode, kilo, mimo, pi, omp.
Deferred: cursor, cline, command-code (start/done only), antigravity (blocking hooks), amp (plugins gated).

## Transport (unchanged)

The CLI's hook config runs one fixed shell line, `HOOK_COMMAND`:

    [ -n "$CLI_CODE_HOOK" ] && eval "$CLI_CODE_HOOK" || true

`CLI_CODE_HOOK` (+ `CLI_CODE_DAEMON_SOCK`, `CLI_CODE_SESSION_ID`) is stamped into the env of every tab the
extension spawns, and evaluates to `ELECTRON_RUN_AS_NODE=1 <electron> dist/hook.js`. `hook.js` reads the
JSON payload from stdin, maps it with `mapHookEvent`, and sends one `StatusReport` frame to the daemon.
Outside CLI Code the env is empty and the hook is a no-op. No HTTP server, no token, no endpoint file.

## Installers (`src/lib/hooks/`)

Common shape: pure `install(old) → {value, changed}` / `uninstall` / `installed` over the parsed file, plus a
thin disk layer (read; one-time `<file>.cli-code.bak`; atomic tmp+rename). Managed marker = the hook's
command is exactly `HOOK_COMMAND` (JSON formats) or a `// @cli-code-managed` header (plugin files).

| CLI | File(s) | Format | Events registered |
|---|---|---|---|
| claude | `~/.claude/settings.json` `hooks` | Claude groups `{hooks:[{type:"command",command}]}` | UserPromptSubmit, Stop, Notification, PermissionRequest |
| droid | `~/.factory/settings.json` `hooks` | same code as claude | UserPromptSubmit, Stop, Notification |
| codex | `~/.codex/hooks.json` `hooks` + `~/.codex/config.toml` | Claude groups, our group **appended**; per hook a `[hooks.state."<hooks.json>:<event_snake>:<g>:<i>"]` block with `enabled = true` and `trusted_hash = "sha256:<hex>"` where hex = sha256 of `JSON.stringify(sortKeys({event_name, hooks:[{async:false,command,timeout:10,type}]}))` (formula verified against 16 existing entries on this machine) | UserPromptSubmit, Stop, PermissionRequest |
| copilot | `~/.copilot/hooks/cli-code.json` (own file) | `{version:1, hooks:{<Event>:[{type:"command", bash: HOOK_COMMAND, timeoutSec:5}]}}` | UserPromptSubmit, Stop, PermissionRequest, Notification |
| grok | `~/.grok/hooks/cli-code.json` (own file) | Claude groups | UserPromptSubmit, Stop, StopFailure, StopCancelled, Notification |
| opencode / kilo / mimo | `~/.config/{opencode,kilo,mimocode}/plugins/cli-code-status.ts` | generated plugin (below) | chat.message, event session.idle, permission.ask |
| pi / omp | `~/.pi/agent/extensions/cli-code-status.ts`, `~/.omp/agent/extensions/cli-code-status.ts` | generated extension (below) | before_agent_start, agent_settled (pi) / agent_end !willContinue (omp), ui_prompt_start (pi) / tool_approval_requested (omp) |

Codex TOML is edited as text: our blocks are appended at EOF; removal deletes blocks whose `trusted_hash`
equals the hash of our own command (content-addressed, so a shifted group index cannot orphan them).

## Generated plugin / extension file

One template (`src/lib/hooks/plugin-template.ts`), header `// @cli-code-managed v1 — CLI Code status
plugin; safe to delete`. It reads `process.env.CLI_CODE_HOOK`; when unset it registers nothing. For each
event it builds a Claude-shaped payload `{hook_event_name, session_id, cwd?, prompt?}` and runs
`spawn("sh", ["-c", CLI_CODE_HOOK], {stdio:["pipe","ignore","ignore"], detached:true})`, writes the JSON
to stdin, `unref()`s; never awaits, never throws. Two flavours differ only in the event table:
`opencode` (plugin API) and `pi`/`omp` (extension API).

## Mapping (`hook-map.ts`)

Accept snake_case and camelCase (`hookEventName`, `sessionId`, `notificationType`, `promptId`).
UserPromptSubmit → working (prompt); Stop / StopFailure / StopCancelled → done; PermissionRequest → waiting;
Notification → waiting only for `permission_prompt` / `elicitation_dialog` / no type; every other
notification type (idle_prompt, task_complete, agent_completed, agent_idle, auth_success, …) is ignored.
Grok and cursor also load `~/.claude/settings.json` hooks, so one event may arrive twice with the same
state — harmless, not deduplicated.

## Install policy

Setting `cliCode.statusHooks` (boolean, default true) replaces `cliCode.claudeStatusHooks` (ask/on/off).
On activation (not in extension-test mode), for every installer whose binary is on PATH: install when
not installed (silent, backup kept). When the setting is false, or turns false: uninstall everywhere.
Commands `CLI Code: Install Status Hooks` / `Remove Status Hooks` act on all supported CLIs and report
a summary toast. Windows is skipped entirely (the hook line needs `sh`). Failures per CLI are logged to
the output channel, never thrown across CLIs.

## Tests

- Unit: each pure merge/remove/installed function on fixtures shaped like the real files (including a
  user hook that must survive); codex hash against a known vector; TOML append/remove; hook-map camelCase.
- Plugin behaviour: load the generated file in bun with a fake host API and `CLI_CODE_HOOK` pointing at a
  capture script; assert the payloads for each event.
- Integration: existing hooks suite (Claude installer via explicit path) stays; run.mjs snapshot guard
  extended to every file the installers can touch; activation in test mode must not install.
