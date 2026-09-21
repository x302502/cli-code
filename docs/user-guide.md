# CLI Code — User Guide (0.2.0)

CLI Code runs AI coding assistants — Claude Code, Codex, Copilot, opencode, Pi and 23 more —
inside VS Code, each in its own terminal tab that knows what the agent is doing and can bring
you back to the same conversation after a restart.

This guide covers everything the extension does. For a short overview see the
[README](../README.md); for what changed in each version see the [CHANGELOG](../CHANGELOG.md).

**Contents**

1. [Requirements and installation](#1-requirements-and-installation)
2. [Supported assistants](#2-supported-assistants)
3. [Opening an assistant](#3-opening-an-assistant)
4. [The terminal tab](#4-the-terminal-tab)
5. [Working in the terminal](#5-working-in-the-terminal)
6. [Links and the mouse](#6-links-and-the-mouse)
7. [Right-click menu](#7-right-click-menu)
8. [Sessions: reload, restart, resume](#8-sessions-reload-restart-resume)
9. [Status hooks](#9-status-hooks)
10. [Quick commands](#10-quick-commands)
11. [Settings](#11-settings)
12. [Commands](#12-commands)
13. [Keyboard shortcuts](#13-keyboard-shortcuts)
14. [What CLI Code touches on your machine](#14-what-cli-code-touches-on-your-machine)
15. [Troubleshooting](#15-troubleshooting)
16. [FAQ](#16-faq)
17. [Uninstalling](#17-uninstalling)

---

## 1. Requirements and installation

- **VS Code 1.94 or newer** (also works in VS Code-based editors that support webview panels).
- **macOS or Linux** for the full feature set. On Windows the terminal works, but status hooks
  and the interactive-shell launch are not available (see [Limits](#windows)).
- The assistants themselves, installed and signed in. CLI Code launches them; it does not
  install them. If a command works in a normal terminal, it works here.

**Install from the Marketplace:** Extensions view (`Cmd/Ctrl + Shift + X`) → search *CLI Code*
→ Install. Or install a `.vsix` for your platform: `code --install-extension cli-code-0.2.0-<platform>.vsix`.

**First run.** The moment the extension activates it looks for supported assistants on your
`PATH` and installs a small *status hook* into each one it finds (details in
[§9](#9-status-hooks)). Nothing else happens until you open an assistant.

> ⚠️ **Assistants launch with approvals disabled.** Every CLI is started with its own bypass
> flag (`claude --dangerously-skip-permissions`, `codex --dangerously-bypass-approvals-and-sandbox`,
> `copilot --yolo`, …) so the agent edits files and runs commands **without asking**. Only use
> CLI Code on repositories you trust.

## 2. Supported assistants

| Assistant | Command CLI Code runs | Status on tab | Restart → same conversation | Model shown |
| --- | --- | :-: | :-: | :-: |
| Claude Code | `claude --dangerously-skip-permissions` | ✓ hook | ✓ (session id from hook) | ✓ |
| Claude Agent Teams | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude …` | ✓ hook | ✓ | ✓ |
| Codex CLI | `codex --dangerously-bypass-approvals-and-sandbox` | ✓ hook | ✓ | ✓ |
| GitHub Copilot CLI | `copilot --yolo` | ✓ hook | ✓ | ✓ |
| Droid (Factory) | `droid` | ✓ hook | ✓ | ✓ |
| Grok | `grok --permission-mode bypassPermissions` | ✓ hook | ✓ | ✓ |
| opencode | `opencode --port <port> --auto` | ✓ plugin | ✓ | ✓ |
| Kilocode | `kilo` | ✓ plugin | ✓ | ✓ |
| MiMo Code | `mimo` | ✓ plugin | ✓ | ✓ |
| Pi | `pi` | ✓ extension | ✓ | ✓ |
| OMP | `omp` | ✓ extension | ✓ | ✓ |
| Command Code | `command-code --yolo` | — | ✓ (session store) | ✓ |
| Prime Agent | `prime-agent` | — | ✓ | ✓ |
| Cline | `cline --auto-approve true` | — | ✓ | ✓ |
| Kimi | `kimi --yolo` | — | ✓ | — |
| Cursor | `cursor-agent --yolo` | — | ✓ | — |
| Amp | `amp --dangerously-allow-all` | — | ✓ | — |
| Antigravity | `agy --dangerously-skip-permissions` | — | ✓ | — |
| Goose | `GOOSE_MODE=auto goose` | — | ✓ | — |
| Aider | `aider --yes-always` | — | `--restore-chat-history` | — |
| Kiro | `kiro-cli --trust-all-tools` | — | `--continue` | — |
| Charm / Crush | `crush --yolo` | — | `--continue` | — |
| Auggie | `auggie` | — | `--continue` | — |
| Continue | `cn --allow "*"` | — | `--resume` (latest) | — |
| Mistral Vibe | `vibe --agent auto-approve` | — | `--continue` | — |
| Qwen Code | `qwen --approval-mode yolo` | — | `--continue` | — |
| Hermes | `hermes --yolo` | — | `--continue` | — |
| Devin | `devin --permission-mode bypass` | — | `--continue` | — |

- **Status on tab**: "hook" / "plugin" / "extension" means CLI Code installs a status hook into
  that CLI ([§9](#9-status-hooks)) and the tab shows exact *working / waiting / done* states.
  "—" means no hook exists yet for that CLI: the tab shows its title but no working/waiting state.
- **Restart → same conversation**: ✓ means Restart Session reopens the exact session
  ([§8.2](#82-restart-session)); `--continue` means the CLI's own "continue the latest session"
  flag is used, which is not scoped to this folder for every CLI.
- **Model shown**: the action bar shows the model the CLI is using, read from the CLI's own
  session files.

The picker lists assistants found on your `PATH` under **Installed** and the rest under **Not installed**.

## 3. Opening an assistant

| Action | How |
| --- | --- |
| Open or focus an assistant | `Cmd + Esc` (macOS) / `Ctrl + Esc` → pick from the list. If that assistant already has a tab, the shortcut jumps to it. |
| Open a second tab of the same assistant | `Cmd/Ctrl + Shift + Esc`, or the **Open CLI in new tab** button in the editor title bar, or **New Session** on the action bar (opens in the current tab's folder). |
| Send the file you are editing | Focus the terminal, press `Cmd + Alt + K` / `Ctrl + Alt + K`. CLI Code types `@src/app.ts`, `@src/app.ts#L10` or `@src/app.ts#L10-20` depending on your selection. |
| Reopen an earlier conversation | Command Palette → **CLI Code: Resume Session** ([§8.3](#83-resume-session)). |

The assistant starts in the first folder of your workspace (or your home folder with no
workspace). It runs inside your **interactive login shell** (`$SHELL -ilc …`), so `PATH`,
`nvm`, `pnpm`, `pyenv` and everything else from `.zshrc` / `.bashrc` are exactly what a
terminal tab would have — MCP servers started through `npx` resolve the same node.

## 4. The terminal tab

### 4.1 Title

The tab shows, in this order of preference:

1. a name you gave it with **Rename Tab** (`F2`);
2. the label of the quick command that opened it;
3. the title the CLI sets itself (Claude Code, Codex, Cline, …), with status glyphs, spinners
   and prompt markers removed — Codex's `<task> | <folder>` form keeps the folder even before a
   task summary exists;
4. the prompt you typed last: first line, URLs removed, at most **40 characters**, cut at a
   word boundary with `…`;
5. the assistant's name.

### 4.2 Status glyphs and notifications

A prefix on the tab title shows the agent's state:

| Prefix | Meaning |
| --- | --- |
| `⟳ ` | working on your prompt |
| `? ` | waiting for you — a permission prompt or a question |
| `● ` | finished (or started waiting) while the tab was not visible; clears when you look at it |
| none | idle |

When an agent finishes or starts waiting **on a tab you are not looking at**, VS Code shows a
notification with an **Open tab** button (`cliCode.notifications`). States need a status hook
([§9](#9-status-hooks)); a CLI without one shows no state.

### 4.3 Action bar

A quiet bar sits above the terminal, same background, icons flush right:

| Icon | Action |
| --- | --- |
| 💬+ | **New Session** — pick a CLI, opens another tab in this tab's folder |
| 🕘 | **Resume Session** — past sessions of this workspace |
| ↻ | **Restart Session** — same conversation, fresh process ([§8.2](#82-restart-session)) |
| 🔍 | **Find** in the terminal |
| … | **Rename Tab** (`F2`), **Copy Context**, **Quick Command** |

On the left the bar shows:

- the **model** the CLI is using (`claude-opus-5`, `gpt-5.6-luna`, …) — read from the CLI's own
  session store 3 s after the tab opens and every 30 s; hidden for CLIs that do not record it;
- `● Waiting for your confirmation` / `● Blocked — needs your attention` while the agent waits;
- `● <file> changed — restart to apply` / `● CLI Code was updated — restart to apply` when the
  running CLI is older than its configuration ([§8.5](#85-stale-tabs)).

### 4.4 When the CLI exits

If the CLI process ends (you typed `/exit`, it crashed, …) the tab shows an overlay
*"Process exited (code N)"* with a **Restart** button. If the tab comes back after a reload but
its session is gone (VS Code was quit, the daemon was killed), it shows *"Session … has ended"*
with **Restart**. Both restart into the same conversation when the CLI supports it.

## 5. Working in the terminal

| What | How |
| --- | --- |
| Newline inside a prompt | `Shift + Enter` (sent as `ESC CR`, the convention Claude Code's `/terminal-setup` teaches) |
| Paste | `Cmd/Ctrl + V` or the right-click **Paste**. Multi-line text arrives as one bracketed paste. Pastes over **100 KB** ask for confirmation first. |
| Copy | select, then `Cmd/Ctrl + C` or right-click **Copy**. A CLI that writes to the clipboard (OSC 52) goes through VS Code's clipboard too (up to 1 MB). |
| Select all | right-click **Select All** |
| Find | `Cmd/Ctrl + F` opens the search bar (match case `Aa`, regular expression `.*`, counter, Enter / Shift+Enter to step). On Windows / Linux the focused terminal consumes `Ctrl + F`; use the palette or the right-click entry. |
| Font zoom | `Cmd/Ctrl + =`, `Cmd/Ctrl + -`, `Cmd/Ctrl + 0` (per tab) |
| Copy Context | copies the last 200 lines of the terminal — handy to paste into another assistant |
| Rename Tab | `F2` while the tab is focused |

The terminal uses your editor font (`editor.fontFamily` / `editor.fontSize`) and follows your
colour theme.

## 6. Links and the mouse

### 6.1 What becomes a link

- URLs (`https://…`) and OSC 8 hyperlinks (Claude Code prints those).
- File paths the CLI prints: `src/x.ts`, `src/x.ts:12:3`, `./dir`, `../lib`, `~/notes.md`,
  `/abs/path`, `file:///…`, plus bare well-known names (`README`, `Makefile`, `Dockerfile`, `LICENSE`, `CHANGELOG`, …) and any `name.ext`.
  A path is underlined **only if it exists** (relative to the CLI's current directory, then the
  workspace), so truncated or hallucinated paths never look clickable. Vietnamese and CJK
  characters in paths are handled.

Hovering a link shows what a click will do and the resolved path.

### 6.2 Clicking

| Gesture | On a URL | On a file | On a folder |
| --- | --- | --- | --- |
| `Cmd/Ctrl + click` | opens in the browser | opens in the editor at the line/column (`.md` in the Markdown preview, `.html` in the browser) | inside the workspace: reveals in the Explorer; outside: opens in Finder / Explorer |
| `Shift + Cmd/Ctrl + click` | browser | opens with the system default app | Finder / Explorer |
| plain click | selects the whole link so `Cmd/Ctrl + C` copies it | same | same |
| drag starting on a link | selects text; never opens the link | | |

### 6.3 Selection while the CLI captures the mouse

Full-screen TUIs (Claude Code's) switch the terminal into mouse-tracking mode, which normally
kills text selection. CLI Code inverts that:

- a **plain drag selects** text, and `Cmd/Ctrl + C` copies it;
- a **bare click still reaches the CLI**, so clicking inside Claude's prompt moves its caret;
- hold **`Option`** (macOS) / **`Shift`** (Windows, Linux) while dragging to send the drag to the
  CLI instead (for TUIs with their own selection or drag gestures).

## 7. Right-click menu

The menu depends on what is under the pointer and whether text is selected:

| Entry | Shown when |
| --- | --- |
| **Copy** | text is selected |
| **Paste**, **Select All** | always |
| **Open Link**, **Copy Link / Path** | pointer on a URL |
| **Open File**, **Open with Default App**, **Insert @path into CLI**, **Copy Link / Path** | pointer on a file path |
| **Open Folder**, **Copy Link / Path** | pointer on a folder path |
| **Find Selection** | text is selected — opens the search bar pre-filled |
| **Find in Terminal** | always |

**Insert @path into CLI** types `@<relative path>` into the prompt without submitting — the
form Claude Code, Codex and most assistants understand for file references.

## 8. Sessions: reload, restart, resume

### 8.1 Reload Window keeps sessions alive

The CLIs run under a small background daemon that belongs to the VS Code window, not to the
webview. After **Developer: Reload Window** every tab re-attaches to its still-running CLI with
scrollback, title and state intact. The daemon exits on its own 60 s after its last tab is
closed.

**Closing a tab ends that CLI** — VS Code gives extensions no way to ask first. **Quitting VS
Code ends every session.**

### 8.2 Restart Session

**Restart Session** (action bar ↻, right-click, palette) kills the tab's CLI and starts it again
**in the same conversation**:

1. If the CLI's status hook reported a session id, the CLI is started with its resume flag
   (`claude --resume <id>`, `codex resume <id>`, `opencode --session <id>`, …).
2. Otherwise CLI Code looks in the CLI's own session store for the newest session that
   belongs to this folder and was created after the tab opened (Command Code, Prime Agent,
   Cline, Kimi, Cursor, Amp, Antigravity, Goose, and the hook CLIs before their first prompt).
3. Otherwise the CLI's `--continue` form is used (Aider, Kiro, Crush, Auggie, Continue, Vibe,
   Qwen, Hermes, Devin).
4. Only when nothing is known does it start fresh.

A tab that was itself opened from **Resume Session** keeps resuming that same session on every
restart. **Restart All Sessions** (palette) does this for every open tab.

### 8.3 Resume Session

Command Palette → **CLI Code: Resume Session** lists past sessions of the current workspace for
Claude Code, Codex and Grok (title, assistant, date) and, for every other assistant, a
**Continue latest session** entry — this folder's newest session when the CLI's store records
one, else the CLI's own `--continue`.

### 8.4 New Session

**New Session** (action bar, palette) opens another tab of the same assistant in the same folder
— or shows the CLI picker when no tab is active.

### 8.5 Stale tabs

CLIs read their MCP servers, plugins and hooks **only when they start**. When you edit that
configuration while a tab is open, the running CLI does not see it — nor does it after a
Reload Window, because the same process is re-attached. CLI Code therefore compares each tab's
start time with the CLI's configuration files (home and project level: `~/.claude/settings.json`,
`~/.claude.json`, `.mcp.json`, `~/.codex/config.toml`, `~/.codex/hooks.json`,
`~/.copilot/mcp-config.json`, `~/.factory/settings.json`, `~/.grok/config.toml`,
`~/.config/opencode/opencode.json` and `plugins/`, `~/.pi/agent/extensions/`, …):

- after a Reload Window, when a tab becomes visible, after the status hooks were (re)installed,
  and after an extension update;
- an **idle** tab (not working, not waiting, quiet for 5 s) **restarts by itself** into the same
  conversation;
- a **busy** tab shows `● <file> changed — restart to apply` on the action bar until you restart.

## 9. Status hooks

### 9.1 What they do

A status hook is a tiny entry in the assistant's own configuration that runs a command when
you submit a prompt, when the agent stops, and when it asks for permission. CLI Code uses it to
show exact tab states, fire the "finished" notification and learn the session id that
**Restart Session** needs. The command is always the same shell line:

```sh
[ -n "$CLI_CODE_HOOK" ] && eval "$CLI_CODE_HOOK" || true
```

`CLI_CODE_HOOK` exists only inside tabs CLI Code opened, so **outside CLI Code the hook is a
no-op**. (Grok gets the equivalent `$(printenv CLI_CODE_HOOK)` form, because Grok validates
`$VAR` references before running a hook.)

### 9.2 Where they are installed

Installed automatically on activation for every assistant found on `PATH`
(`cliCode.statusHooks`, default on). Files you already had are backed up once as
`<file>.cli-code.bak`; your own hooks are kept, only CLI Code's entries are added or removed.

| Assistant | File | What is added |
| --- | --- | --- |
| Claude Code | `~/.claude/settings.json` | `hooks.UserPromptSubmit / Stop / Notification / PermissionRequest` entries |
| Droid | `~/.factory/settings.json` | `hooks.UserPromptSubmit / Stop / Notification` |
| Codex | `~/.codex/hooks.json` and `~/.codex/config.toml` | hook entries appended after yours, plus the `[hooks.state."…"]` trust entries Codex requires |
| GitHub Copilot | `~/.copilot/hooks/cli-code.json` | a file of its own |
| Grok | `~/.grok/hooks/cli-code.json` | a file of its own |
| opencode / Kilocode / MiMo | `~/.config/opencode/plugins/cli-code-status.ts`, `~/.config/kilo/plugins/…`, `~/.config/mimocode/plugins/…` | a generated plugin, first line `// @cli-code-managed` |
| Pi / OMP | `~/.pi/agent/extensions/cli-code-status.ts`, `~/.omp/agent/extensions/cli-code-status.ts` | a generated extension, same header |

Generated files are never overwritten if the `@cli-code-managed` header is missing (a file of
yours with the same name stays untouched).

### 9.3 When they take effect

From the **next start** of that assistant. A tab that was already running shows no state until
it restarts — CLI Code notices and restarts idle tabs itself ([§8.5](#85-stale-tabs)).

### 9.4 Turning them off

Set `cliCode.statusHooks` to `false`: every entry and generated file is removed. The palette
commands **Install Status Hooks** / **Remove Status Hooks** do the same by hand and show a
summary (*Installed: Codex, Grok · Removed: …*).

### 9.5 Limits

- POSIX only: Windows has no `sh` to evaluate the line, so nothing is installed there.
- The line is evaluated by the shell: a VS Code installation path containing `"` or `$` breaks it.
- Grok and Cursor also read `~/.claude/settings.json`, so they may report the same event twice;
  both reports carry the same state and are harmless.

## 10. Quick commands

Reusable prompts or shell commands, run into the active tab:

```jsonc
// settings.json (User = available everywhere, Workspace = this project only)
"cliCode.quickCommands": [
  { "label": "Run tests", "text": "npm test" },
  { "label": "Summarize PR", "text": "Summarize the changes in this PR", "submit": true },
  { "label": "Draft only", "text": "Explain this file", "submit": false }
]
```

- **Quick Command** (action bar `…`, palette): pick one; the text is pasted as one block and,
  with `submit` (default `true`), followed by Enter. Entries show a globe (User) or folder
  (Workspace) icon.
- **Save as Quick Command**: select text in the terminal, run the command, give it a name,
  choose User or Workspace settings.
- A tab opened by a quick command is titled after it until you rename it.

## 11. Settings

| Setting | Type | Default | Meaning |
| --- | --- | --- | --- |
| `cliCode.statusHooks` | boolean | `true` | Keep status hooks installed in every supported CLI on `PATH`; `false` removes them all. |
| `cliCode.notifications` | boolean | `true` | Notify when an agent finishes or starts waiting on a tab you are not looking at. |
| `cliCode.quickCommands` | array | `[]` | `{ label, text, submit? }` entries; User settings = global, Workspace settings = project. |
| `cliCode.composer` | boolean | `false` | Experimental chat-style input under the terminal (`Enter` sends as one block, `Shift+Enter` newline). Off so the CLI's own `/` and `@` menus keep working. Applies to tabs opened after the change. |

The terminal also honours `editor.fontFamily`, `editor.fontSize` and your colour theme.

## 12. Commands

All under the `CLI Code:` category in the Command Palette unless noted.

| Command | Id | Notes |
| --- | --- | --- |
| Open CLI | `cli-code.open` | picker; focuses an existing tab of that CLI |
| Open CLI in new tab | `cli-code.openNew` | always a new tab |
| CLI: Insert At-Mentioned | `cli-code.addFilepath` | types `@file#Lx-y` for the editor selection |
| New Session | `cli-code.newSession` | another tab of the active tab's CLI, same folder |
| Resume Session | `cli-code.resume` | past sessions of the workspace |
| Restart Session | `cli-code.restart` | same conversation |
| Restart All Sessions | `cli-code.restartAllSessions` | every open tab |
| Rename Tab | `cli-code.renameTab` | `F2` |
| Find in Terminal | `cli-code.find` | |
| Copy Context | `cli-code.copyContext` | last 200 lines |
| Copy / Paste / Select All | `cli-code.copySelection` / `cli-code.paste` / `cli-code.selectAll` | |
| Zoom In / Zoom Out / Reset Zoom | `cli-code.fontZoomIn` / `fontZoomOut` / `fontZoomReset` | |
| Quick Command / Save as Quick Command | `cli-code.quickCommand` / `cli-code.addQuickCommand` | |
| Install Status Hooks / Remove Status Hooks | `cli-code.installStatusHooks` / `cli-code.removeStatusHooks` | all supported CLIs |
| Open Link, Open File, Open Folder, Open with Default App, Copy Link / Path, Insert @path into CLI, Find Selection | `cli-code.*At`, `cli-code.findSelection` | right-click only (they need the clicked position) |

## 13. Keyboard shortcuts

| Action | macOS | Windows / Linux | Where |
| --- | --- | --- | --- |
| Open / focus an assistant | `Cmd + Esc` | `Ctrl + Esc` | anywhere |
| Open an assistant in a new tab | `Cmd + Shift + Esc` | `Ctrl + Shift + Esc` | anywhere |
| Insert the current file as `@path` | `Cmd + Alt + K` | `Ctrl + Alt + K` | anywhere |
| Newline in the prompt | `Shift + Enter` | `Shift + Enter` | terminal |
| Find | `Cmd + F` | `Ctrl + F` \* | terminal |
| Zoom in / out / reset | `Cmd + =` / `Cmd + -` / `Cmd + 0` | `Ctrl + =` / `Ctrl + -` / `Ctrl + 0` | terminal |
| Rename tab | `F2` | `F2` | terminal |
| Copy / Paste | `Cmd + C` / `Cmd + V` | right-click **Copy** / `Ctrl + V` | terminal |

\* On Windows / Linux the focused terminal sends `Ctrl + F` to the CLI; use the palette or the
right-click entry. The terminal-scoped bindings apply only while a CLI Code tab is active, so
they do not conflict with VS Code's defaults elsewhere.

## 14. What CLI Code touches on your machine

**Writes**

- Status hook entries and generated plugin files listed in [§9.2](#92-where-they-are-installed),
  with a one-time `<file>.cli-code.bak` backup next to each file it edits.
- Its own daemon socket and build stamp in the temp directory
  (`cli-code-<id>.sock`, `cli-code-<id>.sock.build`).
- VS Code's own storage: which daemon belongs to this window, the last extension version,
  and per-tab state used to restore tabs after a reload.
- Quick commands you save, in your User or Workspace `settings.json`.

**Reads (never modifies)**

- The assistants' session stores, to find session ids, titles and models:
  `~/.claude/projects`, `~/.codex/sessions`, `~/.grok/sessions`, `~/.copilot/session-state` and
  `session-store.db`, `~/.factory/sessions`, `~/.pi/agent/sessions`, `~/.omp/agent/sessions`,
  `~/.commandcode/projects`, `~/.prime/agent/sessions`, `~/.cline/data/sessions`,
  `~/.kimi/sessions`, `~/.cursor/projects`, `~/.local/share/amp/threads`,
  `~/.local/share/{opencode,mimocode,kilo}/*.db`, `~/.local/share/goose/sessions/sessions.db`,
  `~/.gemini/antigravity-cli/cache/last_conversations.json`.
- The configuration files listed in [§8.5](#85-stale-tabs), to detect stale tabs (modification
  times only).

**Network:** none of its own. The assistants talk to their providers as they always do.

## 15. Troubleshooting

**Codex `/mcp` shows servers as failed, but they work in a terminal.**
Fixed in 0.2.0: CLIs now run in your interactive login shell. If you still see it, reload the
window — a daemon started by an older build is replaced on activation, and stale tabs are
restarted automatically once idle.

**The tab shows no working/waiting state.**
The CLI needs a status hook and must have been started after the hook was installed. Run
**CLI Code: Install Status Hooks** (the summary tells you what was installed or what failed),
then **Restart Session**. On Windows there are no hooks.

**"Session … has ended" after a reload.**
The daemon was gone (VS Code was quit, or the process was killed). Press **Restart** — the tab
comes back in the same conversation when the CLI supports it.

**Restart opened a fresh conversation.**
The CLI is one of the `--continue`-only assistants ([§2](#2-supported-assistants)), or no
prompt was submitted yet, so no session existed to return to.

**A hook warning appears inside the CLI.**
Codex: run `/hooks` inside Codex and approve the CLI Code hook if the trust entry could not
be written. Grok: make sure `~/.grok/hooks/cli-code.json` is the 0.2.0 version (Remove, then
Install Status Hooks).

**`Ctrl + F` types into the CLI (Windows / Linux).**
Expected — the terminal owns that key. Use the palette or the right-click entry.

**The prompt gets submitted when I paste multi-line text.**
Text is sent as one bracketed paste; the CLI decides what to do with it. Assistants that do
not enable bracketed paste see the newlines as Enter.

**Links are not underlined.**
Only paths that exist (from the CLI's current directory or the workspace) are linked, and only
once the CLI has told the terminal its directory. Bare names must be well-known file names.

<a id="windows"></a>**Windows.** The terminal, links, menu and sessions work; status hooks and
the interactive-shell launch do not (the CLI starts through PowerShell), so tabs show no
working/waiting state.

## 16. FAQ

**Does it replace the assistants' own terminals?** It runs them, in a nicer tab. Everything you
can do in the CLI you can still do here.

**Is anything sent anywhere?** No. CLI Code has no server and makes no network calls.

**Can I keep using VS Code's integrated terminal?** Yes; CLI Code only manages the tabs it opens.

**Why does closing a tab kill the agent without asking?** VS Code does not let an extension veto
closing a tab. Use Restart Session to pick the conversation up again.

**Why are approvals disabled?** So the agent can work uninterrupted. Launch the CLI from a plain
terminal if you want its prompts back.

## 17. Uninstalling

1. Command Palette → **CLI Code: Remove Status Hooks** (removes every entry and generated file;
   the `.cli-code.bak` backups stay).
2. Close the CLI tabs (or quit VS Code).
3. Uninstall the extension from the Extensions view.
