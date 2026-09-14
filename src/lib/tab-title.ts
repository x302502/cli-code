/**
 * Strips slash commands, pasted-text annotations, and limits length
 * to produce a clean, human-readable terminal tab title from a prompt.
 */
export function formatPromptTitle(prompt: string): string {
  if (!prompt) return ""

  // Strip leading slash commands like /goal, /plan, /clear
  let text = prompt.replace(/^\/[a-zA-Z0-9_-]+\s*/, "").trim()
  // Strip pasted-text annotations like [Pasted text #3 +14 lines]
  text = text.replace(/\[Pasted text[^\]]*\]/g, "").trim()
  // Take first non-empty line
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  const firstLine = lines[0] ?? ""
  if (!firstLine || firstLine.length < 2) return ""

  const MAX_LEN = 20
  if (firstLine.length <= MAX_LEN) return firstLine

  // Cut at a word boundary so tabs don't end mid-word, unless that would throw
  // away most of the title (e.g. a long path with no spaces to break on).
  const cut = firstLine.slice(0, MAX_LEN)
  const lastSpace = cut.lastIndexOf(" ")
  const kept = lastSpace >= Math.floor(MAX_LEN * 0.55) ? cut.slice(0, lastSpace) : cut
  return kept.trimEnd() + "…"
}

const SHELL_NAMES = new Set(["sh", "bash", "zsh", "fish", "pwsh", "powershell", "powershell.exe", "cmd.exe"])

/**
 * An OSC title is only worth using when the CLI actually named the session. Default
 * shells often set the title to the shell name or current directory — both are worse
 * than the tool's own label.
 */
export function isMeaningfulOscTitle(title: string): boolean {
  const clean = title.trim()
  if (!clean) return false
  if (SHELL_NAMES.has(clean.toLowerCase())) return false
  if (clean.startsWith("/") || clean.startsWith("~")) return false
  return true
}

export function resolveTabTitle(parts: {
  customTitle?: string
  quickCommandLabel?: string
  oscTitle?: string
  promptTitle?: string
  toolLabel: string
}): string {
  const custom = parts.customTitle?.trim()
  if (custom) return custom

  // A tab opened from a quick command is named after it until the user renames it.
  const quick = parts.quickCommandLabel?.trim()
  if (quick) return quick

  const osc = parts.oscTitle?.trim()
  if (osc && isMeaningfulOscTitle(osc)) return osc

  const prompt = parts.promptTitle?.trim()
  if (prompt) return prompt

  return parts.toolLabel
}
