import { execFile } from "node:child_process"
import { loginShell } from "./command-env.js"

/**
 * The environment a CLI would get in the user's real terminal, asked of an interactive login
 * shell (`-ilc`) once per window. The CLIs themselves already get it — the daemon spawns them
 * through that same shell — so this is for the extension host, which reads no `.zshrc` and
 * would otherwise miss the very PATH entries the CLIs live in (nvm, pnpm, `~/.x/bin`): it is
 * what CLI detection and the status-hook sync look them up on.
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
  // The same shell the daemon runs the CLIs in (see daemon/entry.ts).
  const sh = loginShell(shell, process.platform === "darwin" ? "/bin/zsh" : "/bin/bash")
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
let probedAt = 0
const TTL_MS = 60_000

/**
 * Cached per window: the first call waits for the probe, later ones use the cached value and
 * refresh it in the background once it is older than a minute (so a PATH edit in .zshrc
 * reaches the next tab without a reload). A failed probe is remembered for that minute too —
 * with a .zshrc slower than the timeout, every hook sync and CLI check would otherwise wait out
 * the full timeout again.
 */
export async function shellEnv(probe: () => Promise<Record<string, string> | undefined> = () => resolveShellEnv()): Promise<Record<string, string> | undefined> {
  const refresh = () =>
    (inflight ??= probe().then((env) => {
      if (env) cached = env
      probedAt = Date.now()
      inflight = undefined
      return cached
    }))
  if (probedAt === 0) return refresh()
  if (Date.now() - probedAt > TTL_MS) void refresh()
  return cached
}

/** For tests: forget the cached environment and when it was probed. */
export function resetShellEnvCache(): void {
  cached = undefined
  inflight = undefined
  probedAt = 0
}
