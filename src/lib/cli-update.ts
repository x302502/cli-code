import { execFile } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import type { CliTool } from "./config.js"
import { extractBinary } from "./detect.js"
import { loginShell, shellQuote } from "./command-env.js"

export type UpdateOptions = { versionCommand?: string; latestVersionCommand?: string; updateCommand?: string }
export type UpdateNotice = {
  kind: "current" | "available" | "installed" | "updating" | "error"
  version?: string
  canUpdate?: boolean
  error?: string
}
/** `fallbackCommand`: what to try when a CLI's own `updateCommand` fails (e.g. droid refuses npm installs). */
type Profile = { latestUrl?: string; updateCommand?: string; fallbackCommand?: string }
type Dependencies = {
  run(command: string, tool: CliTool, timeoutMs: number): Promise<string>
  profile(tool: CliTool): Promise<Profile | undefined>
  json(url: string): Promise<unknown>
}

/** CLI output, registry versions and release tags all go through the same parser. */
export function parseVersion(output: string): string | undefined {
  return /(?:^|[^\w])v?(\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?)/.exec(
    output.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, ""),
  )?.[1]
}

export function isNewerVersion(candidate: string, current: string): boolean {
  const parts = (v: string) => v.split("+")[0]!.split(/-(.*)/s)
  const [a, preA] = parts(candidate)
  const [b, preB] = parts(current)
  const numsA = a!.split(".").map(Number),
    numsB = b!.split(".").map(Number)
  for (let i = 0; i < 3; i++) if (numsA[i] !== numsB[i]) return numsA[i]! > numsB[i]!
  if (preA === preB) return false
  if (!preA) return true
  if (!preB) return false
  const idsA = preA.split("."),
    idsB = preB.split(".")
  for (let i = 0; i < Math.max(idsA.length, idsB.length); i++) {
    const x = idsA[i],
      y = idsB[i]
    if (x === y) continue
    if (x === undefined) return false
    if (y === undefined) return true
    const nx = /^\d+$/.test(x),
      ny = /^\d+$/.test(y)
    return nx && ny ? Number(x) > Number(y) : nx !== ny ? !nx : x > y
  }
  return false
}

function differentBuildOnSameDate(a: string, b: string): boolean {
  const date = (version: string) => /^(\d{4}\.\d{2}\.\d{2})-/.exec(version)?.[1]
  return a !== b && date(a) !== undefined && date(a) === date(b)
}

const quote = (word: string) => (process.platform === "win32" ? `'${word.replace(/'/g, "''")}'` : shellQuote(word))

/** Read the installation that owns the executable, rather than guessing a package by CLI name. */
export function installationProfile(binary: string, executable: string): Profile | undefined {
  let shimPrefix: string | undefined
  if (/\.(cmd|ps1)$/i.test(executable)) {
    try {
      const target = /node_modules[\\/][^"'\r\n]+/.exec(fs.readFileSync(executable, "utf8"))?.[0]
      if (target) {
        shimPrefix = path.dirname(executable)
        executable = path.join(shimPrefix, target.replace(/[\\/]/g, path.sep))
      }
    } catch {
      /* Not a readable npm launcher. */
    }
  }
  const normalized = executable.replace(/\\/g, "/")
  const brew = /\/(Cellar|Caskroom)\/([^/]+)\//.exec(normalized)
  if (brew) {
    const kind = brew[1] === "Caskroom" ? "cask" : "formula"
    return {
      latestUrl: `https://formulae.brew.sh/api/${kind}/${encodeURIComponent(brew[2]!)}.json`,
      updateCommand: `brew upgrade ${kind === "cask" ? "--cask " : ""}${quote(brew[2]!)}`,
    }
  }
  let dir = path.dirname(executable)
  for (let depth = 0; depth < 6; depth++) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")) as {
        name?: string
        bin?: string | Record<string, string>
      }
      const bin = typeof pkg.bin === "string" ? pkg.name?.split("/").pop() === binary : pkg.bin?.[binary]
      if (pkg.name && bin && /^(@[\w.-]+\/)?[\w.-]+$/.test(pkg.name)) {
        const globalPrefix = shimPrefix ?? /^(.*)\/lib\/node_modules\//.exec(dir.replace(/\\/g, "/"))?.[1]
        const pnpm = /\/pnpm\/global\//.test(normalized)
        const yarn = /\/yarn\/global\//.test(normalized)
        const bun = /\/\.bun\/install\/global\//.test(normalized)
        return {
          latestUrl: `https://registry.npmjs.org/${encodeURIComponent(pkg.name)}/latest`,
          updateCommand: pnpm
            ? `pnpm add -g ${quote(`${pkg.name}@latest`)}`
            : yarn
              ? `yarn global add ${quote(`${pkg.name}@latest`)}`
              : bun
                ? `bun add -g ${quote(`${pkg.name}@latest`)}`
                : globalPrefix
                  ? `npm install -g --prefix ${quote(globalPrefix)} ${quote(`${pkg.name}@latest`)}`
                  : undefined,
        }
      }
    } catch {
      /* Not a Node package; try its parent. */
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  // uv and pipx keep console scripts inside their tool's own virtual environment.
  // Do not upgrade an arbitrary project virtualenv or the system Python installation.
  const python = /\/(uv\/tools|pipx\/venvs)\/([^/]+)\/bin\//.exec(normalized)
  if (python) {
    const name = python[2]!
    return {
      latestUrl: `https://pypi.org/pypi/${encodeURIComponent(name)}/json`,
      updateCommand: `${python[1] === "uv/tools" ? "uv tool" : "pipx"} upgrade ${quote(name)}`,
    }
  }
  return undefined
}

const runCommand: Dependencies["run"] = (command, tool, timeoutMs) =>
  new Promise((resolve, reject) => {
    const windows = process.platform === "win32"
    const shell = windows
      ? "powershell.exe"
      : loginShell(process.env.SHELL, process.platform === "darwin" ? "/bin/zsh" : "/bin/bash")
    const args = windows
      ? [
          "-NoLogo",
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `${command}; if ($LASTEXITCODE) { exit $LASTEXITCODE }`,
        ]
      : ["-ilc", command]
    const env = { ...process.env, ...tool.extraEnv }
    delete env.ELECTRON_RUN_AS_NODE
    execFile(
      shell,
      args,
      { env, cwd: os.homedir(), timeout: timeoutMs, maxBuffer: 2 * 1024 * 1024, windowsHide: true },
      (err, stdout, stderr) => {
        if (err) {
          const detail = stderr.trim().slice(-1000)
          if ((err as { killed?: boolean }).killed)
            reject(new Error(`Timed out after ${Math.round(timeoutMs / 1000)}s${detail ? `: ${detail}` : ""}`))
          else reject(new Error(detail || stdout.trim().slice(-1000) || err.message))
        } else resolve(stdout || stderr)
      },
    )
  })

/**
 * Each CLI's own update command, read from its `update --help`. It knows how it was installed
 * (npm, Homebrew, a native binary, …), which a guess from the executable's path cannot. Only
 * the package-manager command inferred from the installation is left for CLIs not listed here.
 */
const SELF_UPDATE: Record<string, string> = {
  claude: "claude update",
  codex: "codex update",
  grok: "grok update",
  copilot: "copilot update",
  opencode: "opencode upgrade",
  mimo: "mimo upgrade",
  kilo: "kilo upgrade",
  omp: "omp update",
  agy: "agy update",
  amp: "amp update",
  cline: "cline update",
  "command-code": "command-code update",
  droid: "droid update",
  "cursor-agent": "cursor-agent update",
  // Bare `pi update` also refreshes extensions and model catalogs.
  pi: "pi update --self",
}

/** The CLI's own update command replaces the one inferred from its installation, which stays
 * as the fallback: some CLIs refuse to update an installation type, or cannot reach the network. */
export function withSelfUpdate(binary: string, profile: Profile | undefined): Profile | undefined {
  const updateCommand = SELF_UPDATE[binary]
  if (!updateCommand) return profile
  return { ...profile, updateCommand, fallbackCommand: profile?.updateCommand }
}

async function detectProfile(tool: CliTool): Promise<Profile | undefined> {
  const binary = extractBinary(tool.command)
  if (!/^[\w.-]+$/.test(binary)) return undefined
  try {
    const resolved = (
      await runCommand(
        process.platform === "win32"
          ? `(Get-Command ${quote(binary)} -ErrorAction Stop).Source`
          : `command -v ${quote(binary)}`,
        tool,
        8_000,
      )
    )
      .trim()
      .split("\n")
      .pop()!
    const executable = fs.realpathSync(resolved)
    const installation = installationProfile(binary, executable)
    if (installation) return installation
    // Native updaters own their installation method and do not install a second copy.
    if (binary === "claude") {
      let channel = "latest"
      try {
        const settings = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".claude/settings.json"), "utf8"))
        if (settings.autoUpdatesChannel === "stable") channel = "stable"
      } catch {
        /* Default release channel. */
      }
      return {
        latestUrl: `https://registry.npmjs.org/%40anthropic-ai%2Fclaude-code/${channel}`,
        updateCommand: "claude update",
      }
    }
    if (binary === "opencode")
      return {
        latestUrl: "https://api.github.com/repos/anomalyco/opencode/releases/latest",
        updateCommand: "opencode upgrade",
      }
    if (binary === "cursor-agent")
      return { latestUrl: "https://cursor.com/install", updateCommand: "cursor-agent update" }
  } catch {
    /* Missing executable or custom launcher: still allow version checks. */
  }
  return undefined
}

const defaults: Dependencies = {
  run: runCommand,
  async json(url) {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
      headers: { "User-Agent": "cli-code", Accept: "application/json" },
    })
    if (!response.ok) throw new Error(`Version check failed (${response.status})`)
    return response.headers.get("content-type")?.includes("json") ? response.json() : response.text()
  },
  async profile(tool) {
    return withSelfUpdate(extractBinary(tool.command), await detectProfile(tool))
  },
}

/** Per-window cache and install lock, shared by tabs and variants of the same executable. */
export class CliUpdates {
  private cache = new Map<string, { at: number; value: Promise<unknown> }>()
  private installs = new Map<string, Promise<string>>()
  constructor(private deps: Dependencies = defaults) {}

  private key(tool: CliTool, options: UpdateOptions): string {
    return JSON.stringify([extractBinary(tool.command), tool.extraEnv, options])
  }
  /** `failedTtl`: how long a failed read is kept; without it a failure is dropped at once. */
  private cached<T>(key: string, ttl: number, read: () => Promise<T>, failedTtl?: number): Promise<T> {
    const old = this.cache.get(key)
    if (old && Date.now() - old.at < ttl) return old.value as Promise<T>
    const value = read()
    const entry = { at: Date.now(), value }
    this.cache.set(key, entry)
    // A failed read must not hide the result for the whole TTL.
    value.catch(() => {
      if (this.cache.get(key) !== entry) return
      if (failedTtl === undefined) this.cache.delete(key)
      else entry.at = Date.now() - ttl + failedTtl
    })
    return value
  }
  async version(tool: CliTool, options: UpdateOptions = {}, fresh = false): Promise<string | undefined> {
    const key = `${this.key(tool, options)}:version`
    if (fresh) this.cache.delete(key)
    return this.cached(key, 30_000, async () => {
      const binary = extractBinary(tool.command)
      if (!options.versionCommand && !/^[\w.-]+$/.test(binary)) return undefined
      try {
        return parseVersion(await this.deps.run(options.versionCommand ?? `${binary} --version`, tool, 8_000))
      } catch {
        return undefined
      }
    })
  }
  private async profile(tool: CliTool, options: UpdateOptions): Promise<Profile> {
    const detected = await this.cached(`${this.key(tool, options)}:profile`, 30_000, () =>
      this.deps.profile(tool).catch(() => undefined),
    )
    // A command the user configured is theirs alone: no second guess.
    if (options.updateCommand) return { ...detected, updateCommand: options.updateCommand, fallbackCommand: undefined }
    return detected ?? {}
  }
  async check(
    tool: CliTool,
    running: string | undefined,
    options: UpdateOptions = {},
    fresh = false,
  ): Promise<UpdateNotice> {
    const installed = await this.version(tool, options, fresh)
    if (!installed) return { kind: "current" }
    const profile = await this.profile(tool, options)
    // A replaced build needs a restart even if its date is unchanged or the user rolled back.
    if (running && installed !== running) return { kind: "installed", version: installed, canUpdate: true }
    const latest = await this.cached(`${this.key(tool, options)}:latest`, 30 * 60_000, async () => {
      if (options.latestVersionCommand)
        return parseVersion(await this.deps.run(options.latestVersionCommand, tool, 8_000))
      if (!profile.latestUrl) return undefined
      const data = (await this.deps.json(profile.latestUrl)) as
        | string
        | { version?: string; tag_name?: string; info?: { version?: string }; versions?: { stable?: string } }
      // Cursor publishes its current release in the install script's download URL.
      // Read the version only; never execute remotely fetched code during a check.
      if (typeof data === "string")
        return parseVersion(/downloads\.cursor\.com\/lab\/([^/]+)\//.exec(data)?.[1] ?? data)
      return parseVersion(data.version ?? data.tag_name ?? data.info?.version ?? data.versions?.stable ?? "")
    }, 5 * 60_000).catch(() => undefined)
    return latest && (differentBuildOnSameDate(latest, installed) || isNewerVersion(latest, installed))
      ? { kind: "available", version: latest, canUpdate: !!profile.updateCommand }
      : { kind: "current" }
  }
  /**
   * Bun (omp, and the bun-built CLIs) tries only the IPv6 addresses of a host and waits out the
   * timeout when that route is broken, though IPv4 works. After a timeout ("Timed out after Ns",
   * or the CLI's own "timed out" message), the same command is
   * run once more with bun limited to IPv4 — only for this process, nothing else changes.
   */
  private async runUpdate(command: string, tool: CliTool, timeoutMs: number): Promise<string> {
    try {
      return await this.deps.run(command, tool, timeoutMs)
    } catch (err) {
      if (!/timed out/i.test((err as Error).message)) throw err
      return this.deps.run(command, { ...tool, extraEnv: { ...tool.extraEnv, BUN_FEATURE_FLAG_DISABLE_IPV6: "1" } }, timeoutMs)
    }
  }
  async install(tool: CliTool, target: string, options: UpdateOptions = {}): Promise<string> {
    const key = this.key(tool, options)
    const existing = this.installs.get(key)
    if (existing) return existing
    const install = (async () => {
      const profile = await this.profile(tool, options)
      if (!profile.updateCommand)
        throw new Error("Configure cliCode.cliUpdates for this installation's update command.")
      const commands = [profile.updateCommand]
      if (profile.fallbackCommand && profile.fallbackCommand !== profile.updateCommand)
        commands.push(profile.fallbackCommand)
      const failures: string[] = []
      let installed: string | undefined
      for (const command of commands) {
        try {
          await this.runUpdate(command, tool, 5 * 60_000)
          installed = await this.version(tool, options, true)
          // Hashes do not order Cursor builds: on the same date only the exact target verifies it.
          const sameRelease = installed?.split("+")[0] === target.split("+")[0]
          if (
            installed &&
            (sameRelease || (!differentBuildOnSameDate(installed, target) && isNewerVersion(installed, target)))
          )
            break
          failures.push(
            `The CLI still reports ${installed ?? "an unknown version"}; expected ${target}. The session was kept running.`,
          )
        } catch (err) {
          failures.push((err as Error).message)
        }
        installed = undefined
      }
      if (!installed) {
        const [first, second] = failures
        throw new Error(second === undefined ? first! : `${first}\nThen ${commands[1]} failed: ${second}`)
      }
      this.cache.delete(`${key}:latest`)
      return installed
    })()
    this.installs.set(key, install)
    try {
      return await install
    } finally {
      this.installs.delete(key)
    }
  }
}

export const cliUpdates = new CliUpdates()
