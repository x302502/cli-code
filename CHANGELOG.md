# Changelog

## 0.2.0

The big one: every assistant now runs in CLI Code's own terminal, with the things a plain
VS Code terminal cannot give you — sessions that survive a reload, tabs that know what the
agent is doing, links that open, and a restart that lands back in the same conversation.

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
