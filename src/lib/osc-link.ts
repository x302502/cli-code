import { parseFileUrlPath } from "./osc-scan.js"

/** What the webview should do with an OSC 8 hyperlink target when it is activated. */
export type OscLinkTarget =
  | { kind: "link"; uri: string }
  | { kind: "path"; path: string; line?: number; col?: number }
  | { kind: "other" }

/**
 * OSC 8 links come straight from the CLI, so only two shapes are acted on: web/mail links
 * (opened by the host after its own scheme check) and file:// links (opened in an editor).
 * Everything else is copy-only — a printed `javascript:` or custom-scheme link must never
 * reach a handler.
 */
export function classifyOscLink(uri: string): OscLinkTarget {
  if (/^(https?|mailto):/i.test(uri)) return { kind: "link", uri }
  const hash = uri.indexOf("#")
  const rawPath = parseFileUrlPath(hash === -1 ? uri : uri.slice(0, hash))
  if (!rawPath) return { kind: "other" }
  // Line/column either as a GitHub-style fragment (`#L12C4`, `#12`) or a `:12:4` path suffix.
  const frag = hash === -1 ? undefined : /^L?(\d+)(?:C(\d+))?$/i.exec(uri.slice(hash + 1))
  const suffix = frag ? undefined : /^(.*?):(\d+)(?::(\d+))?$/.exec(rawPath)
  const path = suffix ? suffix[1]! : rawPath
  const line = frag?.[1] ?? suffix?.[2]
  const col = frag?.[2] ?? suffix?.[3]
  const out: OscLinkTarget = { kind: "path", path }
  if (line) out.line = Number(line)
  if (col) out.col = Number(col)
  return out
}
