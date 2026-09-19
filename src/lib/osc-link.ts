import { parseFileUrlPath } from "./osc-scan.js"

/** What the webview should do with an OSC 8 hyperlink target when it is activated. */
export type OscLinkTarget = { kind: "link"; uri: string } | { kind: "path"; path: string; line?: number } | { kind: "other" }

/**
 * OSC 8 links come straight from the CLI, so only two shapes are acted on: web/mail links
 * (opened by the host after its own scheme check) and file:// links (opened in an editor).
 * Everything else is copy-only — a printed `javascript:` or custom-scheme link must never
 * reach a handler.
 */
export function classifyOscLink(uri: string): OscLinkTarget {
  if (/^(https?|mailto):/i.test(uri)) return { kind: "link", uri }
  const hash = uri.indexOf("#")
  const path = parseFileUrlPath(hash === -1 ? uri : uri.slice(0, hash))
  if (!path) return { kind: "other" }
  // `#L12` / `#12` fragments, as some CLIs print them.
  const line = hash === -1 ? undefined : /^L?(\d+)$/.exec(uri.slice(hash + 1))?.[1]
  return line ? { kind: "path", path, line: Number(line) } : { kind: "path", path }
}
