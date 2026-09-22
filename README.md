# CLI Code

**English** · [Tiếng Việt](README.vi.md) · [中文](README.zh.md) · [日本語](README.ja.md)

📖 [User Guide](docs/user-guide.md) · [Hướng dẫn sử dụng](docs/user-guide.vi.md) · [Changelog](CHANGELOG.md)

> **The agent terminal for VS Code.** Claude Code, Codex, Copilot, opencode, Pi, Grok, Droid and 21 more coding agents, each in a tab that understands the agent: it shows what the agent is doing, opens what it mentions, keeps the session through reloads, and restarts back into the same conversation.

![Multiple AI CLIs running side by side in VS Code](images/screenshots/terminals.png)

## Why

Every serious coding agent ships as a terminal program. Running it in a plain terminal tab means the tab is blind: it can't tell you the agent is waiting for approval, it doesn't know which file the agent just edited, a reload kills it, and a restart forgets the conversation.

CLI Code replaces that tab with an interface built for agents — its own webview terminal with an action bar, live state, clickable output and notices — while the agent itself runs untouched: same CLI, same shell, same MCP servers and plugins.

## What you get

**Tabs that know the agent's state.** The tab renames itself after the task you gave and carries a mark: `⟳` working, `?` waiting for you, `●` finished while you were on another tab. An agent that needs you on a hidden tab sends a notification with an *Open tab* button. The action bar above the terminal shows the model in use.

**An interface around the agent, not a bare terminal.** Above the terminal sits a quiet action bar in Claude's visual language: New Session (with the agent picker), Resume, Restart, Find, and a `…` menu (Rename, Copy Context, Quick Command). Its left side shows the model in use, a status line while the agent waits on you, and a *"… changed — restart to apply"* notice when the running agent is older than its configuration. Hovering a link shows what it opens; find has match-case and regex; an overlay with a Restart button appears when the agent exits, a *session ended* page when its process is gone. Fonts and colours follow your VS Code theme; an optional chat-style composer can sit under the terminal.

**Everything the agent prints is clickable.** File paths open in the editor at the exact line and column, folders reveal in the Explorer (or Finder/Explorer when outside the workspace), URLs open in the browser, Markdown opens in the preview. Only paths that really exist are underlined. A plain click selects the whole link so `Cmd/Ctrl + C` copies it; selection and copy keep working even while Claude Code is capturing the mouse.

**Sessions that survive.** Agents run under a background daemon, so *Reload Window* re-attaches every tab with its scrollback, title and state. When you do need a fresh process — a new MCP server, a plugin, an update — *Restart Session* brings 19 of the 28 agents back into the exact conversation, and tabs whose configuration changed restart themselves when idle.

**One shortcut, your real shell.** `Cmd/Ctrl + Esc` opens any of 28 agents beside your editor, in your project folder, inside your interactive login shell — `PATH`, nvm, pnpm, MCP servers, all exactly as in a terminal. `Cmd/Ctrl + Alt + K` drops the file you are looking at into the prompt as `@src/app.ts#L10-20`.

**And the small things.** Resume past sessions, quick commands (from settings or saved from a selection), copy the last 200 lines as context, in-terminal find, per-tab zoom, `Shift + Enter` for newlines, a context-aware right-click menu, coloured agent icons.

How it knows: CLI Code installs a small *status hook* into each agent's own configuration (Claude Code, Codex, Copilot, Droid, Grok, opencode, Kilo, MiMo, Pi, OMP). It runs one shell line that does nothing outside CLI Code, your files are backed up first, and one setting removes everything. Details in the [User Guide](docs/user-guide.md#16-status-hooks-what-lets-a-tab-know-what-the-agent-is-doing).

## Quick start

1. **Install** from the Marketplace (`Cmd/Ctrl + Shift + X` → *CLI Code*). VS Code 1.94+, macOS or Linux for the full feature set.
2. **Install and sign in** to the agents you use, in a normal terminal (`claude`, `codex`, `copilot`, `opencode`…). CLI Code launches them; it doesn't install them. If a command works in your terminal, it works here.
3. **Press `Cmd/Ctrl + Esc`**, pick an agent, start typing. Press `Cmd/Ctrl + Alt + K` in the editor to hand it the current file.

> ⚠️ Agents are launched with their approval prompts **disabled** (`claude --dangerously-skip-permissions`, `codex --dangerously-bypass-approvals-and-sandbox`, `copilot --yolo`, …) so they can work without interruption. They will edit files and run commands without asking — use CLI Code on repositories you trust, or start the agent from a plain terminal when you want its prompts back.

## Supported agents

| Agent | Command | State on tab | Restart → same conversation | Model shown |
| --- | --- | :-: | :-: | :-: |
| [Claude Code](https://code.claude.com/docs/en/setup) | `claude` | ✓ | ✓ | ✓ |
| [Claude Agent Teams](https://code.claude.com/docs/en/agent-teams) | `claude` | ✓ | ✓ | ✓ |
| [Codex CLI](https://developers.openai.com/codex/cli) | `codex` | ✓ | ✓ | ✓ |
| [GitHub Copilot CLI](https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli) | `copilot` | ✓ | ✓ | ✓ |
| [Droid](https://docs.factory.ai/cli/getting-started/quickstart) | `droid` | ✓ | ✓ | ✓ |
| [Grok](https://x.ai/cli) | `grok` | ✓ | ✓ | ✓ |
| [opencode](https://opencode.ai) | `opencode` | ✓ | ✓ | ✓ |
| [Kilocode](https://kilo.ai) | `kilo` | ✓ | ✓ | ✓ |
| [MiMo Code](https://github.com/XiaomiMiMo/MiMo-Code) | `mimo` | ✓ | ✓ | ✓ |
| [Pi](https://pi.dev) | `pi` | ✓ | ✓ | ✓ |
| [OMP](https://omp.sh) | `omp` | ✓ | ✓ | ✓ |
| [Command Code](https://github.com/just-every/code) | `command-code` | — | ✓ | ✓ |
| [Prime Agent](https://github.com/PrimeIntellect-ai/prime-agent) | `prime-agent` | — | ✓ | ✓ |
| [Cline](https://cline.bot) | `cline` | — | ✓ | ✓ |
| [Kimi](https://www.kimi.com/code/docs/en/kimi-code-cli/getting-started.html) | `kimi` | — | ✓ | — |
| [Cursor](https://cursor.com/cli) | `cursor-agent` | — | ✓ | — |
| [Amp](https://ampcode.com) | `amp` | — | ✓ | — |
| [Antigravity](https://antigravity.google) | `agy` | — | ✓ | — |
| [Goose](https://block.github.io/goose/docs/quickstart/) | `goose` | — | ✓ | — |
| [Aider](https://aider.chat/docs/) | `aider` | — | `--continue` | — |
| [Kiro](https://kiro.dev) | `kiro-cli` | — | `--continue` | — |
| [Charm / Crush](https://github.com/charmbracelet/crush) | `crush` | — | `--continue` | — |
| [Auggie](https://docs.augmentcode.com/cli/overview) | `auggie` | — | `--continue` | — |
| [Continue](https://docs.continue.dev/guides/cli) | `cn` | — | `--continue` | — |
| [Mistral Vibe](https://github.com/mistralai/mistral-vibe) | `vibe` | — | `--continue` | — |
| [Qwen Code](https://github.com/QwenLM/qwen-code) | `qwen` | — | `--continue` | — |
| [Hermes](https://hermes-agent.nousresearch.com/docs/) | `hermes` | — | `--continue` | — |
| [Devin](https://devin.ai/cli) | `devin` | — | `--continue` | — |

*State on tab* needs a status hook, which exists for the first 11. *Restart → same conversation* ✓ reopens the exact session; `--continue` uses the agent's own "latest session" flag. *Model shown*: the action bar can read the model from the agent's session files. The picker shows agents found on `PATH` first.

## In daily use

**Open and hand over files.** `Cmd/Ctrl + Esc` opens or focuses an agent; `Cmd/Ctrl + Shift + Esc` opens another tab of it; the *New Session* button opens one in the current tab's folder. `Cmd/Ctrl + Alt + K` inserts `@path`, `@path#L10` or `@path#L10-20` for the editor's file and selection.

**Read the tab.** Title = your name (`F2`) › the quick command that opened it › the agent's own title, cleaned › your last prompt (40 chars, cut at a word) › the agent's name. Marks: `⟳` working · `?` waiting for you · `●` done while hidden.

**Click what the agent prints.** `Cmd/Ctrl + click` opens files (at `line:col`), folders and URLs; `Shift + Cmd/Ctrl + click` opens with the default app; hover shows the target. Right-click offers *Open File / Open Folder / Open Link*, *Open with Default App*, *Insert @path into CLI*, *Copy Link / Path*, *Find Selection*, plus *Copy / Paste / Select All / Find in Terminal*.

**Keep the conversation.** *Reload Window* keeps everything. *Restart Session* (↻) relaunches into the same conversation — by the session id the hook reported, else the newest session in the agent's own store for this folder, else the agent's `--continue`. *Resume Session* lists past sessions (Claude Code, Codex, Grok) and offers *Continue latest session* for the rest. When an MCP/plugin/hook file changes, idle tabs restart themselves; busy ones show *"… changed — restart to apply"* until you press ↻. *Restart All Sessions* does every tab.

**Quick commands.** Store prompts in `cliCode.quickCommands` (User or Workspace settings) or select text and run *Save as Quick Command*; run them from the action bar's `…` menu. They arrive as one paste, followed by Enter unless `"submit": false`.

## Shortcuts, commands, settings

| Action | macOS | Windows / Linux |
| --- | --- | --- |
| Open / focus an agent | `Cmd + Esc` | `Ctrl + Esc` |
| Open an agent in a new tab | `Cmd + Shift + Esc` | `Ctrl + Shift + Esc` |
| Insert the current file as `@path` | `Cmd + Alt + K` | `Ctrl + Alt + K` |
| Newline in the prompt | `Shift + Enter` | `Shift + Enter` |
| Find in terminal | `Cmd + F` | `Ctrl + F` \* |
| Zoom in / out / reset | `Cmd + =` / `-` / `0` | `Ctrl + =` / `-` / `0` |
| Rename tab | `F2` | `F2` |

\* On Windows/Linux the terminal keeps `Ctrl + F` for the agent — use the palette or the right-click entry. Terminal shortcuts are active only in a CLI Code tab.

Command Palette (`CLI Code:`): New Session · Resume Session · Restart Session · Restart All Sessions · Quick Command · Save as Quick Command · Rename Tab · Find in Terminal · Copy Context · Copy · Paste · Select All · Zoom In / Out / Reset · Install Status Hooks · Remove Status Hooks — plus *Open CLI*, *Open CLI in new tab* and *CLI: Insert At-Mentioned*.

| Setting | Default | Meaning |
| --- | --- | --- |
| `cliCode.statusHooks` | `true` | Keep status hooks installed in every supported agent on `PATH`; `false` removes them. |
| `cliCode.notifications` | `true` | Notify when an agent finishes or starts waiting on a tab you are not looking at. |
| `cliCode.quickCommands` | `[]` | `{ "label", "text", "submit"? }` entries; User settings = global, Workspace settings = project. |
| `cliCode.composer` | `false` | Experimental chat-style input under the terminal (applies to new tabs). |

## What CLI Code touches

- **Writes** the status hook into each agent's own config (`~/.claude/settings.json`, `~/.factory/settings.json`, `~/.codex/hooks.json` + trust entries in `config.toml`, `~/.copilot/hooks/cli-code.json`, `~/.grok/hooks/cli-code.json`, a generated `cli-code-status.ts` plugin for opencode/Kilo/MiMo and extension for Pi/OMP), backing each file up once as `<file>.cli-code.bak`. Your own hooks are kept; `cliCode.statusHooks: false` removes everything.
- **Reads** the agents' session stores to find session ids, titles and models, and the modification times of their MCP/plugin/hook files to spot stale tabs.
- **No network** of its own; no data leaves your machine through CLI Code.

## Limits

- Closing a tab ends the agent inside it (VS Code cannot ask first); quitting VS Code ends every session. Reload Window does not.
- Status hooks and the interactive-shell launch are POSIX only (macOS, Linux). On Windows tabs work but show no state marks.
- Nine agents have no addressable sessions and restart with their `--continue` flag (see the table).

## FAQ

**The agent asks me to log in.** Expected — CLI Code only launches it. Complete the login once in any terminal.

**Nothing happens on `Cmd + Alt + K`.** A file must be open in the editor and an agent tab focused.

**A shortcut collides with another extension.** Rebind it under *Preferences → Keyboard Shortcuts* (search "CLI Code").

**Can I keep using VS Code's own terminal?** Yes — CLI Code only manages the tabs it opens.

## Development

- `bun test` — unit tests.
- `bun run test:integration` — a real VS Code Extension Host (downloaded once into `.vscode-test/`): open/type/close, gone/restart, hook → state, resume and quick commands, two-stage reload. macOS/Linux; never writes your real hook files — the runner snapshots them and fails if one changes.
- `node test/e2e/status-hooks.mjs [agent…]` — end-to-end against the agents installed on your machine (one model call each).
- `bun run package:target <platform>` — VSIX for one target; `bun run package:all` for all six.

Agent icons are sourced from [Orca](https://github.com/stablyai/orca).

## License

[MIT](LICENSE) © 2026 Thanh Luan
