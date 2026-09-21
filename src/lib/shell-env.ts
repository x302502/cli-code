import { execFile } from "node:child_process"

/**
 * The environment a CLI would get in the user's real terminal. The daemon runs commands
 * through `$SHELL -lc`, a login shell that never reads `.zshrc`/`.bashrc` — where nvm, pnpm,
 * pyenv and the CLIs' own `~/.x/bin` dirs usually land on PATH. MCP servers spawned via
 * `npx` then resolved to the wrong node and failed to start, while the same CLI worked in a
 * terminal and in Orca. Like Orca and VS Code's own terminal, ask an interactive login shell
 * (`-ilc`) for its environment once and hand that to every spawn.
 */
const START = "__CLI_CODE_ENV_START__"
const END = "__CLI_CODE_ENV_END__"
const TIMEOUT_MS = 5000
// Shell bookkeeping that must describe the spawned process, not the probe.
const SKIP = new Set(["_", "PWD", "OLDPWD", "SHLVL", "TERM", "TERM_PROGRAM", "TERM_PROGRAM_VERSION", "TERM_SESSION_ID", "ELECTRON_RUN_AS_NODE"])

/** Parses `env -0` output between the markers; undefined when the markers are missing. */
export function parseEnvBlock(output: string): Record<string, string> | undefined {
  const a = output.indexOf(START)
  const b = output.indexOf(END)
  if (a < 0 || b < 0 || b < a) return undefined
  const env: Record<string, string> = {}
  for (const entry of output.slice(a + START.length, b).split("\0")) {
    const eq = entry.indexOf("=")
    if (eq <= 0) continue
    const key = entry.slice(0, eq)
    if (SKIP.has(key)) continue
    env[key] = entry.slice(eq + 1)
  }
  return env
}

export type Exec = (file: string, args: string[], opts: { timeout: number; env: NodeJS.ProcessEnv; maxBuffer: number }) => Promise<string>

const defaultExec: Exec = (file, args, opts) =>
  new Promise((resolve, reject) => execFile(file, args, { ...opts, encoding: "utf8" }, (err, stdout) => (err ? reject(err) : resolve(stdout))))

/** Resolves the interactive login shell's environment; undefined on Windows or when the probe fails. */
export async function resolveShellEnv(shell: string | undefined = process.env.SHELL, exec: Exec = defaultExec): Promise<Record<string, string> | undefined> {
  if (process.platform === "win32") return undefined
  const sh = shell || (process.platform === "darwin" ? "/bin/zsh" : "/bin/bash")
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  try {
    const out = await exec(sh, ["-ilc", `printf '${START}'; /usr/bin/env -0; printf '${END}'`], { timeout: TIMEOUT_MS, env, maxBuffer: 4 * 1024 * 1024 })
    return parseEnvBlock(out)
  } catch {
    return undefined
  }
}

let cached: Record<string, string> | undefined
let inflight: Promise<Record<string, string> | undefined> | undefined
let resolvedAt = 0
const TTL_MS = 60_000

/**
 * Cached per window: the first spawn waits for the probe, later ones use the cached value
 * and refresh it in the background once it is older than a minute (so a PATH edit in .zshrc
 * reaches the next tab without a reload).
 */
export async function shellEnv(): Promise<Record<string, string> | undefined> {
  const refresh = () => (inflight ??= resolveShellEnv().then((env) => {
    if (env) {
      cached = env
      resolvedAt = Date.now()
    }
    inflight = undefined
    return cached
  }))
  if (cached === undefined) return refresh()
  if (Date.now() - resolvedAt > TTL_MS) void refresh()
  return cached
}
