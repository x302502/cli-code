import * as fs from "node:fs"
import * as path from "node:path"

/**
 * Splits the POSIX `VAR=value cmd …` prefix some tool commands carry (Claude Agent Teams,
 * Goose) into env + bare command. `sh` handles the prefix itself; PowerShell on Windows does
 * not, so there the daemon applies it to the spawn env instead.
 */
export function splitEnvPrefix(command: string): { env: Record<string, string>; command: string } {
  const env: Record<string, string> = {}
  let rest = command
  for (;;) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=(\S*)\s+/.exec(rest)
    if (!m) break
    env[m[1]!] = m[2]!
    rest = rest.slice(m[0].length)
  }
  return { env, command: rest }
}

// Shells that take `-ilc <cmd>` and run a `VAR=value cmd` prefix. nu, xonsh, elvish … do not:
// every tab would exit at once with code 1 and no output.
const POSIX_SHELLS = new Set(["sh", "bash", "zsh", "dash", "ksh", "mksh", "fish"])

/** `$SHELL` when it is one of those and still exists, else `fallback`. */
export function loginShell(shell: string | undefined, fallback: string, exists: (p: string) => boolean = fs.existsSync): string {
  return shell && POSIX_SHELLS.has(path.basename(shell)) && exists(shell) ? shell : fallback
}
