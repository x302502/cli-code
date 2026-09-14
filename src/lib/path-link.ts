// No Node imports here: this module is also bundled into the webview (via path-resolve.ts's
// re-export of PATH_LINK_SOURCE), and a `node:*` import would break the browser bundle.

const PATH_RE = /^((?:~|\.{1,2})?\/[\w.\-@+/]+|[\w.\-@+]+\/[\w.\-@+/]+)(?::(\d+))?(?::(\d+))?$/

// TOKEN_RE in the webview is built from this source with the leading "^" and trailing "$"
// stripped off, so it can match a path token anywhere within a line of terminal text.
// Assert the assumption PATH_LINK_SOURCE.slice(1, -1) relies on.
if (!PATH_RE.source.startsWith("^") || !PATH_RE.source.endsWith("$")) {
  throw new Error("PATH_RE must be anchored with ^ and $")
}
export const PATH_LINK_SOURCE = PATH_RE.source

export function parsePathLink(text: string): { path: string; line?: number; col?: number } | undefined {
  if (/^[a-z]+:\/\//i.test(text)) return undefined
  const m = PATH_RE.exec(text)
  if (!m) return undefined
  const out: { path: string; line?: number; col?: number } = { path: m[1]! }
  if (m[2]) out.line = Number(m[2])
  if (m[3]) out.col = Number(m[3])
  return out
}
