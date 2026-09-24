import * as fs from "node:fs"
import * as path from "node:path"
import { HOOK_COMMAND, hooksInstalled, installHooks, readSettingsFile, uninstallHooks, writeFileAtomic, writeSettingsFile } from "../claude-hooks.js"
import { addTrust, codexTrustKeys, remapTrust, removeTrust } from "./codex-trust.js"
import { copilotFile, copilotInstalled } from "./copilot.js"
import { isManagedPlugin, pluginSource, type PluginFlavour } from "./plugin-template.js"

/**
 * One installer per CLI that can tell us its agent state. All of them register the same
 * `HOOK_COMMAND`, so a CLI started outside CLI Code runs a no-op. Every method takes the home
 * directory explicitly so tests never touch the real one. Disk writes back the file up once
 * (`<file>.cli-code.bak`) and are atomic.
 */
export type StatusHookInstaller = {
  id: string
  label: string
  /** Binary looked up on PATH to decide whether the CLI is present. */
  binary: string
  files(home: string): string[]
  installed(home: string): boolean
  install(home: string): boolean
  uninstall(home: string): boolean
}

// --- text files (TOML, plugins) ---

function readText(file: string): string | undefined {
  try {
    return fs.readFileSync(file, "utf8")
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined
    throw new Error(`Could not read ${file}: ${String(err)}`)
  }
}
function writeText(file: string, text: string): void {
  writeFileAtomic(file, text)
}

// --- the Claude `hooks` object inside a settings file the user also edits (claude, droid) ---

function settingsHooks(id: string, label: string, binary: string, rel: string[], events: readonly string[], timeout?: number): StatusHookInstaller {
  const file = (home: string) => path.join(home, ...rel)
  return {
    id,
    label,
    binary,
    files: (home) => [file(home)],
    installed: (home) => hooksInstalled(readSettingsFile(file(home)), events),
    install: (home) => {
      const { settings, changed } = installHooks(readSettingsFile(file(home)), events, timeout)
      if (changed) writeSettingsFile(file(home), settings)
      return changed
    },
    uninstall: (home) => {
      const { settings, changed } = uninstallHooks(readSettingsFile(file(home)), events)
      if (changed) writeSettingsFile(file(home), settings)
      return changed
    },
  }
}

// --- Codex: hooks.json plus trust entries in config.toml ---

const CODEX_EVENTS = ["UserPromptSubmit", "Stop", "PermissionRequest"] as const
/** The folder Codex reads its config from: CODEX_HOME when set (as for Codex itself), else ~/.codex. */
export function codexDir(home: string): string {
  return process.env.CODEX_HOME || path.join(home, ".codex")
}
const codex: StatusHookInstaller = {
  id: "codex",
  label: "Codex",
  binary: "codex",
  files: (home) => [path.join(codexDir(home), "hooks.json"), path.join(codexDir(home), "config.toml")],
  installed: (home) => {
    const [hooksFile, tomlFile] = codex.files(home) as [string, string]
    const value = readSettingsFile(hooksFile)
    if (!hooksInstalled(value, CODEX_EVENTS)) return false
    const toml = readText(tomlFile) ?? ""
    return codexTrustKeys(hooksFile, value).every((e) => toml.includes(`[hooks.state."${e.key}"]`))
  },
  install: (home) => {
    const [hooksFile, tomlFile] = codex.files(home) as [string, string]
    const { settings, changed } = installHooks(readSettingsFile(hooksFile), CODEX_EVENTS, 10)
    if (changed) writeSettingsFile(hooksFile, settings)
    const trust = addTrust(readText(tomlFile) ?? "", codexTrustKeys(hooksFile, settings))
    if (trust.changed) writeText(tomlFile, trust.text)
    return changed || trust.changed
  },
  uninstall: (home) => {
    const [hooksFile, tomlFile] = codex.files(home) as [string, string]
    const before = readSettingsFile(hooksFile)
    const hashes = codexTrustKeys(hooksFile, before).map((e) => e.hash)
    const { settings, changed } = uninstallHooks(before, CODEX_EVENTS)
    if (changed) writeSettingsFile(hooksFile, settings)
    const trust = removeTrust(readText(tomlFile) ?? "", hashes)
    const moved = remapTrust(trust.text, hooksFile, before, settings)
    if (trust.changed || moved.changed) writeText(tomlFile, moved.text)
    return changed || trust.changed || moved.changed
  },
}

// --- a file of our own inside a hooks directory (copilot, grok) ---

/** Every hook command in a hooks file (Claude's `command`, Copilot's `bash`), at any depth. */
function hookCommands(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(hookCommands)
  if (!value || typeof value !== "object") return []
  const o = value as Record<string, unknown>
  const own = [o.command, o.bash].filter((c): c is string => typeof c === "string")
  return [...own, ...Object.entries(o).filter(([k]) => k !== "command" && k !== "bash").flatMap(([, v]) => hookCommands(v))]
}

/** A file CLI Code wrote, possibly by an older build: it holds hook commands and all are ours. */
function managedHooksFile(value: unknown): boolean {
  const cmds = hookCommands(value)
  return cmds.length > 0 && cmds.every((c) => c === HOOK_COMMAND || c === GROK_HOOK_COMMAND)
}

function ownJsonFile(id: string, label: string, binary: string, rel: string[], content: () => unknown, isOurs: (value: unknown) => boolean): StatusHookInstaller {
  const file = (home: string) => path.join(home, ...rel)
  return {
    id,
    label,
    binary,
    files: (home) => [file(home)],
    installed: (home) => fs.existsSync(file(home)) && isOurs(readSettingsFile(file(home))),
    install: (home) => {
      if (fs.existsSync(file(home))) {
        const current = readSettingsFile(file(home))
        if (isOurs(current)) return false
        // Install runs unattended on activation: never replace hooks the user keeps under our name.
        if (!managedHooksFile(current)) throw new Error(`${file(home)} exists and is not managed by CLI Code`)
      }
      writeSettingsFile(file(home), content())
      return true
    },
    uninstall: (home) => {
      // Only a file we wrote: the user may keep their own hooks under the same name.
      if (!fs.existsSync(file(home)) || !managedHooksFile(readSettingsFile(file(home)))) return false
      fs.rmSync(file(home))
      return true
    },
  }
}

const GROK_EVENTS = ["UserPromptSubmit", "Stop", "StopFailure", "StopCancelled", "Notification"] as const
// Grok expands `$VAR` references in a hook command up front and refuses to run it when one is
// unset ("required env var(s) not set") — outside CLI Code that would print a warning on every
// prompt. Reading the variable through printenv keeps the reference out of Grok's scanner.
export const GROK_HOOK_COMMAND = '[ -n "$(printenv CLI_CODE_HOOK)" ] && eval "$(printenv CLI_CODE_HOOK)" || true'
function grokFile(): unknown {
  const hooks: Record<string, { hooks: { type: string; command: string }[] }[]> = {}
  for (const e of GROK_EVENTS) hooks[e] = [{ hooks: [{ type: "command", command: GROK_HOOK_COMMAND }] }]
  return { hooks }
}
function grokInstalled(value: unknown): boolean {
  const hooks = (value as { hooks?: Record<string, { hooks?: { command?: string }[] }[]> } | undefined)?.hooks
  return GROK_EVENTS.every((e) => Array.isArray(hooks?.[e]) && hooks![e]!.some((g) => g?.hooks?.some((h) => h?.command === GROK_HOOK_COMMAND)))
}

// --- generated plugin / extension file (opencode family, pi, omp) ---

function plugin(id: string, label: string, binary: string, rel: string[], flavour: PluginFlavour): StatusHookInstaller {
  const file = (home: string) => path.join(home, ...rel)
  return {
    id,
    label,
    binary,
    files: (home) => [file(home)],
    installed: (home) => readText(file(home)) === pluginSource(flavour),
    install: (home) => {
      const current = readText(file(home))
      if (current === pluginSource(flavour)) return false
      // Never overwrite a file the user wrote under our name.
      if (current !== undefined && !isManagedPlugin(current)) throw new Error(`${file(home)} exists and is not managed by CLI Code`)
      writeText(file(home), pluginSource(flavour))
      return true
    },
    uninstall: (home) => {
      const current = readText(file(home))
      if (current === undefined || !isManagedPlugin(current)) return false
      fs.rmSync(file(home))
      return true
    },
  }
}

export const STATUS_HOOK_INSTALLERS: readonly StatusHookInstaller[] = [
  settingsHooks("claude", "Claude Code", "claude", [".claude", "settings.json"], ["UserPromptSubmit", "Stop", "Notification", "PermissionRequest"]),
  settingsHooks("droid", "Droid", "droid", [".factory", "settings.json"], ["UserPromptSubmit", "Stop", "Notification"]),
  codex,
  ownJsonFile("copilot", "GitHub Copilot", "copilot", [".copilot", "hooks", "cli-code.json"], copilotFile, copilotInstalled),
  ownJsonFile("grok", "Grok", "grok", [".grok", "hooks", "cli-code.json"], grokFile, grokInstalled),
  plugin("opencode", "opencode", "opencode", [".config", "opencode", "plugins", "cli-code-status.ts"], "opencode"),
  plugin("kilo", "Kilo", "kilo", [".config", "kilo", "plugins", "cli-code-status.ts"], "opencode"),
  plugin("mimo", "MiMo", "mimo", [".config", "mimocode", "plugins", "cli-code-status.ts"], "opencode"),
  plugin("pi", "Pi", "pi", [".pi", "agent", "extensions", "cli-code-status.ts"], "pi"),
  plugin("omp", "OMP", "omp", [".omp", "agent", "extensions", "cli-code-status.ts"], "omp"),
]
