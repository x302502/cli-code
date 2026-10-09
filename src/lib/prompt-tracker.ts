import { controlStringEnd, isControlStringIntroducer, isCsiReply } from "./control-string.js"
import { formatPromptTitle } from "./tab-title.js"

const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: "grapheme" })

/** `text` without its last user-perceived character — what one Backspace erases: an emoji (two
 * UTF-16 units), `e` + a combining accent, a ZWJ family, a flag. */
function dropLastGrapheme(text: string): string {
  let last = 0
  for (const { index } of GRAPHEMES.segment(text)) last = index
  return text.slice(0, last)
}

const PASTE_START = "\x1b[200~"
const PASTE_END = "\x1b[201~"

/**
 * Rebuilds the line the user is typing from raw terminal input. It only needs to
 * be good enough for a tab title (`feed` returns the title on Enter) and for knowing
 * whether an unsent prompt is sitting in the input (`hasDraft`): printable characters
 * append, backspace deletes, escape sequences are skipped, bracketed paste is taken
 * verbatim, Enter submits.
 */
export function createPromptTracker(opts: { draftUnknown?: boolean } = {}): {
  feed: (input: string) => string | undefined
  hasDraft: () => boolean
  reset: () => void
  promptStarted: () => void
} {
  let line = ""
  let pasting = false
  // Keys that edited the input after the last Enter / Ctrl+C / reset: a prompt the CLI reports
  // as started later (its hook runs after the Enter) was sent before them, so they still stand.
  let typedSinceSubmit = false
  // A tracker attached to a running CLI (after a reload) never saw what is already typed into
  // its prompt: assume a draft, so a stale tab is not auto-restarted over it, until the line is
  // known empty again.
  let unknown = opts.draftUnknown ?? false

  // The start of a CSI, or of the paste-end marker, a chunk ended in the middle of: the next
  // chunk completes it (a split ESC[200~ must not be read as text "0~…").
  let carry = ""

  const feed = (chunk: string): string | undefined => {
    const input = carry + chunk
    carry = ""
    let submitted: string | undefined
    let i = 0
    while (i < input.length) {
      if (pasting) {
        typedSinceSubmit = true
        const end = input.indexOf(PASTE_END, i)
        if (end === -1) {
          // Hold back a tail that may be the start of the end marker.
          let keep = PASTE_END.length - 1
          while (keep > 0 && !input.endsWith(PASTE_END.slice(0, keep))) keep--
          keep = Math.min(keep, input.length - i)
          line += input.slice(i, input.length - keep)
          carry = input.slice(input.length - keep)
          // An Enter earlier in this same chunk already submitted a prompt: its title still counts.
          return submitted
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
        // A chunk ending in a bare ESC: its sequence (a CSI, a paste marker, ESC CR) continues in
        // the next one. Held back — an Esc key on its own changes nothing the tracker can see.
        if (i + 1 === input.length) {
          carry = input.slice(i)
          return submitted
        }
        // The terminal's own replies (OSC colour queries, DCS) are not typing: skip them whole.
        // xterm.js emits each one in a single chunk, terminator included, so a control string
        // that does not end in this input is a key (Alt+]) followed by typing.
        if (isControlStringIntroducer(input[i + 1])) {
          const end = controlStringEnd(input, i)
          if (end !== -1) {
            i = end
            continue
          }
          unknown = typedSinceSubmit = true
          i += 1
          continue
        }
        // ESC CR is Shift+Enter (soft newline) — keep the first line, drop the rest.
        if (input[i + 1] === "\r") {
          line += "\n"
          typedSinceSubmit = true
          i += 2
          continue
        }
        // CSI: ESC [ params final-byte(0x40–0x7e). SS3 (application keys): ESC O x. The tracker
        // only replays typing at the end of the line: any other key — history (↑/↓), caret
        // moves (Home, ←, …), Alt-combos — edits the input in ways it cannot follow, so the
        // draft becomes unknown. Focus reports (ESC [ I / O) are the only keys that are not edits.
        if (input[i + 1] === "[") {
          let j = i + 2
          while (j < input.length && !(input.charCodeAt(j) >= 0x40 && input.charCodeAt(j) <= 0x7e)) j++
          if (j === input.length) {
            carry = input.slice(i)
            return submitted
          }
          if (!(j === i + 2 && (input[j] === "I" || input[j] === "O")) && !isCsiReply(input.slice(i + 2, j), input[j]!))
            unknown = typedSinceSubmit = true
          i = j + 1
        } else if (input[i + 1] === "O" && i + 2 === input.length) {
          // ESC O cut off before its final byte: the next chunk completes it.
          carry = input.slice(i)
          return submitted
        } else if (input[i + 1] === "O" && i + 2 < input.length) {
          unknown = typedSinceSubmit = true
          i += 3
        } else {
          unknown = typedSinceSubmit = true
          i += 1
        }
        continue
      }
      if (ch === "\r" || ch === "\n") {
        const title = formatPromptTitle(line)
        submitted = title || undefined
        line = ""
        unknown = typedSinceSubmit = false
      } else if (ch === "\x7f" || ch === "\b") line = dropLastGrapheme(line)
      else if (ch === "\x03") {
        line = ""
        unknown = typedSinceSubmit = false
      } else if (ch === "\x15") {
        // Ctrl+U erases to the start of the line: from the end (where the tracker keeps the
        // caret) that is everything, but after a caret move (unknown) what follows the caret is
        // still there — the draft stays unknown rather than read as gone.
        line = ""
        if (!unknown) typedSinceSubmit = false
      } else if (ch >= " ") line += ch
      // Every other control key (Ctrl+P/N history, Ctrl+A/E/B/F moves, Tab completion,
      // Ctrl+W/K/Y …) changes the input in a way the tracker cannot replay.
      else unknown = true
      if (ch !== "\r" && ch !== "\n" && ch !== "\x03" && !(ch === "\x15" && !unknown)) typedSinceSubmit = true
      i++
    }
    return submitted
  }
  const reset = () => {
    line = ""
    unknown = typedSinceSubmit = false
  }
  // The CLI began a prompt, so the input it was sent from is empty — unless the user has
  // typed since the last submit: those keys are a new draft.
  const promptStarted = () => {
    if (!typedSinceSubmit) reset()
  }
  return { feed, hasDraft: () => unknown || line.length > 0, reset, promptStarted }
}
