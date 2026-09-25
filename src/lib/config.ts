export type CliTool = {
  id: string
  label: string
  /** Filename of the agent icon in QuickPick, relative to images/agents/. */
  icon: string
  description?: string
  /** Shell command to launch. */
  command: string
  /** Extra environment variables to set when launching the terminal. */
  extraEnv?: Record<string, string>
  /** Reopens a specific past session; `{sessionId}` is substituted. Only for CLIs verified to accept an id. */
  resumeCommand?: string
  /** Reopens the most recent session when the CLI cannot address one by id. */
  continueCommand?: string
  /** Tool id the session-history parsers stamp on this CLI's transcripts, when it differs (variants sharing a CLI). */
  historyToolId?: string
}

// Ordered roughly by popularity. Every entry is offered to the user; nothing
// checks whether the CLI is actually installed, so an absent one fails at launch.
// Commands carry the CLI's own permission-bypass flag where one exists — see the
// per-entry notes for the tools that have no such flag. Icons are sourced from
// the Orca ADE agent glyphs/favicons (github.com/stablyai/orca). Each CLI ships a
// light and dark variant (images/agents-light, images/agents-dark).
export const CLI_TOOLS: CliTool[] = [
  {
    id: "claude",
    label: "Claude Code",
    icon: "claude.svg",
    description: "Anthropic Claude Code CLI",
    command: "claude --dangerously-skip-permissions",
    resumeCommand: "claude --resume {sessionId} --dangerously-skip-permissions",
  },
  {
    id: "claude-agent-teams",
    label: "Claude Agent Teams",
    icon: "claude.svg",
    description: "Claude Code multi-agent teams",
    command: "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --dangerously-skip-permissions",
    resumeCommand: "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --resume {sessionId} --dangerously-skip-permissions",
    historyToolId: "claude",
  },
  {
    id: "codex",
    label: "Codex CLI",
    icon: "codex.svg",
    description: "OpenAI Codex CLI",
    command: "codex --dangerously-bypass-approvals-and-sandbox",
    resumeCommand: "codex resume {sessionId} --dangerously-bypass-approvals-and-sandbox",
  },
  {
    id: "grok",
    label: "Grok",
    icon: "grok.png",
    description: "xAI Grok CLI",
    command: "grok --permission-mode bypassPermissions",
    resumeCommand: "grok --permission-mode bypassPermissions --resume {sessionId}",
  },
  {
    id: "copilot",
    label: "GitHub Copilot CLI",
    icon: "copilot.svg",
    description: "GitHub Copilot in the terminal",
    command: "copilot --yolo",
    continueCommand: "copilot --yolo --continue",
    resumeCommand: "copilot --yolo --resume {sessionId}",
  },
  {
    id: "opencode",
    label: "opencode",
    icon: "opencode.svg",
    description: "opencode TUI",
    command: "opencode --auto",
    extraEnv: { OPENCODE_CALLER: "vscode" },
    continueCommand: "opencode --auto --continue",
    resumeCommand: "opencode --auto --session {sessionId}",
  },
  {
    id: "mimo",
    label: "MiMo Code",
    icon: "mimo-code.png",
    description: "MiMo Code coding agent",
    command: "mimo",
    continueCommand: "mimo --continue",
    resumeCommand: "mimo --session {sessionId}",
  },
  {
    id: "pi",
    label: "Pi",
    icon: "pi.svg",
    description: "Pi coding agent",
    command: "pi",
    continueCommand: "pi --continue",
    resumeCommand: "pi --session-id {sessionId}",
  },
  {
    id: "omp",
    label: "OMP",
    icon: "omp.svg",
    description: "Oh My Pi coding agent",
    command: "omp",
    continueCommand: "omp --continue",
    resumeCommand: "omp --resume {sessionId}",
  },
  {
    id: "antigravity",
    label: "Antigravity",
    icon: "antigravity.png",
    description: "Google Antigravity CLI",
    command: "agy --dangerously-skip-permissions",
    continueCommand: "agy --dangerously-skip-permissions --continue",
    resumeCommand: "agy --dangerously-skip-permissions --conversation {sessionId}",
  },
  {
    id: "amp",
    label: "Amp",
    icon: "amp.png",
    description: "Sourcegraph Amp coding agent",
    command: "amp --dangerously-allow-all",
    // No continueCommand: `threads continue --last` is the machine's last thread, whatever its
    // folder — a restart would land in another project. Threads are found by folder instead.
    resumeCommand: "amp --dangerously-allow-all threads continue {sessionId}",
  },
  {
    id: "kilo",
    label: "Kilocode",
    icon: "kilo.svg",
    description: "Kilo Code coding agent (opencode fork, 500+ models)",
    command: "kilo",
    continueCommand: "kilo --continue",
    resumeCommand: "kilo --session {sessionId}",
  },
  {
    id: "cline",
    label: "Cline",
    icon: "cline.png",
    description: "Cline open-source coding agent CLI",
    command: "cline --auto-approve true",
    resumeCommand: "cline --auto-approve true --id {sessionId}",
  },
  {
    id: "command-code",
    label: "Command Code",
    icon: "command-code.png",
    description: "CommandCode coding agent",
    command: "command-code --yolo",
    continueCommand: "command-code --yolo --continue",
    resumeCommand: "command-code --yolo --resume {sessionId}",
  },
  {
    id: "droid",
    label: "Droid",
    icon: "droid.svg",
    description: "Factory AI Droid coding agent",
    command: "droid",
    continueCommand: "droid --resume",
    resumeCommand: "droid --resume {sessionId}",
  },
  {
    id: "prime-agent",
    label: "Prime Agent",
    icon: "prime-agent.png",
    description: "Prime Agent coding agent",
    command: "prime-agent",
    continueCommand: "prime-agent --continue",
    resumeCommand: "prime-agent -r {sessionId}",
  },
  {
    id: "aider",
    label: "Aider",
    icon: "aider.svg",
    description: "Aider AI pair-programming CLI",
    command: "aider --yes-always",
    continueCommand: "aider --yes-always --restore-chat-history",
  },
  {
    id: "goose",
    label: "Goose",
    icon: "goose.png",
    description: "Block Goose coding agent",
    command: "GOOSE_MODE=auto goose",
    continueCommand: "GOOSE_MODE=auto goose session --resume",
    resumeCommand: "GOOSE_MODE=auto goose session --resume --session-id {sessionId}",
  },
  {
    id: "kiro",
    label: "Kiro",
    icon: "kiro.png",
    description: "AWS Kiro CLI coding agent",
    command: "kiro-cli --trust-all-tools",
    continueCommand: "kiro-cli --trust-all-tools chat --resume",
  },
  {
    id: "crush",
    label: "Charm / Crush",
    icon: "crush.png",
    description: "Charm Crush coding agent",
    command: "crush --yolo",
    continueCommand: "crush --yolo --continue",
  },
  {
    id: "aug",
    label: "Auggie",
    icon: "aug.png",
    description: "Augment Code CLI",
    command: "auggie",
    continueCommand: "auggie --continue",
  },
  {
    id: "continue",
    label: "Continue",
    icon: "continue.png",
    description: "Continue CLI",
    command: 'cn --allow "*"',
    continueCommand: "cn --allow \"*\" --resume",
  },
  {
    id: "cursor",
    label: "Cursor",
    icon: "cursor.png",
    description: "Cursor Agent CLI",
    command: "cursor-agent --yolo",
    continueCommand: "cursor-agent --yolo --continue",
    resumeCommand: "cursor-agent --yolo --resume {sessionId}",
  },
  {
    id: "kimi",
    label: "Kimi",
    icon: "kimi.png",
    description: "Kimi Code CLI",
    command: "kimi --yolo",
    continueCommand: "kimi --yolo --continue",
    resumeCommand: "kimi --yolo --session {sessionId}",
  },
  {
    id: "mistral-vibe",
    label: "Mistral Vibe",
    icon: "mistral-vibe.png",
    description: "Mistral Vibe coding agent",
    command: "vibe --agent auto-approve",
    continueCommand: "vibe --agent auto-approve --continue",
  },
  {
    id: "qwen-code",
    label: "Qwen Code",
    icon: "qwen-code.png",
    description: "Qwen Code CLI",
    command: "qwen --approval-mode yolo",
    continueCommand: "qwen --approval-mode yolo --continue",
  },
  {
    id: "hermes",
    label: "Hermes",
    icon: "hermes.png",
    description: "Nous Research Hermes agent",
    command: "hermes --yolo",
    continueCommand: "hermes --yolo --continue",
  },
  {
    id: "devin",
    label: "Devin",
    icon: "devin.png",
    description: "Cognition Devin CLI",
    command: "devin --permission-mode bypass",
    continueCommand: "devin --permission-mode bypass --continue",
  },
]
