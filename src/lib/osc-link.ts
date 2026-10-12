import { parseFileUrlPath } from "./osc-scan.js"
import { parsePathLink } from "./path-link.js"

/** Private OSC a snapshot ends with to carry its OSC 8 links (daemon/session.ts oscLinks):
 * `[row offset from the cursor's row, column, cells, uri][]` as JSON. */
export const SNAPSHOT_LINKS_OSC = 9998

/** What the webview should do with an OSC 8 hyperlink target when it is activated. */
export type OscLinkTarget =
  | { kind: "link"; uri: string }
  | { kind: "path"; path: string; line?: number; col?: number }
  | { kind: "other" }

/**
 * OSC 8 links come straight from the CLI, so only three shapes are acted on: web/mail links
 * (opened by the host after its own scheme check), file:// links, and scheme-less paths
 * (OMP links a markdown `[x](src/a.ts)` as-is), the last two opened in an editor.
 * Everything else is copy-only — a printed `javascript:` or custom-scheme link must never
 * reach a handler.
 */
export function classifyOscLink(uri: string): OscLinkTarget {
  if (/^(https?|mailto):/i.test(uri)) return { kind: "link", uri }
  const hash = uri.indexOf("#")
  const base = hash === -1 ? uri : uri.slice(0, hash)
  // Line/column either as a GitHub-style fragment (`#L12C4`, `#12`, a `#L12-L20` range opens at
  // its start) or a `:12:4` path suffix.
  const frag = hash === -1 ? undefined : /^L?(\d+)(?:C(\d+))?(?:-L?\d+(?:C\d+)?)?$/i.exec(uri.slice(hash + 1))
  const rawPath = parseFileUrlPath(base)
  if (!rawPath) {
    const bare = parsePathLink(base)
    if (!bare) return { kind: "other" }
    if (frag) return { kind: "path", path: bare.path, line: Number(frag[1]), ...(frag[2] ? { col: Number(frag[2]) } : {}) }
    return { kind: "path", ...bare }
  }
  const suffix = frag ? undefined : /^(.*?):(\d+)(?::(\d+))?$/.exec(rawPath)
  const path = suffix ? suffix[1]! : rawPath
  const line = frag?.[1] ?? suffix?.[2]
  const col = frag?.[2] ?? suffix?.[3]
  const out: OscLinkTarget = { kind: "path", path }
  if (line) out.line = Number(line)
  if (col) out.col = Number(col)
  return out
}
