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

## Keyboard shortcuts

| Action                              | macOS               | Windows / Linux      |
| ----------------------------------- | ------------------- | -------------------- |
| Open / focus an assistant           | `Cmd + Esc`         | `Ctrl + Esc`         |
| Open an assistant in a new terminal | `Cmd + Shift + Esc` | `Ctrl + Shift + Esc` |
| Send the current file to it         | `Cmd + Alt + K`     | `Ctrl + Alt + K`     |

All three are also in the Command Palette (`Cmd/Ctrl + Shift + P`) as **Open CLI**, **Open CLI in new tab**, and **CLI: Insert At-Mentioned**.

## FAQ

**The menu opens but the terminal says "command not found".**
The assistant isn't installed or isn't on your `PATH`. Open a normal terminal and check that the command (e.g. `claude`) runs. If it doesn't, install that tool first.

**The assistant opens but asks me to log in.**
That's expected — CLI Code only launches the tool, it doesn't handle authentication. Complete the assistant's own login flow once (in any terminal); it will remember you afterwards.

**Nothing happens when I press `Cmd + Alt + K`.**
Make sure (1) a file is open in the editor, and (2) the assistant's terminal is focused. The file reference goes into whichever CLI terminal is active.

**The shortcut conflicts with something else.**
Rebind it in VS Code: **Preferences → Keyboard Shortcuts**, search for "CLI", and set your own keys.

## License

[MIT](LICENSE) © 2026 Thanh Luan
