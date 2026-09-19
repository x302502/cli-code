// No Node imports here: this module is also bundled into the webview (via path-resolve.ts's
// re-export), and a `node:*` import would break the browser bundle.

// Extension-less filenames worth linking on their own (same allow-list Orca uses); anything
// else without a slash needs a `name.ext` shape. Existence is checked before a link is shown,
// so a generous match here costs nothing but a stat.
const BARE_NAMES = "README|Makefile|Dockerfile|Rakefile|Gemfile|Procfile|LICENSE|CHANGELOG|AUTHORS|NOTICE|CONTRIBUTING"
const PATH_RE = new RegExp(
  `^((?:~|\\.{1,2})?/[\\w.\\-@+/]+|[\\w.\\-@+]+/[\\w.\\-@+/]*|(?:${BARE_NAMES})(?:\\.[\\w.\\-]+)?|[A-Za-z_][\\w\\-]*(?:\\.[\\w\\-]+)*\\.[A-Za-z][A-Za-z0-9]{1,7})(?::(\\d+))?(?::(\\d+))?$`,
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
const TOKEN_RE = /[\w.\-@+~/:]+/g
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
