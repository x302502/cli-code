// No Node imports here: this module is also bundled into the webview (via path-resolve.ts's
// re-export), and a `node:*` import would break the browser bundle.

// A one-letter extension only counts for the ones that really exist (C/C++/ObjC/asm/R/D),
// or prose like "e.g" and "i.e" would turn into links.
// Extension-less filenames worth linking on their own (same allow-list Orca uses); anything
// else without a slash needs a `name.ext` shape. Existence is checked before a link is shown,
// so a generous match here costs nothing but a stat.
const BARE_NAMES = "README|Makefile|Dockerfile|Rakefile|Gemfile|Procfile|LICENSE|CHANGELOG|AUTHORS|NOTICE|CONTRIBUTING"
// `\w` is ASCII-only: Vietnamese (and any other non-Latin) filenames need the Unicode
// letter/number/mark classes, and \p{M} covers macOS's decomposed (NFD) diacritics.
const C = "\\p{L}\\p{M}\\p{N}_"
const PATH_RE = new RegExp(
  `^((?:~|\\.{1,2})?/[${C}.\\-@+/]+|[${C}.\\-@+]+/[${C}.\\-@+/]*|(?:${BARE_NAMES})(?:\\.[${C}.\\-]+)?|[\\p{L}_][${C}\\-]*(?:\\.[${C}\\-]+)*\\.(?:[A-Za-z][A-Za-z0-9]{1,7}|[chmsrdCHMSRD]))(?::(\\d+))?(?::(\\d+))?$`,
  "u",
)

export function parsePathLink(text: string): { path: string; line?: number; col?: number } | undefined {
  if (/^[a-z]+:\/\//i.test(text)) return undefined
  const m = PATH_RE.exec(text)
  if (!m) return undefined
  const out: { path: string; line?: number; col?: number } = { path: m[1]! }
  if (m[2]) out.line = Number(m[2])
  if (m[3]) out.col = Number(m[3])
  return out
}

// A candidate token is a run of path-ish characters; the exact shape is then checked with
// PATH_RE after trailing punctuation (sentence/quote/bracket endings) is trimmed away.
const TOKEN_RE = new RegExp(`[${C}.\\-@+~/:]+`, "gu")
const TRAILING = /[.,;:'"]+$/

/** Path-like tokens on one row of terminal text, with their 0-based start column. URLs are
 * left to the web-links addon. */
export function findPathTokens(row: string): { text: string; start: number }[] {
  const out: { text: string; start: number }[] = []
  for (const m of row.matchAll(TOKEN_RE)) {
    const text = m[0].replace(TRAILING, "")
    if (!text || /^[a-z]+:\/\//i.test(m[0]) || !parsePathLink(text)) continue
    out.push({ text, start: m.index! })
  }
  return out
}

const URL_RE = /(?:https?|mailto):[^\s"'<>]+/gi

/** Web/mail URLs on one row, with their 0-based start column. */
export function findUrlTokens(row: string): { text: string; start: number }[] {
  const out: { text: string; start: number }[] = []
  for (const m of row.matchAll(URL_RE)) {
    let text = m[0].replace(/[.,;:!?'"]+$/, "")
    // A closing bracket only belongs to the URL if it closes one opened inside it.
    while (/[)\]]$/.test(text)) {
      const close = text[text.length - 1]!
      const open = close === ")" ? "(" : "["
      if (count(text, open) >= count(text, close)) break
      text = text.slice(0, -1)
    }
    if (text.length > "https://".length) out.push({ text, start: m.index! })
  }
  return out
}

function count(text: string, ch: string): number {
  let n = 0
  for (const c of text) if (c === ch) n++
  return n
}
