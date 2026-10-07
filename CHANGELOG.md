# Changelog

## [0.2.6](https://github.com/x302502/cli-code/compare/v0.2.5...v0.2.6) (2026-10-07)


### Features

* add CLI update notices and update-and-restart actions ([#16](https://github.com/x302502/cli-code/issues/16)) ([9ec812d](https://github.com/x302502/cli-code/commit/9ec812d857e972dbc1f11a32f9d1c49ec166fa7d))

## [0.2.5](https://github.com/x302502/cli-code/compare/v0.2.4...v0.2.5) (2026-10-06)


### Features

* show the whole prompt above the CLI's input, pastes and images spelled out ([6b504fa](https://github.com/x302502/cli-code/commit/6b504fa8839d58307d29b3be34a24255ad3dbbcd))


### Bug fixes

* open new tabs again after an update that left the daemon bundle unchanged ([d71a3de](https://github.com/x302502/cli-code/commit/d71a3dec606e52054c21457cedaffe6f0ee3ad2b))


### Documentation

* **readme:** the Full prompt box shows pastes and images above the agent's input ([0f7693f](https://github.com/x302502/cli-code/commit/0f7693f5195a31fd8c2ad74f4b469be22abb9d2d))

## [0.2.4](https://github.com/x302502/cli-code/compare/v0.2.3...v0.2.4) (2026-10-04)


### Features

* keep CLI sessions across quitting VS Code and restore them like Orca ([bbd65c2](https://github.com/x302502/cli-code/commit/bbd65c2144c781098276892421701f43f4331996))
* rename a CLI tab by double-clicking its name, or from the tab's right-click menu ([819fa7c](https://github.com/x302502/cli-code/commit/819fa7cb5f43d88a656de59e608c40b395299cfd))


### Bug fixes

* a file link focuses the tab already showing the file instead of opening another ([f80fbdd](https://github.com/x302502/cli-code/commit/f80fbdd9f47e8924478a139d6c85ea3532cd1fc4))


### Documentation

* **readme:** sessions survive quitting VS Code, open files are reused, tabs rename by double-click ([f7281da](https://github.com/x302502/cli-code/commit/f7281da4c2be891c6aaf5755d8343869b6501b22))

## [0.2.3](https://github.com/x302502/cli-code/compare/v0.2.2...v0.2.3) (2026-10-02)


### Documentation

* show how to open CLI Code from the status bar button ([#9](https://github.com/x302502/cli-code/issues/9)) ([875e113](https://github.com/x302502/cli-code/commit/875e113fb39b4f26348b00ae62caaa2331fd21d5))
* show how to open CLI Code from the title bar and the status bar after installing ([#11](https://github.com/x302502/cli-code/issues/11)) ([2d7da30](https://github.com/x302502/cli-code/commit/2d7da30a2ce3fa6a58d004c2b75ad75b45a802aa))

## [0.2.2](https://github.com/x302502/cli-code/compare/v0.2.1...v0.2.2) (2026-10-02)


### Bug fixes

* **package:** stop shipping CI-only files in the vsix ([#7](https://github.com/x302502/cli-code/issues/7)) ([234af0f](https://github.com/x302502/cli-code/commit/234af0fbb976991d780c07870f66b3f143f34b77))

## [0.2.1](https://github.com/x302502/cli-code/compare/v0.2.0...v0.2.1) (2026-10-02)


### Features

* a CLI Code button in the status bar, with the bee as an icon-font glyph ([59cfe06](https://github.com/x302502/cli-code/commit/59cfe061ced6a7bc30492db779158965bcb1c3f5))
* the new worker-bee icon for the Marketplace and the editor title buttons ([0d52f62](https://github.com/x302502/cli-code/commit/0d52f625088192cd370bb858bbb4373466d810d7))


### Bug fixes

* the status bar font gets a content-hash file name; the title-bar buttons use the colour icon ([f5b3793](https://github.com/x302502/cli-code/commit/f5b379393f006151e7788ad0065c2fe6bb0eb7aa))
* **verify-vsix:** allow the two user guides under docs/, reject anything else there ([763a517](https://github.com/x302502/cli-code/commit/763a517bfd1c5cba7783fbe7c651b9884d4a6197))


### Documentation

* mention the status bar button in the changelog and the user guides ([2159665](https://github.com/x302502/cli-code/commit/215966523ecead40c03716e56978bce706eec841))
* show the new icon in the toolbar, picker and hero screenshots ([31636a4](https://github.com/x302502/cli-code/commit/31636a4353b0adfc497eaccd2d94b32a3f05b250))

## 0.2.0

The big one: every assistant now runs in CLI Code's own terminal, with the things a plain
VS Code terminal cannot give you — sessions that survive a reload, tabs that know what the
agent is doing, links that open, and a restart that lands back in the same conversation.

**Requires VS Code 1.101 or newer** (was 1.94): the session stores of opencode, MiMo, Kilo,
Goose and Copilot are SQLite, read through Node's built-in `node:sqlite` — unflagged from
Node 22.13, which VS Code ships from 1.101 on.

### Built-in terminal

- **Own terminal** (xterm.js webview + a detached PTY daemon) instead of VS Code's integrated
  terminal. CLIs run in your **interactive login shell** (`$SHELL -ilc`), so PATH, nvm/pnpm
  and MCP servers resolve exactly as in a normal terminal tab.
- **Sessions survive Reload Window**: the tab re-attaches to the still-running CLI with its
  scrollback, title and state. The daemon is per window and exits by itself once its last tab
  is gone.
- Coloured **agent icon** and **automatic tab title** on every tab: the title follows the
  prompt you typed (40 characters, cut at a word boundary with `…`, URLs dropped) or the CLI's
  own title with status glyphs, prompt markers and empty `… | folder` segments stripped.
- **Agent status on the tab** (working · waiting on you · done), an unread dot for tabs you
  are not looking at, and a **notification** when an agent finishes on a hidden tab.
- **Action bar** above the terminal (Claude-style outline icons, flush right): New Session
  (CLI picker, same folder), Resume Session, Restart Session, Find, and under `…` Rename Tab
  (`F2`), Copy Context, Quick Command. Its left side shows the **model** the CLI is using
  (read from the CLI's own session store), a status line while the agent waits on you, and a
  *"… changed — restart to apply"* notice when the tab is stale (see below).
- **Exit overlay** with a Restart button when the CLI exits; a "session gone" page with
  Restart when the daemon is no longer there after a reload.
- `Shift + Enter` inserts a newline, `Cmd/Ctrl + F` search bar (match case, regex),
  `Cmd/Ctrl + = / - / 0` font zoom, OSC 52 clipboard writes through the extension host, a
  size guard before large pastes, bracketed paste for multi-line input.

### Links and mouse

- **Paths and URLs become links** — `src/x.ts:12:3`, `./dir`, `~/notes.md`, bare `README`,
  `file://…`, OSC 8 hyperlinks (Claude Code's). Paths are existence-checked before they are
  underlined and mapped cell-accurately, so Vietnamese (NFD) and CJK paths work.
- `Cmd/Ctrl + click` opens a file at line/column (Markdown in the preview, HTML in the
  browser), a folder inside the workspace in the Explorer, one outside it in Finder/Explorer;
  `Shift + Cmd/Ctrl + click` opens with the default app. Hover shows what a click will open.
- A **plain click selects the whole link** so `Cmd/Ctrl + C` copies it; a drag that starts
  on a link selects text instead of opening it.
- **Selection works while the CLI captures the mouse** (Claude Code's TUI does): a plain drag
  selects; a bare click is still passed to the CLI so its caret follows the mouse; hold
  `Option` (macOS) / `Shift` (elsewhere) to send a drag to the CLI.
- **Content-aware right-click menu**: Copy · Paste · Select All · Open Link / Open File ·
  Open with Default App · Insert @path into CLI · Open Folder · Copy Link / Path · Find
  Selection · Find in Terminal.

### Sessions across CLIs

- **Status hooks for 10 CLIs** — Claude Code, Codex, Copilot, Droid, Grok, opencode, Kilo,
  MiMo, Pi, OMP — installed automatically into each CLI's own config when the CLI is on PATH
  (`cliCode.statusHooks`, backups as `<file>.cli-code.bak`, removed when the setting is off).
  Codex gets the matching trust entries in `config.toml`; opencode/Kilo/MiMo and Pi/OMP get a
  generated plugin file. Every hook is a no-op when the CLI runs outside CLI Code.
- **Restart Session returns to the same conversation** for 19 CLIs: by the session id the hook
  reports, or the newest session the CLI's store shows for this folder since the tab opened
  (Claude Code, Codex, Copilot, Droid, Grok, opencode, Kilo, MiMo, Pi, OMP, Command Code,
  Prime Agent, Cline, Kimi, Cursor, Amp, Antigravity, goose, Claude Agent Teams); by
  `--continue` for the rest.
- **Resume Session** lists past sessions (Claude Code, Codex, Grok) and offers "Continue latest
  session" for every other CLI — this folder's newest session from the CLI's own store when it
  has one.
- **Stale tabs restart themselves**: after a Reload Window, when a tab becomes visible, after
  the hooks are (re)installed and after an extension update, CLI Code compares each tab's
  start time with its CLI's config (MCP servers, plugins, hooks). An idle tab restarts into the
  same conversation; a busy one shows the notice until you restart. **Restart All Sessions**
  does it for every tab.
- **Quick commands** from user and workspace settings (`cliCode.quickCommands`), "Save as
  Quick Command" from a selection, **Copy Context** (the tail of the terminal), New Session
  from the bar or the palette.
- Experimental **composer** under the terminal (`cliCode.composer`, off by default).

### Changed

- All user-facing text is **English** (command titles, menus, settings, toasts).
- `cliCode.claudeStatusHooks` (`ask | on | off`) is replaced by `cliCode.statusHooks`
  (boolean, default `true`) covering all supported CLIs; the commands are now **Install
  Status Hooks** / **Remove Status Hooks**.
- **Closing a tab ends that CLI**; quitting VS Code ends every session.
- Tab labels: 40 characters (was 20).
- opencode: prompts are typed into the terminal; the HTTP prompt injection is gone.

### Removed

- OpenClaude, Ante, Trae, Autohand, Codebuff, Rovo Dev and OpenClaw — no verifiable session
  store or resume form yet; back when they can be supported properly.

### Known limits

- Status hooks and the interactive-shell launch are POSIX only (macOS, Linux); on Windows
  nothing is installed and tabs fall back to title-based status.
- No exact-session restart for aider (no session concept), kiro, crush, aug, continue,
  mistral-vibe, qwen-code, hermes, devin — they use `--continue`.
- `Ctrl + F` on Windows/Linux goes to the CLI; use the palette or the right-click entry.
- The hook line is evaluated by the shell, so a VS Code install path containing `"` or `$`
  breaks it.

### Under the hood

- Per-platform VSIX (darwin/win32/linux × x64/arm64) built in CI; `bun run package:target`.
- 240 unit tests, an integration tier in a real Extension Host (`bun run test:integration`,
  never touches your real config files), and an end-to-end harness against the installed CLIs
  (`test/e2e/status-hooks.mjs`).

## 0.1.7
- Tab labels capped at 20 characters, cut at word boundaries.
