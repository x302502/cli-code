import * as path from "node:path"

/**
 * Whether two paths name the same folder: normalised (trailing separators, `..`), and on
 * Windows case-insensitive with either separator — VS Code reports `c:\proj` where the CLIs
 * record `C:\proj`.
 */
export function samePath(a: string, b: string, platform: NodeJS.Platform = process.platform): boolean {
  if (platform === "win32") return path.win32.resolve(a).toLowerCase() === path.win32.resolve(b).toLowerCase()
  return path.posix.resolve(a) === path.posix.resolve(b)
}
