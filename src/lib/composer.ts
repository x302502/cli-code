// Pure rules for the chat-style composer under the terminal. No DOM here — the webview
// wires these to a textarea; the tests pin the behaviour Vietnamese IME users depend on.

export type ComposerKey = { key: string; shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean; isComposing: boolean }

/**
 * Enter sends, Shift+Enter breaks a line, Escape returns focus to the terminal. An Enter
 * that closes an IME composition (Telex, Kotoeri, …) is the IME's, never a send.
 */
export function composerKeyAction(e: ComposerKey): "submit" | "newline" | "blur" | undefined {
  if (e.isComposing) return undefined
  if (e.key === "Escape") return "blur"
  if (e.key !== "Enter" || e.altKey || e.ctrlKey || e.metaKey) return undefined
  return e.shiftKey ? "newline" : "submit"
}

/** Text as it should reach the CLI: trailing whitespace dropped, nothing sent for blank input. */
export function prepareSubmission(text: string): string | undefined {
  const out = text.replace(/\s+$/, "")
  return out ? out : undefined
}

/** The line under the box; it changes once the text spans several lines (a paste). */
export function composerHint(text: string): string {
  const lines = text.split("\n").length
  return lines > 1 ? `${lines} lines · Enter sends it all · Shift+Enter for a new line` : "Enter to send · Shift+Enter for a new line"
}
