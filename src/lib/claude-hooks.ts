import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

export const HOOK_EVENTS = ["UserPromptSubmit", "Stop", "Notification", "PermissionRequest"] as const
/** Evaluates the per-session command the extension stamps into the CLI's env; a no-op when Claude runs elsewhere. */
export const HOOK_COMMAND = '[ -n "$CLI_CODE_HOOK" ] && eval "$CLI_CODE_HOOK" || true'

type HookEntry = { type: string; command: string }
type HookGroup = { matcher?: string; hooks: HookEntry[] }
type Settings = Record<string, unknown> & { hooks?: Record<string, HookGroup[]> }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
function asSettings(value: unknown): Settings {
  return isPlainObject(value) ? structuredClone(value as Settings) : {}
}
/** `s.hooks` as a plain object, or undefined if it is missing/not a plain object (e.g. null, an
 * array, or a primitive left over from a hand-edited settings file). */
function hooksRecord(s: Settings): Record<string, unknown> | undefined {
  return isPlainObject(s.hooks) ? (s.hooks as Record<string, unknown>) : undefined
}
function groupsOf(hooks: Record<string, unknown> | undefined, event: string): HookGroup[] {
  const groups = hooks?.[event]
  return Array.isArray(groups) ? groups : []
}
function isOurs(group: HookGroup): boolean {
  return Array.isArray(group?.hooks) && group.hooks.some((h) => h?.command === HOOK_COMMAND)
}

export function hooksInstalled(value: unknown): boolean {
  const s = asSettings(value)
  return HOOK_EVENTS.every((e) => groupsOf(hooksRecord(s), e).some(isOurs))
}

export function installHooks(value: unknown): { settings: Settings; changed: boolean } {
  const s = asSettings(value)
  // A non-plain-object hooks field (null, array, primitive) is replaced, not preserved: there is
  // nothing sane to merge into.
  const hooks: Record<string, HookGroup[]> = isPlainObject(s.hooks) ? (s.hooks as Record<string, HookGroup[]>) : {}
  s.hooks = hooks
  let changed = false
  for (const e of HOOK_EVENTS) {
    const groups = groupsOf(hooks, e)
    if (!groups.some(isOurs)) {
      groups.push({ hooks: [{ type: "command", command: HOOK_COMMAND }] })
      changed = true
    }
    hooks[e] = groups
  }
  return { settings: s, changed }
}

export function uninstallHooks(value: unknown): { settings: Settings; changed: boolean } {
  const s = asSettings(value)
  const hooks = hooksRecord(s) as Record<string, HookGroup[]> | undefined
  let changed = false
  if (hooks) {
    for (const e of HOOK_EVENTS) {
      const groups = hooks[e]
      if (!Array.isArray(groups)) continue
      const kept = groups.filter((g) => !isOurs(g))
      if (kept.length !== groups.length) changed = true
      if (kept.length) hooks[e] = kept
      else delete hooks[e]
    }
    if (Object.keys(hooks).length === 0) delete s.hooks
  }
  return { settings: s, changed }
}

// --- Disk I/O (kept out of the pure functions above so tests never touch the real file). ---

export const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json")

function backupPath(file: string): string {
  return `${file}.cli-code.bak`
}

/** Reads and parses `file`. A missing or empty/whitespace-only file reads as `{}` (nothing to
 * merge into yet). Any other failure — invalid JSON, a permission error, a torn read — throws:
 * we must never treat "couldn't read this" as "empty" and go on to overwrite it. */
function readSettingsFile(file: string): unknown {
  let raw: string
  try {
    raw = fs.readFileSync(file, "utf8")
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {}
    throw new Error(`Could not read ${file}: ${String(err)}`)
  }
  if (raw.trim() === "") return {}
  try {
    return JSON.parse(raw)
  } catch (err) {
    throw new Error(`Could not read ${file}: ${String(err)}`)
  }
}

/** Backs up the file's current bytes once, before the first modification, so the user can
 * recover — copied verbatim, never re-serialised from the parsed object. */
function backupSettingsFileOnce(file: string): void {
  const bak = backupPath(file)
  if (fs.existsSync(file) && !fs.existsSync(bak)) {
    fs.copyFileSync(file, bak)
  }
}

/** Atomic write: stage to a temp file, then rename over the target, so a crash mid-write can
 * never leave a truncated settings.json. */
function writeSettingsFile(file: string, settings: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  backupSettingsFileOnce(file)
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(settings, null, 2) + "\n")
  fs.renameSync(tmp, file)
}

export function installHooksToDisk(file: string = CLAUDE_SETTINGS_PATH): boolean {
  const { settings, changed } = installHooks(readSettingsFile(file))
  if (changed) writeSettingsFile(file, settings)
  return changed
}
export function uninstallHooksFromDisk(file: string = CLAUDE_SETTINGS_PATH): boolean {
  const { settings, changed } = uninstallHooks(readSettingsFile(file))
  if (changed) writeSettingsFile(file, settings)
  return changed
}
export function hooksInstalledOnDisk(file: string = CLAUDE_SETTINGS_PATH): boolean {
  return hooksInstalled(readSettingsFile(file))
}
