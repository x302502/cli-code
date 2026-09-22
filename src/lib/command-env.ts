/**
 * Splits the POSIX `VAR=value cmd …` prefix some tool commands carry (Claude Agent Teams,
 * Goose) into env + bare command. `sh` handles the prefix itself; PowerShell on Windows does
 * not, so the daemon applies it to the spawn env on every platform instead.
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
