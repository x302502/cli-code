import * as path from "node:path"

export { PATH_LINK_SOURCE, parsePathLink } from "./path-link.js"

/** Absolute paths to try, most specific first. The caller checks existence. */
export function pathCandidates(p: string, cwd: string | undefined, folders: string[], home: string): string[] {
  if (p.startsWith("~/")) return [path.join(home, p.slice(2))]
  if (path.isAbsolute(p)) return [p]
  const bases = [cwd, ...folders].filter((b): b is string => Boolean(b))
  return bases.map((b) => path.resolve(b, p))
}

/** How a resolved file link should open: rendered previews for markdown and HTML, an editor otherwise. */
export function openMode(p: string): "markdown" | "browser" | "editor" {
  const ext = path.extname(p).toLowerCase()
  if (ext === ".md" || ext === ".markdown") return "markdown"
  if (ext === ".html" || ext === ".htm") return "browser"
  return "editor"
}
