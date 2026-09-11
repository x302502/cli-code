import { execFile } from "node:child_process"
import { platform } from "node:os"

/**
 * Extracts the binary name from a launch command — skips env-var prefixes
 * (e.g. `GOOSE_MODE=auto goose`) and flags, returning the first real executable.
 */
export function extractBinary(command: string): string {
  const tokens = command.trim().split(/\s+/)
  for (const token of tokens) {
    if (token.includes("=")) continue // env-var assignment, e.g. GOOSE_MODE=auto
    if (token.startsWith("{")) continue // {port} placeholder
    return token
  }
  return tokens[0] ?? command
}

const isWindows = platform() === "win32"

/** Checks whether a binary is on PATH via `which` (macOS/Linux) or `where` (Windows). */
export function isBinaryInstalled(binary: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(isWindows ? "where" : "which", [binary], (error) => resolve(!error))
  })
}

let cache: { time: number; results: Map<string, boolean> } | undefined
const CACHE_TTL = 60_000 // 60 seconds — binary install status rarely changes mid-session

/**
 * Detects which of the given binaries are installed, with a short-lived cache so
 * repeated picker opens don't re-run `which` 35 times on every keystroke.
 */
export async function detectInstalled(binaries: string[]): Promise<Map<string, boolean>> {
  if (cache && Date.now() - cache.time < CACHE_TTL) {
    const cached = cache
    return new Map(binaries.map((b) => [b, cached.results.get(b) ?? false]))
  }
  const results = new Map<string, boolean>()
  await Promise.all(binaries.map(async (b) => results.set(b, await isBinaryInstalled(b))))
  cache = { time: Date.now(), results }
  return new Map(binaries.map((b) => [b, results.get(b) ?? false]))
}
