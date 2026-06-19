# CLI Code

**English** · [Tiếng Việt](README.vi.md) · [中文](README.zh.md) · [日本語](README.ja.md)

> Open your favourite AI coding assistant in a terminal next to your code — and send the file you're looking at straight into it, with one shortcut.

![Multiple AI CLIs running side by side in VS Code](images/screenshots/terminals.png)

## What it does

Many AI coding tools run in the terminal: **Claude Code, Codex, Gemini, opencode**, and more. If you use more than one, switching between them is a chore.

**CLI Code** puts all of them one shortcut away:

- Press a key → pick an assistant → it opens in a terminal **beside your editor**.
- Press another key → the **file you're viewing** (and the lines you selected) is dropped into the assistant's prompt. No copy-paste.

## Getting started

### 1. Install

Open the **Extensions** view in VS Code (`Cmd/Ctrl + Shift + X`), search for **CLI Code**, and click **Install**.

![CLI Code in the VS Code Marketplace](images/screenshots/marketplace.png)

### 2. Install the assistants you want

CLI Code _launches_ the assistants — it doesn't install them. Make sure the ones you want are installed and runnable from your terminal. Out of the box it knows about:

| Assistant          | Terminal command |
| ------------------ | ---------------- |
| Claude Code        | `claude`         |
| Codex CLI          | `codex`          |
| Mimo               | `mimo`           |
| opencode           | `opencode`       |
| Gemini CLI         | `gemini`         |
| GitHub Copilot CLI | `copilot`        |
| Amp                | `amp`            |
| Droid              | `droid`          |
| Kiro CLI           | `kiro-cli`       |
| Antigravity        | `agy`            |
| CommandCode        | `commandcode`    |

> ⚠️ **Install _and_ sign in first.** Most assistants need to be authenticated
> before they'll run — `claude` (log in to your Anthropic account), `codex`
> (OpenAI login / API key), `gemini` (Google login), and so on. Run each tool
> once in a normal terminal, complete its login flow, and confirm it starts.
>
> 💡 Tip: if a command works when you type it in a normal terminal, it'll work here.

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

**My assistant isn't in the list.**
You can add any terminal-based assistant — see [Adding your own](#adding-your-own-assistant) below.

**Nothing happens when I press `Cmd + Alt + K`.**
Make sure (1) a file is open in the editor, and (2) the assistant's terminal is focused. The file reference goes into whichever CLI terminal is active.

**The shortcut conflicts with something else.**
Rebind it in VS Code: **Preferences → Keyboard Shortcuts**, search for "CLI", and set your own keys.

## Adding your own assistant

CLI Code is just a list of commands, so you can add any CLI. Clone the repo, open `src/lib/config.ts`, and add an entry:

```ts
{
  id: "my-agent",        // a unique name
  label: "My Agent",     // what shows in the menu
  command: "my-agent",   // the terminal command to run
  hasHttpApi: false,
}
```

Then rebuild and reinstall the extension. The order of the list is the order in the menu.

## For developers

Built with [Bun](https://bun.sh).

```bash
bun install      # install dependencies
bun run compile  # type-check + lint + build
bun test         # run unit tests
bun run vsix     # package a .vsix
```

Press `F5` in VS Code to launch an Extension Development Host.

## License

[MIT](LICENSE) © 2026 Thanh Luan
