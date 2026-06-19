# CLI Code

**English** · [Tiếng Việt](README.vi.md) · [中文](README.zh.md) · [日本語](README.ja.md)

> Launch and switch between AI coding CLIs — Claude Code, Codex, Gemini, opencode, and more — right inside a VS Code side terminal, and send the file you're looking at straight into the running agent.

## Why CLI Code?

If you use terminal-based AI coding agents, you probably juggle several of them. CLI Code gives you **one keystroke** to pick any of them, opens it in a terminal beside your editor, and lets you push the **active file (with the selected lines)** into the agent's prompt without copy-pasting.

## Features

- 🚀 **One-key launcher** — press a shortcut, pick a CLI, and it opens in a terminal beside your code.
- 🔁 **Reuse or new tab** — focus an already-running CLI, or always spawn a fresh one.
- 📎 **Send the active file** — insert `@path/to/file.ts#L10-20` (with your selection) into the focused CLI.
- 🌐 **HTTP-aware CLIs** — for agents that expose a local API (e.g. opencode), the file is posted over the port instead of typed.
- 🐝 **11 CLIs out of the box** — add your own with a few lines of config.

## Supported CLIs

| #   | CLI                | Command                               |
| --- | ------------------ | ------------------------------------- |
| 1   | Claude Code        | `claude`                              |
| 2   | Codex CLI          | `codex`                               |
| 3   | Mimo               | `mimo`                                |
| 4   | opencode           | `opencode --port {port}` (HTTP-aware) |
| 5   | Gemini CLI         | `gemini`                              |
| 6   | GitHub Copilot CLI | `copilot`                             |
| 7   | Amp                | `amp`                                 |
| 8   | Droid              | `droid`                               |
| 9   | Kiro CLI           | `kiro-cli`                            |
| 10  | Antigravity        | `agy`                                 |
| 11  | CommandCode        | `commandcode`                         |

> Each CLI must be installed and available on your `PATH`. CLI Code launches the command — it does not install the agents for you.

## Installation

**From the Marketplace** — search **"CLI Code"** in the Extensions view (`Cmd/Ctrl + Shift + X`), or:

```bash
code --install-extension x302502.cli-code
```

**From a `.vsix` file:**

```bash
code --install-extension cli-code-0.1.0.vsix
```

## Usage

### 1. Open a CLI

| Action                                     | macOS               | Windows / Linux      |
| ------------------------------------------ | ------------------- | -------------------- |
| Open CLI picker (reuse if already running) | `Cmd + Esc`         | `Ctrl + Esc`         |
| Open CLI in a **new** terminal             | `Cmd + Shift + Esc` | `Ctrl + Shift + Esc` |
| Insert active file into the focused CLI    | `Cmd + Alt + K`     | `Ctrl + Alt + K`     |

A Quick Pick lists all configured CLIs. Choose one and it opens in a terminal **beside** your editor, running its command. If you used the reuse shortcut and that CLI is already open, CLI Code just focuses its terminal.

### 2. Send the file you're working on

Place your cursor in a file (optionally select some lines), focus the CLI terminal, and press `Cmd/Ctrl + Alt + K`. CLI Code inserts a reference like:

- `@src/app.ts` — whole file
- `@src/app.ts#L10` — a single line
- `@src/app.ts#L10-20` — a line range

For **HTTP-aware** CLIs (currently opencode), the reference is sent over the agent's local HTTP API; for everything else it is typed into the terminal.

> Commands are also available from the Command Palette (`Cmd/Ctrl + Shift + P`): **Open CLI**, **Open CLI in new tab**, **CLI: Insert At-Mentioned**.

## Adding your own CLI

CLI Code is config-driven. Open [`src/lib/config.ts`](src/lib/config.ts) and add an entry to `CLI_TOOLS`:

```ts
{
  id: "my-agent",            // unique id (also the terminal name)
  label: "My Agent",         // shown in the picker
  description: "My coding agent CLI",
  command: "my-agent",       // shell command; use "{port}" for HTTP-aware CLIs
  hasHttpApi: false,
}
```

For an HTTP-aware CLI, add the API fields:

```ts
{
  id: "opencode",
  label: "opencode",
  command: "opencode --port {port}",
  hasHttpApi: true,
  portEnvVar: "_EXTENSION_OPENCODE_PORT", // env var the CLI reads for its port
  appendPromptPath: "/tui/append-prompt", // endpoint that accepts the file reference
  readyCheckPath: "/app",                 // endpoint polled until the server is up
  extraEnv: { OPENCODE_CALLER: "vscode" },
}
```

The order of entries is the order shown in the picker.

## Development

This project uses [Bun](https://bun.sh).

```bash
bun install          # install dependencies
bun run compile      # type-check + lint + build to dist/
bun run watch:esbuild # rebuild on change
bun test             # run unit tests
bun run vsix         # package a .vsix
```

Press `F5` in VS Code to launch an **Extension Development Host** with the extension loaded.

### Project layout

```
src/
├── extension.ts        # activation shell (registers commands)
└── lib/
    ├── config.ts       # CliTool type + CLI_TOOLS registry
    ├── commands.ts     # command handlers
    ├── terminal.ts     # terminal creation, tool picking, ports
    ├── http-client.ts  # HTTP calls for API-aware CLIs
    └── editor.ts       # active-file reference helper
```

## Requirements

- VS Code `^1.94.0`
- The CLI agents you want to use, installed and on your `PATH`.

## License

[MIT](LICENSE) © 2026 Thanh Luan
