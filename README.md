# CLI Code

**English** · [Tiếng Việt](README.vi.md) · [中文](README.zh.md) · [日本語](README.ja.md)

📖 Full manual: [User Guide](docs/user-guide.md) · [Hướng dẫn sử dụng](docs/user-guide.vi.md) · [Changelog](CHANGELOG.md)

> Run Claude Code, Codex, Copilot, opencode, Pi and 23 other coding assistants in VS Code — each in a terminal tab that knows what the agent is doing, opens every file it mentions, survives a reload, and restarts into the same conversation.

![Multiple AI CLIs running side by side in VS Code](images/screenshots/terminals.png)

## What it does

- **One shortcut to any assistant.** `Cmd/Ctrl + Esc` → pick from 28 CLIs → it opens beside your editor, in your project folder, in your real shell (`PATH`, nvm, MCP servers — all as in a terminal).
- **Send the file you're looking at** with `Cmd/Ctrl + Alt + K`: the assistant gets `@src/app.ts#L10-20`, no copy-paste.
- **Tabs that tell you what's going on.** The tab renames itself after the task you gave, shows `⟳` working / `?` waiting for you / `●` done while you were away, and you get a notification when an agent on a hidden tab needs you.
- **Every path and link the agent prints is clickable.** `Cmd/Ctrl + click` opens the file at the exact line, folders in the Explorer, URLs in the browser; a plain click selects the link so `Cmd/Ctrl + C` copies it. Selection and copy work even while Claude Code captures the mouse.
- **Nothing lost on Reload Window.** Sessions run under a background daemon and re-attach with scrollback, title and state.
- **Restart into the same conversation.** Changed an MCP server or a plugin? Restart the tab and 19 assistants come back exactly where you were — idle tabs even restart themselves when their config changes.
- **Resume past sessions, quick commands, copy context, find, zoom**, and a model pill showing what the assistant is running on.

Status, restart-by-session and the model pill come from a small status hook CLI Code installs into each assistant's own config (Claude Code, Codex, Copilot, Droid, Grok, opencode, Kilo, MiMo, Pi, OMP) — backed up, removable, and a no-op outside CLI Code. Details in the [User Guide](docs/user-guide.md).

## Getting started

### 1. Install

Open the **Extensions** view in VS Code (`Cmd/Ctrl + Shift + X`), search for **CLI Code**, and click **Install**.

![CLI Code in the VS Code Marketplace](images/screenshots/marketplace.png)

### 2. Install the assistants you want

CLI Code _launches_ the assistants — it doesn't install them. Make sure the ones you want are installed and runnable from your terminal. Out of the box it knows about:

| Assistant                                                                                        | Terminal command    |
| ------------------------------------------------------------------------------------------------ | ------------------- |
| [Claude Code](https://code.claude.com/docs/en/setup)                                             | `claude`            |
| [Claude Agent Teams](https://code.claude.com/docs/en/agent-teams)                                | `claude`              |
| [Codex CLI](https://developers.openai.com/codex/cli)                                             | `codex`             |
| [Grok](https://x.ai/cli)                                                                         | `grok`              |
| [GitHub Copilot CLI](https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli)       | `copilot`           |
| [opencode](https://opencode.ai)                                                                  | `opencode`          |
| [MiMo Code](https://github.com/XiaomiMiMo/MiMo-Code)                                             | `mimo`              |
| [Pi](https://pi.dev)                                                                             | `pi`                |
| [OMP](https://omp.sh)                                                                            | `omp`               |
| [Antigravity](https://antigravity.google)                                                        | `agy`               |
| [Amp](https://ampcode.com)                                                                       | `amp`               |
| [Kilocode](https://kilo.ai)                                                                      | `kilo`              |
| [Cline](https://cline.bot)                                                                       | `cline`             |
| [Command Code](https://github.com/just-every/code)                                               | `command-code`      |
| [Droid](https://docs.factory.ai/cli/getting-started/quickstart)                                  | `droid`             |
| [Prime Agent](https://github.com/PrimeIntellect-ai/prime-agent)                                  | `prime-agent`       |
| [Aider](https://aider.chat/docs/)                                                                | `aider`             |
| [Goose](https://block.github.io/goose/docs/quickstart/)                                          | `goose`             |
| [Kiro](https://kiro.dev)                                                                         | `kiro-cli`          |
| [Charm / Crush](https://github.com/charmbracelet/crush)                                          | `crush`             |
| [Auggie](https://docs.augmentcode.com/cli/overview)                                              | `auggie`            |
| [Continue](https://docs.continue.dev/guides/cli)                                                 | `cn`                |
| [Cursor](https://cursor.com/cli)                                                                 | `cursor-agent`      |
| [Kimi](https://www.kimi.com/code/docs/en/kimi-code-cli/getting-started.html)                     | `kimi`              |
| [Mistral Vibe](https://github.com/mistralai/mistral-vibe)                                        | `vibe`              |
| [Qwen Code](https://github.com/QwenLM/qwen-code)                                                 | `qwen`              |
| [Hermes](https://hermes-agent.nousresearch.com/docs/)                                            | `hermes`            |
| [Devin](https://devin.ai/cli)                                                                    | `devin`             |

> ⚠️ **Install _and_ sign in first.** Most assistants need to be authenticated
> before they'll run — `claude` (log in to your Anthropic account), `codex`
> (OpenAI login / API key), and so on. Run each tool
> once in a normal terminal, complete its login flow, and confirm it starts.
>
> 💡 Tip: if a command works when you type it in a normal terminal, it'll work here.

### 🚨 Assistants launch with approval prompts disabled

Each CLI is started with its own bypass flag (`claude --dangerously-skip-permissions`,
`codex --dangerously-bypass-approvals-and-sandbox`, and so on), so the agent runs
commands and edits files **without asking you first**. That's fast, but it means a
repository you don't trust can steer the agent into destructive or data-leaking
actions. Only use CLI Code on code you trust, or launch the assistants yourself from
a plain terminal instead.

## How to use it

### Open an assistant

Press **`Cmd + Esc`** (macOS) or **`Ctrl + Esc`** (Windows / Linux).

A menu pops up listing every assistant. Pick one — it opens in a terminal to the side and starts running. If that assistant is already open, the shortcut just jumps back to it.

![The CLI picker listing all assistants](images/screenshots/picker-highlighted.png)

> Want a fresh session instead of reusing the open one? Use **`Cmd/Ctrl + Shift + Esc`**.

You can also open it from the editor toolbar — look for the CLI Code icon (circled):

![CLI Code icon on the editor toolbar](images/screenshots/toolbar-highlighted.png)

### Send the file you're working on

1. Click into a file (optionally **select a few lines**).
2. Click the assistant's terminal to focus it.
3. Press **`Cmd + Alt + K`** (macOS) or **`Ctrl + Alt + K`** (Windows / Linux).

CLI Code drops a reference to your file into the prompt:

| You did this           | It inserts           |
| ---------------------- | -------------------- |
| Just opened a file     | `@src/app.ts`        |
| Selected one line      | `@src/app.ts#L10`    |
| Selected several lines | `@src/app.ts#L10-20` |

Now just type your question — the assistant already knows which file (and lines) you mean.

## The CLI Code terminal

Assistants don't run in VS Code's integrated terminal but in the **extension's own terminal** — a webview panel connected to a background PTY daemon. That is what makes the rest possible:

- A **coloured icon** on the terminal tab for each assistant.
- **Automatic tab titles** that update from the prompt you just typed (no manual renaming needed) — Orca's budget: URLs dropped, at most 40 characters, cut at a word boundary with `…`.
- **Agent status** shown right on the tab title — working, waiting on you, or done.
- Sessions that **survive Reload Window**: after a reload, the terminal reconnects to the running CLI session automatically, with nothing lost.

### Limits

- **Closing a tab ends that CLI.** VS Code doesn't let an extension "ask before closing" a tab, so closing one stops the CLI process inside it immediately — no warning.
- **Quitting VS Code ends all sessions.** Every CLI running under CLI Code stops with it.
- **Status hooks only work on POSIX** (macOS, Linux) — Windows can't install them.

### Status hooks

CLI Code keeps a small hook installed in each supported CLI so the tab shows accurate status (working / waiting / done) instead of guessing from the title, the "finished" toast fires for hidden tabs, and **Restart Session** knows the exact conversation to return to. Like Orca, this happens **automatically**: on activation, every supported CLI found on `PATH` gets the hook if it is missing; turn `cliCode.statusHooks` off and they are all removed again.

| CLI | Where the hook lives |
| --- | --- |
| Claude Code | `~/.claude/settings.json` → `hooks` (UserPromptSubmit, Stop, Notification, PermissionRequest) |
| Droid | `~/.factory/settings.json` → `hooks` |
| Codex | `~/.codex/hooks.json` → `hooks`, plus the matching `[hooks.state.…]` trust entries in `~/.codex/config.toml` (Codex only runs trusted hooks) |
| GitHub Copilot | `~/.copilot/hooks/cli-code.json` (a file of its own) |
| Grok | `~/.grok/hooks/cli-code.json` (a file of its own) |
| opencode / Kilo / MiMo | `~/.config/opencode|kilo|mimocode/plugins/cli-code-status.ts` (a generated plugin) |
| Pi / OMP | `~/.pi/agent/extensions/cli-code-status.ts`, `~/.omp/agent/extensions/cli-code-status.ts` (a generated extension) |

- Before the first write to a file you already had, it is backed up next to itself as `<file>.cli-code.bak`; hooks you configured yourself are kept, only CLI Code's own entries are added or removed. Generated files start with `// @cli-code-managed` and are never overwritten if that header is missing.
- Every entry runs the same shell line, which is a no-op when the CLI runs outside CLI Code (the `CLI_CODE_HOOK` variable doesn't exist):

  ```sh
  [ -n "$CLI_CODE_HOOK" ] && eval "$CLI_CODE_HOOK" || true
  ```

  The generated plugins build the same JSON payload the shell hooks receive and pipe it into that line.
- A hook takes effect from the next start of that CLI. CLI Code notices when a tab's CLI is older than its config (MCP servers, plugins, hooks — the files listed above plus each CLI's MCP config, checked after a Reload Window, when a tab becomes visible, and after an extension update): an idle tab restarts into the same conversation by itself; a busy one shows *"… changed — restart to apply"* in the action bar until you restart it. **"CLI Code: Restart All Sessions"** restarts every tab at once.
- **"CLI Code: Install Status Hooks"** / **"Remove Status Hooks"** in the Command Palette do the same by hand and show a summary.
- POSIX only (macOS, Linux): Windows has no `sh` to evaluate the hook line, so nothing is installed there.
- Known limit: the hook command is evaluated by the shell, so a VS Code install path containing `"` or `$` breaks it.

### Settings

| Setting                     | Type                       | Default | Description                                                                                 |
| ---------------------------- | --------------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| `cliCode.statusHooks`        | `boolean`                   | `true`  | Keep status hooks installed in every supported CLI (see "Status hooks"); off removes them.     |
| `cliCode.notifications`      | `boolean`                   | `true`  | Notify when an agent finishes work on a hidden tab.                                           |
| `cliCode.quickCommands`      | array of objects            | `[]`    | Reusable commands or prompts. Set in User settings = Global, Workspace settings = Project.     |

Example `cliCode.quickCommands`:

```json
"cliCode.quickCommands": [
  { "label": "Run tests", "text": "npm test" },
  { "label": "Summarize PR", "text": "Summarize the changes in this PR", "submit": true }
]
```

### Path links

Paths the CLI prints (`src/x.ts:12:3`, `./dir`, `~/notes.md`, `README`, `file://…`) become links once they exist on disk — a truncated or missing path is never underlined. `Cmd/Ctrl + click` opens a file in the editor (Markdown in the preview, HTML in the browser) and a **folder** in VS Code's Explorer (inside the workspace) or in Finder / Explorer (outside it); `Shift + Cmd/Ctrl + click` opens a file with its default app. A plain click selects the whole link (URL or path) so a normal `Cmd/Ctrl + C` copies it. Dragging always selects text, even while the CLI captures the mouse (Claude Code's TUI does) — a bare click still reaches the CLI, so its caret follows the mouse; hold `Option` (macOS) / `Shift` (elsewhere) while dragging to send the drag to the CLI instead.

### Restart and resume

**Restart Session** brings the tab back into the *same conversation*: CLIs with a status hook (Claude Code, Codex, Copilot, Droid, Grok, opencode, Kilo, MiMo, Pi, OMP) via the session id the hook reports; Command Code, Prime Agent, Cline, Kimi, Cursor, Amp, Antigravity and goose via the newest session their own store shows for this directory since the tab was opened; the remaining CLIs via their `--continue` form. Only when nothing is known does it start fresh. **Resume Session** lists past sessions (Claude Code, Codex, Grok) and offers *Continue latest session* for every other CLI — this folder's newest session when the CLI's store has one. **Restart All Sessions** restarts every tab (see "Status hooks" for the automatic restart of stale tabs).

### Action bar and right-click menu

A quiet bar sits at the top of every terminal (same background, icons flush right): **New Session** (pick a CLI, opens in this tab's directory), **Resume Session**, **Restart Session**, **Find**, and under **…**: **Rename Tab** (`F2`), **Copy Context**, **Quick Command**. Its left side shows the **model** the CLI is using — read from the CLI's own session store (Claude Code, Codex, Grok, Copilot, Pi, OMP, Command Code, Prime Agent, Droid, Cline, opencode, MiMo, Kilo; hidden for CLIs that do not record it) — plus a status line while the agent waits on you and a *"… changed — restart to apply"* notice when the tab is stale. Hovering a link shows what `Cmd/Ctrl + click` will open and the resolved path.

Right-click acts on what is under the pointer or selected: **Copy** · **Paste** · **Select All** · on a URL **Open Link** / on a file **Open File**, **Open with Default App**, **Insert @path into CLI** / on a folder **Open Folder** · **Copy Link / Path** · **Find Selection** · **Find in Terminal**.

An experimental chat-style **composer** under the terminal (type or paste, `Enter` sends as one block, `Shift + Enter` breaks a line) can be enabled with `cliCode.composer: true`; it is off by default so the CLI's own input keeps its `/` and `@` menus.

### Command Palette commands

`CLI Code:` **New Session**, **Resume Session**, **Restart Session**, **Restart All Sessions**, **Quick Command**, **Save as Quick Command**, **Rename Tab**, **Find in Terminal**, **Copy Context**, **Copy**, **Paste**, **Select All**, **Zoom In**, **Zoom Out**, **Reset Zoom**, **Install Status Hooks**, **Remove Status Hooks** — plus **Open CLI**, **Open CLI in new tab** and **CLI: Insert At-Mentioned** from earlier releases.

## Keyboard shortcuts

| Action                               | macOS                | Windows / Linux        |
| -------------------------------------- | --------------------- | ------------------------ |
| Open / focus an assistant              | `Cmd + Esc`           | `Ctrl + Esc`             |
| Open an assistant in a new terminal    | `Cmd + Shift + Esc`   | `Ctrl + Shift + Esc`     |
| Send the current file to it            | `Cmd + Alt + K`       | `Ctrl + Alt + K`         |
| Newline in the prompt                  | `Shift + Enter`       | `Shift + Enter`         |
| Find in terminal                       | `Cmd + F`             | `Ctrl + F` \*           |
| Font zoom in                           | `Cmd + =`             | `Ctrl + =`               |
| Font zoom out                          | `Cmd + -`             | `Ctrl + -`               |
| Reset font zoom                        | `Cmd + 0`             | `Ctrl + 0`               |

\* On Windows / Linux the focused terminal consumes `Ctrl + F` (xterm sends it to the CLI as `^F`). Use the Command Palette command **"CLI Code: Find in Terminal"** or the right-click entry **Find in Terminal** instead.

## FAQ

**The assistant opens but asks me to log in.**
That's expected — CLI Code only launches the tool, it doesn't handle authentication. Complete the assistant's own login flow once (in any terminal); it will remember you afterwards.

**Nothing happens when I press `Cmd + Alt + K`.**
Make sure (1) a file is open in the editor, and (2) the assistant's terminal is focused. The file reference goes into whichever CLI terminal is active.

**The shortcut conflicts with something else.**
Rebind it in VS Code: **Preferences → Keyboard Shortcuts**, search for "CLI", and set your own keys.

## Development

- `bun test` — unit tests.
- `bun run test:integration` — launches a real VS Code (downloaded once into `.vscode-test/`) and runs the suites in `test/integration/suite/` inside the extension host: open/type/close, gone/restart, hook → status glyph, resume/quick commands, and a two-stage reload that re-attaches a session across a restart. macOS/Linux only; opens a test window; tests never write your real `~/.claude/settings.json` or any other hook file — the runner snapshots them and fails the run if one changes. VS Code's own invocation of the webview serializer on a real Reload Window can't be exercised this way (extension-test mode uses in-memory storage, so it never fires between the two launches) and stays a manual check.

## License

[MIT](LICENSE) © 2026 Thanh Luan
