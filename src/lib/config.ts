export type CliTool = {
  id: string
  label: string
  /** Emoji shown before the label in the terminal tab name. */
  emoji: string
  description?: string
  /** Shell command to launch. Use `{port}` as a placeholder for HTTP-aware CLIs. */
  command: string
  hasHttpApi: boolean
  /** Env var the CLI reads to discover the port it should serve on. */
  portEnvVar?: string
  appendPromptPath?: string
  readyCheckPath?: string
  /** Extra environment variables to set when launching the terminal. */
  extraEnv?: Record<string, string>
}

// Ordered roughly by popularity. Only CLIs detected on this machine are listed.
export const CLI_TOOLS: CliTool[] = [
  {
    id: "claude",
    label: "Claude Code",
    emoji: "🟠",
    description: "Anthropic Claude Code CLI",
    command: "claude",
    hasHttpApi: false,
  },
  {
    id: "codex",
    label: "Codex CLI",
    emoji: "🤖",
    description: "OpenAI Codex CLI",
    command: "codex",
    hasHttpApi: false,
  },
  {
    id: "mimo",
    label: "Mimo",
    emoji: "📱",
    description: "Mimo coding agent",
    command: "mimo",
    hasHttpApi: false,
  },
  {
    id: "antigravity",
    label: "Antigravity",
    emoji: "🪐",
    description: "Google Antigravity CLI",
    command: "agy",
    hasHttpApi: false,
  },
  {
    id: "copilot",
    label: "GitHub Copilot CLI",
    emoji: "🐙",
    description: "GitHub Copilot in the terminal",
    command: "copilot",
    hasHttpApi: false,
  },
  {
    id: "opencode",
    label: "opencode",
    emoji: "🔓",
    description: "opencode TUI (HTTP-aware)",
    command: "opencode --port {port}",
    hasHttpApi: true,
    portEnvVar: "_EXTENSION_OPENCODE_PORT",
    appendPromptPath: "/tui/append-prompt",
    readyCheckPath: "/app",
    extraEnv: { OPENCODE_CALLER: "vscode" },
  },
  {
    id: "gemini",
    label: "Gemini CLI",
    emoji: "♊",
    description: "Google Gemini CLI",
    command: "gemini",
    hasHttpApi: false,
  },
  {
    id: "amp",
    label: "Amp",
    emoji: "⚡",
    description: "Sourcegraph Amp coding agent",
    command: "amp",
    hasHttpApi: false,
  },
  {
    id: "droid",
    label: "Droid",
    emoji: "🦾",
    description: "Factory AI Droid coding agent",
    command: "droid",
    hasHttpApi: false,
  },
  {
    id: "kiro",
    label: "Kiro CLI",
    emoji: "🌀",
    description: "AWS Kiro CLI coding agent",
    command: "kiro-cli",
    hasHttpApi: false,
  },
  {
    id: "commandcode",
    label: "CommandCode",
    emoji: "⌨️",
    description: "CommandCode coding agent",
    command: "commandcode",
    hasHttpApi: false,
  },
]
