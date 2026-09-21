# CLI Code — User Guide

*Version 0.2.0 · Tiếng Việt: [user-guide.vi.md](user-guide.vi.md) · What changed: [CHANGELOG.md](../CHANGELOG.md)*

CLI Code brings command-line coding assistants — Claude Code, Codex, Copilot, opencode, Pi, Grok,
Droid and 21 more — straight into VS Code. Each assistant gets a terminal tab of the extension's
own: the tab renames itself after the task you gave, shows whether the agent is working or waiting
on you, turns every file and link the agent prints into something you can open, survives Reload
Window, and when you restart it, lands back in the conversation you were in.

This guide follows the order you will use things: install → first assistant → daily work →
sessions → customisation. The appendices at the end are lookup tables.

---

## Part A — Getting started

### 1. Install and prepare

**Step 1 — Install the extension.** Open Extensions (`Cmd/Ctrl + Shift + X`), search **CLI Code**,
click Install. (Or install the `.vsix` for your platform: `code --install-extension cli-code-0.2.0-darwin-arm64.vsix`.)
VS Code 1.94 or newer. macOS and Linux get every feature; for Windows see [Limits on Windows](#limits-on-windows).

**Step 2 — Install and sign in to the assistants you want.** CLI Code does not install them, it
launches them. Follow each tool's own instructions, then run it **once in a normal terminal** to
finish its login (`claude`, `codex`, `copilot`, `opencode`…). Simple rule: if a command works in a
terminal, it works in CLI Code. Full list in [Appendix A](#appendix-a--the-28-assistants-and-what-each-gets).

**Step 3 — Nothing to configure.** The moment the extension activates it looks for assistants on
your `PATH` and installs a small *status hook* into each one's configuration (this is what lets a
tab know what the agent is doing — explained in [section 16](#16-status-hooks-what-lets-a-tab-know-what-the-agent-is-doing)).
Your files are backed up before they are touched.

> ⚠️ **Assistants run with approvals off.** CLI Code launches every CLI with its own bypass flag
> (`claude --dangerously-skip-permissions`, `codex --dangerously-bypass-approvals-and-sandbox`,
> `copilot --yolo`…). The agent edits files and runs commands without asking. Use it on
> repositories you trust; if you want the approval prompts back, start the CLI from a plain terminal.

### 2. Open your first assistant

1. Open a project folder in VS Code.
2. Press **`Cmd + Esc`** (macOS) or **`Ctrl + Esc`** (Windows/Linux).
3. The picker appears: assistants found on your machine under **Installed**, the others under
   **Not installed**. Pick one.

   ![The assistant picker](../images/screenshots/picker-highlighted.png)

4. A tab opens beside the editor with the assistant's coloured icon, and the CLI starts right in
   your project folder.

Alternatives: the CLI Code icon in the editor title bar, or Command Palette → **Open CLI**.

![The CLI Code icon in the editor title bar](../images/screenshots/toolbar-highlighted.png)

💡 Pressing `Cmd + Esc` again when that assistant already has a tab **jumps to it** instead of
opening another. For a second tab of the same assistant use `Cmd/Ctrl + Shift + Esc` or the
**Open CLI in new tab** button in the title bar.

The CLI runs inside your **interactive login shell** (`$SHELL -ilc`), so `PATH`, `nvm`, `pnpm`,
`pyenv` and the aliases from `.zshrc`/`.bashrc` are exactly what a terminal tab has. MCP servers
that Codex or Claude start through `npx` therefore use your node too.

### 3. Send your first prompt

Type into the CLI's own input as usual — CLI Code never gets between you and the assistant.

- **Newline inside the prompt:** `Shift + Enter`. (CLI Code sends `ESC CR`, the convention Claude
  Code's `/terminal-setup` teaches, so nothing needs to be set up.)
- **Paste several lines:** `Cmd/Ctrl + V`. The text reaches the CLI as **one block** (bracketed
  paste), so Claude/Codex do not mistake each line for an Enter. Pastes over 100 KB ask first.
- **Hand the file you are editing to the assistant:**
  1. Click into the file; select a few lines if you want.
  2. Click the assistant's tab to focus it.
  3. Press **`Cmd + Alt + K`** / **`Ctrl + Alt + K`**.

  CLI Code types a reference the assistant understands:

  | You had | It types |
  | --- | --- |
  | the file open | `@src/app.ts` |
  | one line selected | `@src/app.ts#L10` |
  | several lines selected | `@src/app.ts#L10-20` |

  Now just ask: "explain this function", "write tests for the selection"…

### 4. Reading the tab: name, state, notifications

As soon as you submit a prompt, **the tab renames itself after the task**. Type
`Refactor the authentication flow so that tokens refresh silently` and the tab reads
`Refactor the authentication flow so that…` (40 characters, cut at a word boundary, URLs
dropped). Assistants that set their own title (Claude Code, Codex, Cline…) get that title, with
spinners and status marks stripped; a name you give with `F2` beats everything.

**A prefix on the tab name** tells you what the agent is doing (for the 10 assistants with a status
hook, see Appendix A):

| You see | It means |
| --- | --- |
| `⟳ Fix the login bug` | the agent is working |
| `? Fix the login bug` | the agent is **waiting for you**: a permission prompt or a question |
| `● Fix the login bug` | it finished (or started waiting) while you were on another tab; clears when you come back |
| `Fix the login bug` | idle |

When an agent finishes or starts waiting **on a tab you are not looking at**, VS Code shows a
notification — *"Claude Code finished: Fix the login bug"* — with an **Open tab** button. Turn it
off with `cliCode.notifications`.

---

## Part B — Daily work

### 5. Several assistants, several tabs

One tab per assistant, as many as you like, including several tabs of the same assistant (one
Claude for feature A, another for review). Useful habits:

- **Another tab of the same assistant, same folder:** the 💬+ **New Session** button on the
  action bar of an open tab (shows the picker, opens in that tab's folder), or `Cmd/Ctrl + Shift + Esc`.
- **Rename a tab:** `F2` while it is focused, or … → **Rename Tab**. Your name survives reloads
  and restarts.
- **Drag tabs** into another column, split them, group them — they are ordinary VS Code tabs.
- **Closing a tab ends the CLI inside it**, without a warning (VS Code gives extensions no way to
  veto a close). To get that conversation back: [Resume Session](#12-reopen-an-earlier-conversation).
- **Quitting VS Code ends every session.** Reload Window does not — see [section 10](#10-reload-window-without-losing-anything).

### 6. The action bar above the terminal

A thin bar, same background as the terminal, icons flush right:

| Button | Does |
| --- | --- |
| 💬+ **New Session** | pick a CLI, open another tab in this tab's folder |
| 🕘 **Resume Session** | past sessions of the workspace ([section 12](#12-reopen-an-earlier-conversation)) |
| ↻ **Restart Session** | run the CLI again **in the same conversation** ([section 11](#11-restart-and-stay-in-the-same-conversation)) |
| 🔍 **Find** | search the terminal |
| … | **Rename Tab** (`F2`) · **Copy Context** (last 200 lines) · **Quick Command** ([section 15](#15-quick-commands)) |

On the left the bar shows:

- **The model in use**, e.g. `claude-opus-5` or `gpt-5.6-luna`. CLI Code reads it from the CLI's
  own session file (3 s after the tab opens, then every 30 s), so switching with `/model` shows
  up. Hidden for assistants that do not record a model.
- A status line, `● Waiting for your confirmation`, while the agent waits on you.
- A reminder, `● <file> changed — restart to apply`, when the running CLI is older than its
  configuration ([section 13](#13-when-you-change-mcp--plugins--hooks-the-tab-restarts-itself)).

### 7. Open the files and links the assistant prints

Agents answer things like *"I changed `src/auth/login.ts:42:7` and updated `docs/guide.md`"*. In
CLI Code those paths are **real links**:

- **Hover** one: a tooltip says what a click will do and shows the full path.
- **`Cmd/Ctrl + click`** a file: opens in the editor **at that line and column**. `.md` files open
  in the Markdown preview, `.html` files in the browser.
- **`Cmd/Ctrl + click`** a folder: inside the workspace it is **revealed in the Explorer**; outside
  it opens in **Finder / File Explorer**.
- **`Shift + Cmd/Ctrl + click`**: opens the file with the operating system's **default app**
  (images, PDFs…).
- **URLs** (`https://…`) and the hyperlinks Claude Code prints (OSC 8): `Cmd/Ctrl + click` opens
  the browser.
- **Plain click** on a link **selects the whole link**, so `Cmd/Ctrl + C` copies the path or URL —
  no more dragging over it character by character.

Only paths that **really exist** are underlined (checked from the CLI's current directory, then
the workspace), so a truncated or hallucinated path never looks clickable. Recognised:
`src/x.ts`, `./dir`, `../lib`, `~/notes.md`, `/abs/path`, `file:///…`, well-known bare names
(`README`, `Makefile`, `Dockerfile`, `LICENSE`…) and any `name.ext`; Vietnamese and CJK file names
included.

### 8. Select, copy, find, zoom

**Select and copy.** Drag to select, `Cmd/Ctrl + C` to copy — even while the assistant is in a
full-screen mode that captures the mouse (Claude Code): a plain drag still selects, and a **bare
click still reaches the CLI**, so clicking inside Claude's prompt places its caret. Need to hand a
drag to the CLI (TUIs with their own selection)? Hold **`Option`** (macOS) / **`Shift`** (Windows,
Linux) while dragging.

**Select all:** right-click → **Select All**. **Copy the context** to paste into another assistant:
… → **Copy Context** (last 200 lines).

**Find:** `Cmd/Ctrl + F` (or 🔍) opens the search bar with `Aa` (match case), `.*` (regular
expression) and a counter; `Enter` next, `Shift + Enter` previous, `Esc` closes. With text selected,
right-click → **Find Selection** searches for exactly that.

**Zoom the text per tab:** `Cmd/Ctrl + =`, `Cmd/Ctrl + -`, `Cmd/Ctrl + 0`. Font and colours follow
`editor.fontFamily`, `editor.fontSize` and your colour theme.

A CLI that writes to the clipboard itself (OSC 52) goes through VS Code's clipboard too, so
"copy" inside Claude Code works as usual.

### 9. The context-aware right-click menu

The menu changes with what you point at:

| Pointing at / having | Entries |
| --- | --- |
| anything | **Paste**, **Select All**, **Find in Terminal** |
| a selection | plus **Copy**, **Find Selection** |
| a URL | plus **Open Link**, **Copy Link / Path** |
| a file path | plus **Open File**, **Open with Default App**, **Insert @path into CLI**, **Copy Link / Path** |
| a folder path | plus **Open Folder**, **Copy Link / Path** |

**Insert @path into CLI** types `@<relative path>` into the prompt (without sending) — the quickest
way to tell the assistant "look at this file" when the file was just mentioned in the terminal.

---

## Part C — Managing sessions

### 10. Reload Window without losing anything

The CLIs do not run inside the webview; they run under a **background daemon** that belongs to the
VS Code window. So **Developer: Reload Window** (after installing an extension, changing a setting,
or when VS Code reloads itself) loses nothing: every tab comes back attached to its still-running
CLI, with scrollback, tab name and state intact.

The daemon exits by itself 60 s after the last tab is closed. Quitting VS Code ends every session;
when you open VS Code again the tabs show *"Session … has ended"* with a **Restart** button that
takes you back to the conversation ([section 14](#14-when-the-cli-exits-or-the-session-is-gone)).

### 11. Restart and stay in the same conversation

You will want to relaunch a CLI now and then: you added an MCP server, installed a plugin, the CLI
updated itself, or it simply hung. Press ↻ **Restart Session** (action bar, right-click or palette).
CLI Code kills the old process and starts it again **in the same conversation**, trying in order:

1. The assistant's status hook reported a session id → start with its resume flag
   (`claude --resume <id>`, `codex resume <id>`, `opencode --session <id>`…).
2. No id from a hook yet → look in the **CLI's own session store** for the newest session that
   belongs to this folder and was created after the tab opened (Command Code, Prime Agent, Cline,
   Kimi, Cursor, Amp, Antigravity, Goose…).
3. No readable store → the CLI's `--continue` flag (Aider, Kiro, Crush, Auggie, Continue, Vibe,
   Qwen, Hermes, Devin).
4. Nothing known → a fresh session.

Nineteen assistants come back to the **exact** session; nine use `--continue` (Appendix A). A tab
opened from Resume Session keeps resuming that session on every restart. To restart everything at
once (after changing shared configuration, say): Command Palette → **CLI Code: Restart All Sessions**.

### 12. Reopen an earlier conversation

Command Palette → **CLI Code: Resume Session** (or 🕘 on the action bar):

- For **Claude Code, Codex and Grok**: a list of the workspace's past sessions — title, assistant,
  time. Pick one and a new tab opens in that session.
- For **every other assistant**: a **Continue latest session** entry — this folder's newest session
  when the CLI's store records one (Copilot, Droid, Pi, OMP, opencode, Cline…), else the CLI's
  `--continue`.

### 13. When you change MCP / plugins / hooks, the tab restarts itself

CLIs read their MCP servers, plugins and hooks **only at start-up**. Add an MCP server to
`~/.codex/config.toml` while a Codex tab is open and the running Codex does not see it — nor after
a reload, because the tab re-attaches to the same process. CLI Code handles this for you:

- It remembers when each tab's CLI started and compares that with the modification time of that
  CLI's configuration files, at home and project level (`~/.claude/settings.json`, `~/.claude.json`,
  `.mcp.json`, `~/.codex/config.toml`, `~/.codex/hooks.json`, `~/.copilot/mcp-config.json`,
  `~/.factory/settings.json`, `~/.grok/config.toml`, `~/.config/opencode/opencode.json` and
  `plugins/`, `~/.pi/agent/extensions/`…).
- It checks after a Reload Window, when a tab becomes visible, after the hooks are installed, and
  after an extension update.
- An **idle** tab (not working, not waiting, quiet for 5 s) **restarts itself** into the same
  conversation. A **busy** tab shows `● config.toml changed — restart to apply` on the action bar
  until you press ↻.

Example: open Codex, run `/mcp`, notice a server is missing → add it to `config.toml`, save → go
back to the Codex tab: if it was idle it has already restarted, and `/mcp` lists the new server.

### 14. When the CLI exits or the session is gone

- **The CLI exited** (`/exit`, a crash…): the tab shows *"Process exited (code N)"* with **Restart**.
- **The session is gone** after VS Code was reopened or the daemon was killed: the tab shows
  *"Session … has ended"* with **Restart**.

Both restart by the rules in [section 11](#11-restart-and-stay-in-the-same-conversation), so with
nineteen assistants you land back in the conversation.

---

## Part D — Customising

### 15. Quick commands

Prompts or commands you type again and again ("run the tests", "summarise this PR") can become
**Quick Commands**:

**Way 1 — in settings.json** (User = everywhere, Workspace = this project only):

```jsonc
"cliCode.quickCommands": [
  { "label": "Run tests", "text": "npm test" },
  { "label": "Summarize PR", "text": "Summarize the changes in this PR" },
  { "label": "Explain file (draft)", "text": "Explain this file", "submit": false }
]
```

**Way 2 — from a selection:** select text in the terminal → Command Palette → **CLI Code: Save as
Quick Command** → name it → choose User or Workspace.

**Run one:** … → **Quick Command** (or the palette) → pick. The text is pasted as one block and
followed by Enter (`submit` defaults to `true`; set `false` to only pre-fill the prompt for
editing). Globe icon = User, folder icon = Workspace. A tab opened by a quick command carries its
name until you rename it.

### 16. Status hooks: what lets a tab know what the agent is doing

A plain terminal cannot tell whether the agent inside it is working or waiting. CLI Code solves
this with **status hooks**: a small entry in the assistant's own configuration that runs when you
submit a prompt, when the agent stops and when it asks for permission. That is what gives the tab
its `⟳ ? ●` marks and the "finished" notification, and what tells **Restart Session** the exact
session id to return to.

Every hook runs the same single line:

```sh
[ -n "$CLI_CODE_HOOK" ] && eval "$CLI_CODE_HOOK" || true
```

`CLI_CODE_HOOK` exists only inside tabs CLI Code opened, so when you run the assistant outside CLI
Code the hook **does nothing at all**.

**Installed automatically, with backups.** On activation the extension installs the hook for every
assistant on your `PATH` (setting `cliCode.statusHooks`, on by default). An existing file is backed
up once as `<file>.cli-code.bak`; your own hooks stay, only CLI Code's entries are added or removed.

| Assistant | Installed into |
| --- | --- |
| Claude Code | `~/.claude/settings.json` (`hooks`) |
| Droid | `~/.factory/settings.json` (`hooks`) |
| Codex | `~/.codex/hooks.json` plus the `[hooks.state."…"]` trust entries in `~/.codex/config.toml` (Codex only runs trusted hooks) |
| GitHub Copilot | `~/.copilot/hooks/cli-code.json` (its own file) |
| Grok | `~/.grok/hooks/cli-code.json` (its own file) |
| opencode / Kilocode / MiMo | `~/.config/opencode|kilo|mimocode/plugins/cli-code-status.ts` (a generated plugin, first line `// @cli-code-managed`) |
| Pi / OMP | `~/.pi/agent/extensions/cli-code-status.ts`, `~/.omp/agent/extensions/cli-code-status.ts` (a generated extension) |

**Takes effect from the assistant's next start** — a tab that was already running is restarted by
CLI Code once it is idle ([section 13](#13-when-you-change-mcp--plugins--hooks-the-tab-restarts-itself)).

**Check / reinstall / remove:** Command Palette → **CLI Code: Install Status Hooks** shows a summary
(*Installed: Codex, Grok · Failed: …*); **Remove Status Hooks** removes everything. Setting
`cliCode.statusHooks` to `false` removes them too and stops reinstalling.

There is no hook yet for Cursor, Cline, Command Code, Antigravity, Amp and the remaining assistants:
their tabs still get names, links and restart, just no state marks.

### 17. Settings and shortcuts

| Setting | Default | Meaning |
| --- | --- | --- |
| `cliCode.statusHooks` | `true` | Keep status hooks installed in every assistant on `PATH`; `false` removes them. |
| `cliCode.notifications` | `true` | Notify when an agent finishes / starts waiting on a tab you are not looking at. |
| `cliCode.quickCommands` | `[]` | Quick commands `{ label, text, submit? }`. |
| `cliCode.composer` | `false` | Experimental chat-style input under the terminal: `Enter` sends as one block, `Shift+Enter` newline. Off so the CLI's `/` and `@` menus keep working. Applies to tabs opened after the change. |

| Action | macOS | Windows / Linux |
| --- | --- | --- |
| Open / focus an assistant | `Cmd + Esc` | `Ctrl + Esc` |
| Open an assistant in a new tab | `Cmd + Shift + Esc` | `Ctrl + Shift + Esc` |
| Insert the current file (`@path`) | `Cmd + Alt + K` | `Ctrl + Alt + K` |
| Newline in the prompt | `Shift + Enter` | `Shift + Enter` |
| Find in terminal | `Cmd + F` | `Ctrl + F` \* |
| Zoom in / out / reset | `Cmd + =` / `-` / `0` | `Ctrl + =` / `-` / `0` |
| Rename tab | `F2` | `F2` |

Terminal-scoped shortcuts apply only while a CLI Code tab is active, so they do not clash with VS
Code's defaults elsewhere. \* On Windows/Linux the terminal keeps `Ctrl + F` for the CLI — use the
palette or the right-click entry.

---

## Appendices

### Appendix A — The 28 assistants and what each gets

| Assistant | Command CLI Code runs | State on tab | Restart → same conversation | Model shown |
| --- | --- | :-: | :-: | :-: |
| Claude Code | `claude --dangerously-skip-permissions` | ✓ | ✓ | ✓ |
| Claude Agent Teams | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude …` | ✓ | ✓ | ✓ |
| Codex CLI | `codex --dangerously-bypass-approvals-and-sandbox` | ✓ | ✓ | ✓ |
| GitHub Copilot CLI | `copilot --yolo` | ✓ | ✓ | ✓ |
| Droid (Factory) | `droid` | ✓ | ✓ | ✓ |
| Grok | `grok --permission-mode bypassPermissions` | ✓ | ✓ | ✓ |
| opencode | `opencode --port <port> --auto` | ✓ | ✓ | ✓ |
| Kilocode | `kilo` | ✓ | ✓ | ✓ |
| MiMo Code | `mimo` | ✓ | ✓ | ✓ |
| Pi | `pi` | ✓ | ✓ | ✓ |
| OMP | `omp` | ✓ | ✓ | ✓ |
| Command Code | `command-code --yolo` | — | ✓ | ✓ |
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

*State on tab* = has a status hook. *Restart → same conversation* ✓ = reopens the exact session;
`--continue` = the CLI's own "continue the latest session" flag (not scoped to the folder for every
CLI). *Model shown* = the action bar can read the model from the CLI's session files.

### Appendix B — Commands (Command Palette, category `CLI Code:`)

| Command | Id | Notes |
| --- | --- | --- |
| Open CLI | `cli-code.open` | picker; focuses an existing tab |
| Open CLI in new tab | `cli-code.openNew` | always a new tab |
| CLI: Insert At-Mentioned | `cli-code.addFilepath` | `@file#Lx-y` for the editor selection |
| New Session | `cli-code.newSession` | another tab of the same CLI, same folder |
| Resume Session | `cli-code.resume` | |
| Restart Session | `cli-code.restart` | |
| Restart All Sessions | `cli-code.restartAllSessions` | |
| Rename Tab | `cli-code.renameTab` | `F2` |
| Find in Terminal | `cli-code.find` | |
| Copy Context | `cli-code.copyContext` | last 200 lines |
| Copy / Paste / Select All | `cli-code.copySelection` / `cli-code.paste` / `cli-code.selectAll` | |
| Zoom In / Zoom Out / Reset Zoom | `cli-code.fontZoomIn` / `fontZoomOut` / `fontZoomReset` | |
| Quick Command / Save as Quick Command | `cli-code.quickCommand` / `cli-code.addQuickCommand` | |
| Install Status Hooks / Remove Status Hooks | `cli-code.installStatusHooks` / `cli-code.removeStatusHooks` | |
| Open Link, Open File, Open Folder, Open with Default App, Copy Link / Path, Insert @path into CLI, Find Selection | `cli-code.*At`, `cli-code.findSelection` | right-click menu only |

### Appendix C — What CLI Code touches on your machine

**Writes:** the hook entries / plugin files in [section 16](#16-status-hooks-what-lets-a-tab-know-what-the-agent-is-doing)
(with `<file>.cli-code.bak` backups); the daemon's socket and build stamp in the temp directory
(`cli-code-<id>.sock`, `.sock.build`); VS Code's own storage (the window's daemon, the last
extension version, per-tab state for restoring); quick commands you save into `settings.json`.

**Reads (never modifies):** the assistants' session stores, to find session ids, titles and
models — `~/.claude/projects`, `~/.codex/sessions`, `~/.grok/sessions`, `~/.copilot/session-state`
and `session-store.db`, `~/.factory/sessions`, `~/.pi/agent/sessions`, `~/.omp/agent/sessions`,
`~/.commandcode/projects`, `~/.prime/agent/sessions`, `~/.cline/data/sessions`, `~/.kimi/sessions`,
`~/.cursor/projects`, `~/.local/share/amp/threads`, `~/.local/share/{opencode,mimocode,kilo}/*.db`,
`~/.local/share/goose/sessions/sessions.db`, `~/.gemini/antigravity-cli/cache/last_conversations.json`;
and the modification times of the configuration files in [section 13](#13-when-you-change-mcp--plugins--hooks-the-tab-restarts-itself).

**Network:** none of its own. The assistants talk to their providers as they always do.

### Appendix D — Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Codex `/mcp` shows servers as *failed*, but they work in a terminal | Older builds ran CLIs in a non-interactive shell with an incomplete `PATH`. Fixed in 0.2.0; Reload Window so the new daemon replaces the old one — idle tabs restart themselves. |
| No `⟳ ?` marks on the tab | The assistant has no hook, or the CLI started before the hook was installed. Run **Install Status Hooks**, then **Restart Session**. No hooks on Windows. |
| *"Session … has ended"* after opening VS Code | The session ended with VS Code. Press **Restart** to get the conversation back. |
| Restart opened a fresh conversation | The assistant is in the `--continue` group, or no prompt had been sent yet, so there was no session to return to. |
| A hook warning inside the CLI | Codex: run `/hooks` in Codex and approve the CLI Code hook. Grok: run Remove, then Install Status Hooks to refresh the file. |
| `Ctrl + F` types into the CLI (Windows/Linux) | The terminal keeps that key. Use the palette or the right-click entry. |
| A multi-line paste gets submitted | That CLI does not enable bracketed paste, so newlines count as Enter. |
| A path is not underlined | Only existing paths become links, and the CLI must have reported its current directory to the terminal. |

<a id="limits-on-windows"></a>**Limits on Windows:** terminal, links, menu and sessions all work;
status hooks and the interactive shell do not (the CLI starts through PowerShell), so tabs show no
state marks.

### Appendix E — FAQ and uninstalling

- **Does it send data anywhere?** No. CLI Code has no server and makes no network calls.
- **Can I keep using VS Code's integrated terminal?** Yes; CLI Code only manages the tabs it opens.
- **Why are approval prompts off?** So the agent can work uninterrupted; start the CLI from a plain
  terminal to get them back.
- **Clean uninstall:** Command Palette → **CLI Code: Remove Status Hooks** (the `.cli-code.bak`
  backups stay) → close the CLI tabs → uninstall the extension from the Extensions view.
