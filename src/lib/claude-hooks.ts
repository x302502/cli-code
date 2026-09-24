import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

export const HOOK_EVENTS = ["UserPromptSubmit", "Stop", "Notification", "PermissionRequest"] as const
/** Evaluates the per-session command the extension stamps into the CLI's env; a no-op when Claude runs elsewhere. */
export const HOOK_COMMAND = '[ -n "$CLI_CODE_HOOK" ] && eval "$CLI_CODE_HOOK" || true'

export type HookEntry = { type: string; command: string; timeout?: number }
export type HookGroup = { matcher?: string; hooks: HookEntry[] }
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
export function isOurs(group: HookGroup): boolean {
  return Array.isArray(group?.hooks) && group.hooks.some((h) => h?.command === HOOK_COMMAND)
}

// The Claude `hooks` shape is shared by Droid, Codex and Grok; they differ only in which events
// exist and whether a timeout is expected, hence the optional parameters.
export function hooksInstalled(value: unknown, events: readonly string[] = HOOK_EVENTS): boolean {
  const s = asSettings(value)
  return events.every((e) => groupsOf(hooksRecord(s), e).some(isOurs))
}

export function installHooks(value: unknown, events: readonly string[] = HOOK_EVENTS, timeout?: number): { settings: Settings; changed: boolean } {
  const s = asSettings(value)
  // A non-plain-object hooks field (null, array, primitive) is replaced, not preserved: there is
  // nothing sane to merge into.
  const hooks: Record<string, HookGroup[]> = isPlainObject(s.hooks) ? (s.hooks as Record<string, HookGroup[]>) : {}
  s.hooks = hooks
  let changed = false
  for (const e of events) {
    const groups = groupsOf(hooks, e)
    if (!groups.some(isOurs)) {
      // Appended, never prepended: Codex keys its trust entries by group index.
      groups.push({ hooks: [timeout === undefined ? { type: "command", command: HOOK_COMMAND } : { type: "command", command: HOOK_COMMAND, timeout }] })
      changed = true
    }
    hooks[e] = groups
  }
  return { settings: s, changed }
}

export function uninstallHooks(value: unknown, events: readonly string[] = HOOK_EVENTS): { settings: Settings; changed: boolean } {
  const s = asSettings(value)
  const hooks = hooksRecord(s) as Record<string, HookGroup[]> | undefined
  let changed = false
  if (hooks) {
    for (const e of events) {
      const groups = hooks[e]
      if (!Array.isArray(groups)) continue
      // Drop only our entries: a group may also hold the user's own hooks, which must stay.
      const kept = groups.flatMap((g) => {
        if (!isOurs(g)) return [g]
        changed = true
        const rest = g.hooks.filter((h) => h?.command !== HOOK_COMMAND)
        return rest.length ? [{ ...g, hooks: rest }] : []
      })
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
export function readSettingsFile(file: string): unknown {
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
export function backupSettingsFileOnce(file: string): void {
  const bak = backupPath(file)
  if (fs.existsSync(file) && !fs.existsSync(bak)) {
    fs.copyFileSync(file, bak)
  }
}

/** Atomic write: stage to a temp file, then rename over the target, so a crash mid-write can
 * never leave a truncated settings.json. The file keeps its permissions (config files may hold
 * tokens and are often 0600); a new file is created private. The backup copy keeps them too. */
export function writeFileAtomic(file: string, text: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  backupSettingsFileOnce(file)
  let mode = 0o600
  try {
    mode = fs.statSync(file).mode & 0o777
  } catch {
    // new file
  }
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, text, { mode })
  // writeFileSync's mode is filtered by the umask and ignored for an existing tmp file.
  fs.chmodSync(tmp, mode)
  fs.renameSync(tmp, file)
}

export function writeSettingsFile(file: string, settings: unknown): void {
  writeFileAtomic(file, JSON.stringify(settings, null, 2) + "\n")
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
