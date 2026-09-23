import * as fs from "node:fs"
import { platform } from "node:os"
import * as path from "node:path"
import { shellEnv } from "./shell-env.js"

/**
 * Extracts the binary name from a launch command — skips env-var prefixes
 * (e.g. `GOOSE_MODE=auto goose`) and flags, returning the first real executable.
 */
export function extractBinary(command: string): string {
  const tokens = command.trim().split(/\s+/)
  for (const token of tokens) {
    if (token.includes("=")) continue // env-var assignment, e.g. GOOSE_MODE=auto
    return token
  }
  return tokens[0] ?? command
}

const isWindows = platform() === "win32"

/** Whether an executable of that name sits in one of the PATH directories (no process spawned). */
export function binaryOnPath(binary: string, envPath: string | undefined = process.env.PATH): boolean {
  // On Windows the name on PATH carries an extension and there is no execute bit to test.
  const suffixes = isWindows ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";") : [""]
  for (const dir of (envPath ?? "").split(path.delimiter)) {
    if (!dir) continue
    for (const suffix of suffixes) {
      try {
        fs.accessSync(path.join(dir, binary + suffix), isWindows ? fs.constants.F_OK : fs.constants.X_OK)
        return true
      } catch {
        // keep looking
      }
    }
  }
  return false
}

let cache: { time: number; results: Map<string, boolean> } | undefined
const CACHE_TTL = 60_000 // 60 seconds — binary install status rarely changes mid-session

/**
 * Detects which of the given binaries are installed, with a short-lived cache so repeated
 * picker opens don't rescan PATH on every keystroke. The PATH asked is the daemon's, not the
 * extension host's: CLIs installed through nvm (or into `~/.x/bin`) land on PATH in `.zshrc`,
 * which the host never reads, and would otherwise be offered as "not installed".
 */
export async function detectInstalled(binaries: string[]): Promise<Map<string, boolean>> {
  if (cache && Date.now() - cache.time < CACHE_TTL) {
    const cached = cache
    return new Map(binaries.map((b) => [b, cached.results.get(b) ?? false]))
  }
  const envPath = (await shellEnv())?.PATH ?? process.env.PATH
  const results = new Map(binaries.map((b) => [b, binaryOnPath(b, envPath)] as const))
  cache = { time: Date.now(), results: new Map(results) }
  return new Map(binaries.map((b) => [b, results.get(b) ?? false]))
}
