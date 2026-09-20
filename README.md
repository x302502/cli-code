# CLI Code

**English** · [Tiếng Việt](README.vi.md) · [中文](README.zh.md) · [日本語](README.ja.md)

> Open your favourite AI coding assistant in a terminal next to your code — and send the file you're looking at straight into it, with one shortcut.

![Multiple AI CLIs running side by side in VS Code](images/screenshots/terminals.png)

## What it does

Many AI coding tools run in the terminal: **Claude Code, Codex, Antigravity, opencode**, and more. If you use more than one, switching between them is a chore.

**CLI Code** puts all of them one shortcut away:

- Press a key → pick an assistant → it opens in a terminal **beside your editor**.
- Each assistant opens with its **own icon** on the terminal tab (icons sourced from [Orca](https://github.com/stablyai/orca)).
- Press another key → the **file you're viewing** (and the lines you selected) is dropped into the assistant's prompt. No copy-paste.

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
| [OpenClaude](https://openclaude.gitlawb.com/)                                                    | `openclaude`        |
| [Ante](https://github.com/AntigmaLabs/ante-preview)                                              | `ante`              |
| [Trae](https://docs.trae.cn/cli_get-started-with-trae-cli)                                       | `traecli`           |
| [Prime Agent](https://github.com/PrimeIntellect-ai/prime-agent)                                  | `prime-agent`       |
| [Aider](https://aider.chat/docs/)                                                                | `aider`             |
| [Goose](https://block.github.io/goose/docs/quickstart/)                                          | `goose`             |
| [Kiro](https://kiro.dev)                                                                         | `kiro-cli`          |
| [Charm / Crush](https://github.com/charmbracelet/crush)                                          | `crush`             |
| [Auggie](https://docs.augmentcode.com/cli/overview)                                              | `auggie`            |
| [Autohand Code](https://github.com/autohandai/code-cli)                                          | `autohand`          |
| [Codebuff](https://www.codebuff.com/docs/help/quick-start)                                       | `codebuff`          |
| [Continue](https://docs.continue.dev/guides/cli)                                                 | `cn`                |
| [Cursor](https://cursor.com/cli)                                                                 | `cursor-agent`      |
| [Kimi](https://www.kimi.com/code/docs/en/kimi-code-cli/getting-started.html)                     | `kimi`              |
| [Mistral Vibe](https://github.com/mistralai/mistral-vibe)                                        | `vibe`              |
| [Qwen Code](https://github.com/QwenLM/qwen-code)                                                 | `qwen`              |
| [Rovo Dev](https://support.atlassian.com/rovo/docs/install-and-run-rovo-dev-cli-on-your-device/) | `rovo`              |
| [Hermes](https://hermes-agent.nousresearch.com/docs/)                                            | `hermes`            |
| [Devin](https://devin.ai/cli)                                                                    | `devin`             |
| [OpenClaw](https://github.com/openclaw/openclaw)                                                 | `openclaw`          |

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

## Built-in terminal (0.2.0)

As of 0.2.0, CLI Code no longer opens assistants in a regular VS Code integrated terminal — each assistant opens in the **extension's own terminal**: a webview panel connected to a background PTY daemon. That gets you:

- A **coloured icon** on the terminal tab for each assistant.
- **Automatic tab titles** that update from the prompt you just typed (no manual renaming needed).
- **Agent status** shown right on the tab title — working, waiting on you, or done.
- Sessions that **survive Reload Window**: after a reload, the terminal reconnects to the running CLI session automatically, with nothing lost.

### Limits

- **Closing a tab ends that CLI.** VS Code doesn't let an extension "ask before closing" a tab, so closing one stops the CLI process inside it immediately — no warning.
- **Quitting VS Code ends all sessions.** Every CLI running under CLI Code stops with it.
- **Claude status hooks only work on POSIX** (macOS, Linux) — Windows can't install this hook.

### Claude Code status hook

CLI Code can install a small hook into Claude Code so the tab shows accurate status (working / waiting / done) instead of guessing from the title. This is **opt-in**:

- The first time you open Claude Code inside CLI Code, the extension asks whether to install the hook (controlled by the `cliCode.claudeStatusHooks` setting). Dismissing that toast without answering counts as "off" for this window — install later with the Command Palette entry **"CLI Code: Cài hook trạng thái Claude"** (Install Claude status hook).
- If you agree, it appends to `~/.claude/settings.json`. Before the first write, the original file is backed up to `~/.claude/settings.json.cli-code.bak`; any hooks you already had are kept.
- The hook takes effect from the next Claude Code start — a session that was already running keeps guessing status from the title.
- Remove it anytime with the Command Palette entry **"CLI Code: Gỡ hook trạng thái Claude"** (Uninstall Claude status hook).
- Known limit: the hook command is evaluated by the shell (`eval "$CLI_CODE_HOOK"`), so a VS Code install path containing `"` or `$` breaks it.
- The entry added for each of the 4 events `UserPromptSubmit`, `Stop`, `Notification`, `PermissionRequest`:

  ```json
  {
    "type": "command",
    "command": "[ -n \"$CLI_CODE_HOOK\" ] && eval \"$CLI_CODE_HOOK\" || true"
  }
  ```

  This command is a no-op when Claude Code runs outside CLI Code (the `CLI_CODE_HOOK` variable doesn't exist, so nothing happens).

### Settings

| Setting                     | Type                       | Default | Description                                                                                 |
| ---------------------------- | --------------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| `cliCode.claudeStatusHooks`  | `"ask" \| "on" \| "off"`   | `"ask"` | Install a status hook into `~/.claude/settings.json` so the Claude tab shows working / waiting / done. |
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

Paths the CLI prints (`src/x.ts:12:3`, `./dir`, `~/notes.md`, `README`, `file://…`) become links once they exist on disk — a truncated or missing path is never underlined. `Cmd/Ctrl + click` opens a file in the editor (Markdown in the preview, HTML in the browser) and a **folder** in VS Code's Explorer (inside the workspace) or in Finder / Explorer (outside it); `Shift + Cmd/Ctrl + click` opens a file with its default app. A plain click selects the whole link (URL or path) so a normal `Cmd/Ctrl + C` copies it.

### Terminal right-click menu

**Khởi động lại phiên** (Restart) brings the tab back into the *same conversation*: Claude Code via the session id its hook reports; Codex, Grok, Pi, OMP, Command Code, Droid, Prime Agent, Copilot, Cline, Kimi, Cursor, Amp, opencode, MiMo, Kilo and goose via the newest session their own store shows for this directory since the tab was opened; the remaining CLIs via their `--continue` form. Only when nothing is known does it start fresh.

Right-click acts on what is under the pointer or selected: **Sao chép** (Copy, with a selection) · **Dán** (Paste) · **Chọn tất cả** (Select all) · on a URL **Mở liên kết** / on a file **Mở tệp**, **Mở bằng app mặc định**, **Chèn @đường-dẫn vào CLI** / on a folder **Mở thư mục** · **Sao chép liên kết / đường dẫn** · **Tìm vùng đã bôi** · **Tìm trong terminal**. Tab-level actions sit in a quiet bar at the top of the terminal (same background, icons flush right): **Phiên mới** (New session — pick a CLI, opened in this tab's directory), **Mở lại phiên cũ** (History) and **Tìm** (Find), and under **…**: **Đổi tên tab** (Rename, `F2`), **Khởi động lại phiên** (Restart), **Sao chép ngữ cảnh** (Copy context), **Lệnh nhanh** (Quick command). The bar's left side stays empty until the agent needs you (“Đang chờ bạn xác nhận”). Its left side shows the **model** the CLI is using (read from the CLI's own session store — Claude, Codex, Grok, Pi, OMP, opencode/MiMo/Kilo, Cline; hidden for CLIs that do not record it) and, while the agent waits on you, a status line. An experimental chat-style **composer** under the terminal (type or paste, `Enter` sends as one block, `Shift + Enter` breaks a line) can be enabled with `cliCode.composer: true`; it is off by default so the CLI's own input keeps its `/` and `@` menus. Hovering a link shows what `Cmd/Ctrl + click` will open and the resolved path.

### Command Palette commands

The 0.2.0 commands are listed under their Vietnamese titles (English in parentheses):

`CLI Code:` **Mở lại phiên cũ** (Resume past session), **Lệnh nhanh** (Quick command), **Lưu thành lệnh nhanh** (Save as quick command), **Đổi tên tab** (Rename tab), **Khởi động lại phiên** (Restart session), **Phóng to chữ** (Font zoom in), **Thu nhỏ chữ** (Font zoom out), **Cỡ chữ mặc định** (Reset font zoom), **Tìm trong terminal** (Find in terminal), **Sao chép ngữ cảnh** (Copy context), **Dán** (Paste), **Sao chép** (Copy), **Cài hook trạng thái Claude** (Install Claude status hook), **Gỡ hook trạng thái Claude** (Uninstall Claude status hook).

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

\* On Windows / Linux the focused terminal consumes `Ctrl + F` (xterm sends it to the CLI as `^F`). Use the Command Palette command **"CLI Code: Tìm trong terminal"** or the right-click entry **Tìm trong terminal** instead.

## FAQ

**The assistant opens but asks me to log in.**
That's expected — CLI Code only launches the tool, it doesn't handle authentication. Complete the assistant's own login flow once (in any terminal); it will remember you afterwards.

**Nothing happens when I press `Cmd + Alt + K`.**
Make sure (1) a file is open in the editor, and (2) the assistant's terminal is focused. The file reference goes into whichever CLI terminal is active.

**The shortcut conflicts with something else.**
Rebind it in VS Code: **Preferences → Keyboard Shortcuts**, search for "CLI", and set your own keys.

## Development

- `bun test` — unit tests.
- `bun run test:integration` — launches a real VS Code (downloaded once into `.vscode-test/`) and runs the suites in `test/integration/suite/` inside the extension host: open/type/close, gone/restart, hook → status glyph, resume/quick commands, and a two-stage reload that re-attaches a session across a restart. macOS/Linux only; opens a test window; tests never write your real `~/.claude/settings.json` — the runner snapshots it and fails the run if it changes. VS Code's own invocation of the webview serializer on a real Reload Window can't be exercised this way (extension-test mode uses in-memory storage, so it never fires between the two launches) and stays a manual check.

## License

[MIT](LICENSE) © 2026 Thanh Luan
