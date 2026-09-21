/** Orca's generated-tab-title budget: a tab shows a preview, not the prompt. */
export const TAB_TITLE_MAX_LENGTH = 40
const SOURCE_SCAN_LIMIT = 512
// Openers that carry no information about the task ("can you please …").
const LEADING_FILLER = [
  /^(?:can|could|would)\s+you(?:\s+please)?\s+/i,
  /^please(?:\s+|$)/i,
  /^i\s+(?:want|need)\s+(?:you\s+)?to\s+/i,
  /^help\s+me(?:\s+to)?\s+/i,
  /^help\s+/i,
  /^let'?s\s+/i,
  /^we\s+need\s+to\s+/i,
  /^need\s+to\s+/i,
]

/** Cuts to `max` chars at a word boundary (unless that loses most of it) and marks the cut with …. */
export function truncateTitle(value: string, max = TAB_TITLE_MAX_LENGTH): string {
  if (value.length <= max) return value
  const raw = value.slice(0, max)
  const sliced = raw.trim()
  // The cut landed on whitespace: the slice already ends on a word.
  if (sliced.length < raw.length) return `${sliced}…`
  const lastSpace = sliced.lastIndexOf(" ")
  return `${(lastSpace >= Math.floor(max * 0.55) ? sliced.slice(0, lastSpace) : sliced).trim()}…`
}

/**
 * A tab title from a prompt, the way Orca derives one: first clause only, URLs, markdown
 * punctuation, issue prefixes and filler openers dropped, letters/digits kept, capitalised,
 * at most 40 characters with … when cut. Slash commands and pasted-text markers are ours.
 */
export function formatPromptTitle(prompt: string): string {
  if (!prompt) return ""
  // Prompts can be paste-sized; the title only ever comes from the start.
  let text = prompt.slice(0, SOURCE_SCAN_LIMIT).replace(/^\/[a-zA-Z0-9_-]+\s*/, "")
  text = text.replace(/\[Pasted text[^\]]*\]/g, "")
  const firstClause = text
    .trim()
    // URLs first: their `_`/`#` would otherwise be folded to spaces and leak fragments.
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[`*_~#>[\]{}()]/g, " ")
    .replace(/^(?:issue|task|bug|feature|pr)\s*(?:#?\d+)?\s*[:-]\s*/i, "")
    .split(/[.!?;\n\r\u2028\u2029]/u)[0]
    ?.trim()
  if (!firstClause) return ""
  let candidate = firstClause
  for (let i = 0; i < 3; i++) {
    const before = candidate
    for (const pattern of LEADING_FILLER) candidate = candidate.replace(pattern, "")
    candidate = candidate.trim()
    if (candidate === before.trim()) break
  }
  candidate = candidate
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (candidate.length < 2) return ""
  return truncateTitle(candidate.replace(/\p{L}/u, (letter) => letter.toLocaleUpperCase()))
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

  // Some CLIs (Cline) mirror their input line into the title, prompt marker included, and
  // others (Claude, Gemini, Pi/OMP) prefix a status glyph or spinner — the tab shows its own
  // status glyph already. Same prefix set Orca strips, plus prompt markers.
  const osc = parts.oscTitle?.replace(/^(?:[\s✳✦⏲◇✋⠀-⣿◐-◓>❯›»$%#]+|[.*]\s)\s*/u, "").trim()
  if (osc && isMeaningfulOscTitle(osc)) return truncateTitle(osc)

  const prompt = parts.promptTitle?.trim()
  if (prompt) return prompt

  return parts.toolLabel
}
