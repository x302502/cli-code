import * as path from "node:path"
import { samePath } from "./same-path.js"

export { findPathTokens, parsePathLink } from "./path-link.js"

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

/** An editor tab as far as a file link cares: the file it shows, and how. */
export type OpenTabRef = { kind: "text" | "markdownPreview" | "other"; path?: string; group: number; active: boolean }

/** The tab already showing `target` the way a click opens it (a markdown file as its preview, any
 * other file as text), so the click goes there instead of opening another tab, as Orca does. Of
 * several, the one in front in its group. */
export function findOpenTab<T extends OpenTabRef>(tabs: T[], target: string, mode: "markdown" | "editor"): T | undefined {
  const kind = mode === "markdown" ? "markdownPreview" : "text"
  const matches = tabs.filter((t) => t.kind === kind && t.path !== undefined && samePath(t.path, target))
  return matches.find((t) => t.active) ?? matches[0]
}

export type LinkTarget = { path: string; kind: "file" | "dir"; line?: number; col?: number }

/** First candidate that exists on disk (file or directory), keeping the parsed line/col. */
export function resolveLinkTarget(
  parsed: { path: string; line?: number; col?: number },
  cwd: string | undefined,
  folders: string[],
  home: string,
  stat: (p: string) => "file" | "dir" | undefined,
): LinkTarget | undefined {
  for (const candidate of pathCandidates(parsed.path, cwd, folders, home)) {
    const kind = stat(candidate)
    if (!kind) continue
    const out: LinkTarget = { path: candidate, kind }
    if (parsed.line !== undefined) out.line = parsed.line
    if (parsed.col !== undefined) out.col = parsed.col
    return out
  }
  return undefined
}

/** Whether `p` lies inside one of the workspace folders (a folder counts as inside itself). */
export function insideFolders(p: string, folders: string[]): boolean {
  const target = path.resolve(p)
  return folders.some((f) => {
    const rel = path.relative(path.resolve(f), target)
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))
  })
}
