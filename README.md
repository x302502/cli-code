# CLI Code

A VS Code extension that launches coding CLIs (Claude Code, opencode, Gemini CLI, Aider...) in a side terminal, and lets you insert the active file path into the running CLI.

## Usage

- `Cmd/Ctrl + Esc` — open the CLI picker; focuses an existing terminal if that CLI is already running.
- `Cmd/Ctrl + Shift + Esc` — always open the chosen CLI in a new terminal.
- `Cmd/Ctrl + Alt + K` — insert the active file (`@path#L1-5`) into the focused CLI terminal. For HTTP-aware CLIs (opencode) it posts over the local port; otherwise it types the path.

## Adding a CLI

Edit the `CLI_TOOLS` array at the top of `src/extension.ts`. Each entry: `id`, `label`, `command` (`{port}` is substituted when `hasHttpApi`), and optional HTTP fields (`portEnvVar`, `appendPromptPath`, `readyCheckPath`).

## Develop

- `node esbuild.js` — build to `dist/`
- Press `F5` in VS Code to launch an Extension Development Host
- `npm run vsix` — package a `.vsix`
