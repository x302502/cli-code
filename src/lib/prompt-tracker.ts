import { formatPromptTitle } from "./tab-title.js"

const PASTE_START = "\x1b[200~"
const PASTE_END = "\x1b[201~"

/**
 * Rebuilds the line the user is typing from raw terminal input. It only needs to
 * be good enough for a tab title (`feed` returns the title on Enter) and for knowing
 * whether an unsent prompt is sitting in the input (`hasDraft`): printable characters
 * append, backspace deletes, escape sequences are skipped, bracketed paste is taken
 * verbatim, Enter submits.
 */
export function createPromptTracker(opts: { draftUnknown?: boolean } = {}): { feed: (input: string) => string | undefined; hasDraft: () => boolean; reset: () => void } {
  let line = ""
  let pasting = false
  // A tracker attached to a running CLI (after a reload) never saw what is already typed into
  // its prompt: assume a draft, so a stale tab is not auto-restarted over it, until the line is
  // known empty again.
  let unknown = opts.draftUnknown ?? false

  const feed = (input: string): string | undefined => {
    let submitted: string | undefined
    let i = 0
    while (i < input.length) {
      if (pasting) {
        const end = input.indexOf(PASTE_END, i)
        if (end === -1) {
          line += input.slice(i)
          return undefined
        }
        line += input.slice(i, end)
        pasting = false
        i = end + PASTE_END.length
        continue
      }
      if (input.startsWith(PASTE_START, i)) {
        pasting = true
        i += PASTE_START.length
        continue
      }
      const ch = input[i]!
      if (ch === "\x1b") {
        // ESC CR is Shift+Enter (soft newline) — keep the first line, drop the rest.
        if (input[i + 1] === "\r") {
          line += "\n"
          i += 2
          continue
        }
        // CSI: ESC [ params final-byte(0x40–0x7e). Other ESC: skip one byte.
        if (input[i + 1] === "[") {
          let j = i + 2
          while (j < input.length && !(input.charCodeAt(j) >= 0x40 && input.charCodeAt(j) <= 0x7e)) j++
          i = j + 1
        } else i += 1
        continue
      }
      if (ch === "\r" || ch === "\n") {
        const title = formatPromptTitle(line)
        submitted = title || undefined
        line = ""
        unknown = false
      } else if (ch === "\x7f" || ch === "\b") line = line.slice(0, -1)
      else if (ch === "\x03" || ch === "\x15") {
        line = ""
        unknown = false
      } else if (ch >= " ") line += ch
      i++
    }
    return submitted
  }
  const reset = () => {
    line = ""
    unknown = false
  }
  return { feed, hasDraft: () => unknown || line.length > 0, reset }
}
