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

// Ordered roughly by popularity. Every entry is offered to the user; nothing
// checks whether the CLI is actually installed, so an absent one fails at launch.
// Commands carry the CLI's own permission-bypass flag where one exists — see the
// per-entry notes for the tools that have no such flag.
export const CLI_TOOLS: CliTool[] = [
  {
    id: "claude",
    label: "Claude Code",
    emoji: "🟠",
    description: "Anthropic Claude Code CLI",
    command: "claude --dangerously-skip-permissions",
    hasHttpApi: false,
  },
  {
    id: "codex",
    label: "Codex CLI",
    emoji: "🤖",
    description: "OpenAI Codex CLI",
    command: "codex --dangerously-bypass-approvals-and-sandbox",
    hasHttpApi: false,
  },
  {
    id: "mimo",
    label: "Mimo",
    emoji: "📱",
    description: "Mimo coding agent",
    command: "mimo --never-ask --trust",
    hasHttpApi: false,
  },
  {
    id: "antigravity",
    label: "Antigravity",
    emoji: "🪐",
    description: "Google Antigravity CLI",
    command: "agy --dangerously-skip-permissions",
    hasHttpApi: false,
  },
  {
    id: "copilot",
    label: "GitHub Copilot CLI",
    emoji: "🐙",
    description: "GitHub Copilot in the terminal",
    command: "copilot --allow-all",
    hasHttpApi: false,
  },
  {
    id: "opencode",
    label: "opencode",
    emoji: "🔓",
    description: "opencode TUI (HTTP-aware)",
    command: "opencode --port {port} --auto",
    hasHttpApi: true,
    portEnvVar: "_EXTENSION_OPENCODE_PORT",
    appendPromptPath: "/tui/append-prompt",
    readyCheckPath: "/app",
    extraEnv: { OPENCODE_CALLER: "vscode" },
  },
  {
    id: "amp",
    label: "Amp",
    emoji: "⚡",
    description: "Sourcegraph Amp coding agent",
    command: "amp --dangerously-allow-all",
    hasHttpApi: false,
  },
  {
    id: "droid",
    label: "Droid",
    emoji: "🦾",
    description: "Factory AI Droid coding agent",
    // Droid's interactive TUI has no bypass flag; autonomy is set in its settings.
    command: "droid",
    hasHttpApi: false,
  },
  {
    id: "kiro",
    label: "Kiro CLI",
    emoji: "🌀",
    description: "AWS Kiro CLI coding agent",
    command: "kiro-cli chat --trust-all-tools",
    hasHttpApi: false,
  },
  {
    id: "commandcode",
    label: "CommandCode",
    emoji: "⌨️",
    description: "CommandCode coding agent",
    command: "commandcode --trust --yolo",
    hasHttpApi: false,
  },
  {
    id: "pi",
    label: "Pi",
    emoji: "🥧",
    description: "Pi coding agent",
    // Pi runs tools without permission prompts by default; --approve skips the
    // project-local files trust prompt.
    command: "pi --approve",
    hasHttpApi: false,
  },
  {
    id: "kilo",
    label: "Kilo",
    emoji: "🪁",
    description: "Kilo Code coding agent (opencode fork, 500+ models)",
    // Kilo's TUI has no permission-bypass flag. Auto-approval is configured in
    // ~/.config/kilo/kilo.json ({"permission": {"*": "allow"}}) or per-session
    // via the /auto-approve command. Its --port HTTP server requires auth
    // (401 without a token), so the opencode-style append-prompt API is unusable.
    command: "kilo",
    hasHttpApi: false,
  },
]
