import type { ILink, ILinkProvider, Terminal } from "@xterm/xterm"
import { PATH_LINK_SOURCE } from "../lib/path-link.js"

// PATH_LINK_SOURCE is anchored ("^...$"); strip both anchors so the token can be matched
// anywhere within a line of terminal text (see the assertion in path-link.ts).
const TOKEN_RE = new RegExp(`(?:^|[\\s"'(\\[])(${PATH_LINK_SOURCE.slice(1, -1)})`, "g")

/** Recognises file paths (optionally :line:col) on one buffer row; activation is decided by the host. */
export function createPathLinkProvider(
  term: Terminal,
  onActivate: (event: MouseEvent, text: string) => void,
): ILinkProvider {
  return {
    provideLinks(y, callback) {
      const line = term.buffer.active.getLine(y - 1)
      if (!line) return callback(undefined)
      const text = line.translateToString(true)
      const links: ILink[] = []
      for (const m of text.matchAll(TOKEN_RE)) {
        const token = m[1]!
        const start = m.index! + m[0].length - token.length
        links.push({
          text: token,
          range: { start: { x: start + 1, y }, end: { x: start + token.length, y } },
          activate: (e) => onActivate(e, token),
        })
      }
      callback(links.length ? links : undefined)
    },
  }
}
