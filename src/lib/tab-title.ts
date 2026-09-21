/** Orca's generated-tab-title budget: a tab shows a preview, not the prompt. */
export const TAB_TITLE_MAX_LENGTH = 40
const SOURCE_SCAN_LIMIT = 512

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
 * A tab title from a prompt: first line, URLs dropped, whitespace folded, at most 40
 * characters cut at a word boundary with … (Orca's budget and cut rule). Orca also splits at
 * the first sentence punctuation and folds all punctuation to spaces; measured on this
 * user's real prompts that ate file names (`source ~/.zshrc` → "Source"), so it is not
 * copied — see docs/title-sync-multi-cli-note.md.
 */
export function formatPromptTitle(prompt: string): string {
  if (!prompt) return ""
  // Prompts can be paste-sized; the title only ever comes from the start.
  let text = prompt.slice(0, SOURCE_SCAN_LIMIT).replace(/^\/[a-zA-Z0-9_-]+\s*/, "")
  text = text.replace(/\[Pasted text[^\]]*\]/g, "")
  const firstLine = text
    .split(/[\n\r\u2028\u2029]/u)
    .map((l) => l.replace(/https?:\/\/\S+/gi, " ").replace(/\s+/g, " ").trim())
    .find(Boolean)
  if (!firstLine || firstLine.length < 2) return ""
  return truncateTitle(firstLine)
}

// Prompt markers and the status glyphs / spinners CLIs prefix (same set Orca strips).
const GLYPH_PREFIX = /^(?:[\s✳✦⏲◇✋⠀-⣿◐-◓>❯›»$%#]+|[.*]\s)\s*/u
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
  // Codex writes `<task> | <folder>` and multiplexers `zsh | <title>`: clean each segment
  // on its own and drop the ones that were only a glyph, so a working Codex with no task
  // summary yet reads "my-ai-books", not "| my-ai-books".
  const osc = parts.oscTitle
    ?.split(" | ")
    .map((seg) => seg.replace(GLYPH_PREFIX, "").replace(/\s*[⠀-⣿]\s*$/u, "").trim())
    .filter(Boolean)
    .join(" | ")
  if (osc && isMeaningfulOscTitle(osc)) return truncateTitle(osc)

  const prompt = parts.promptTitle?.trim()
  if (prompt) return prompt

  return parts.toolLabel
}
