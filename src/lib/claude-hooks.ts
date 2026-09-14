import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

export const HOOK_EVENTS = ["UserPromptSubmit", "Stop", "Notification", "PermissionRequest"] as const
/** Evaluates the per-session command the extension stamps into the CLI's env; a no-op when Claude runs elsewhere. */
export const HOOK_COMMAND = '[ -n "$CLI_CODE_HOOK" ] && eval "$CLI_CODE_HOOK" || true'

type HookEntry = { type: string; command: string }
type HookGroup = { matcher?: string; hooks: HookEntry[] }
type Settings = Record<string, unknown> & { hooks?: Record<string, HookGroup[]> }

function asSettings(value: unknown): Settings {
  return value && typeof value === "object" && !Array.isArray(value) ? structuredClone(value as Settings) : {}
}
function groupsOf(hooks: Record<string, unknown> | undefined, event: string): HookGroup[] {
  const groups = hooks?.[event]
  return Array.isArray(groups) ? groups : []
}
function isOurs(group: HookGroup): boolean {
  return Array.isArray(group.hooks) && group.hooks.some((h) => h?.command === HOOK_COMMAND)
}

export function hooksInstalled(value: unknown): boolean {
  const s = asSettings(value)
  return HOOK_EVENTS.every((e) => groupsOf(s.hooks, e).some(isOurs))
}

export function installHooks(value: unknown): { settings: Settings; changed: boolean } {
  const s = asSettings(value)
  s.hooks = s.hooks ?? {}
  let changed = false
  for (const e of HOOK_EVENTS) {
    const groups = groupsOf(s.hooks, e)
    if (!groups.some(isOurs)) {
      groups.push({ hooks: [{ type: "command", command: HOOK_COMMAND }] })
      changed = true
    }
    s.hooks[e] = groups
  }
  return { settings: s, changed }
}

export function uninstallHooks(value: unknown): { settings: Settings; changed: boolean } {
  const s = asSettings(value)
  let changed = false
  for (const e of HOOK_EVENTS) {
    const groups = s.hooks?.[e]
    if (!Array.isArray(groups)) continue
    const kept = groups.filter((g) => !isOurs(g))
    if (kept.length !== groups.length) changed = true
    if (kept.length) s.hooks![e] = kept
    else delete s.hooks![e]
  }
  if (s.hooks && Object.keys(s.hooks).length === 0) delete s.hooks
  return { settings: s, changed }
}

// --- Disk I/O (kept out of the pure functions above so tests never touch the real file). ---

export const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json")
const BACKUP_PATH = `${CLAUDE_SETTINGS_PATH}.cli-code.bak`

function readSettingsFile(): unknown {
  try {
    return JSON.parse(fs.readFileSync(CLAUDE_SETTINGS_PATH, "utf8"))
  } catch {
    return {}
  }
}
/** Backs up the user's current settings once, before the first modification, so they can recover. */
function backupSettingsFileOnce(): void {
  if (fs.existsSync(CLAUDE_SETTINGS_PATH) && !fs.existsSync(BACKUP_PATH)) {
    fs.copyFileSync(CLAUDE_SETTINGS_PATH, BACKUP_PATH)
  }
}
function writeSettingsFile(settings: unknown): void {
  fs.mkdirSync(path.dirname(CLAUDE_SETTINGS_PATH), { recursive: true })
  backupSettingsFileOnce()
  fs.writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n")
}
export function installHooksToDisk(): boolean {
  const { settings, changed } = installHooks(readSettingsFile())
  if (changed) writeSettingsFile(settings)
  return changed
}
export function uninstallHooksFromDisk(): boolean {
  const { settings, changed } = uninstallHooks(readSettingsFile())
  if (changed) writeSettingsFile(settings)
  return changed
}
export function hooksInstalledOnDisk(): boolean {
  return hooksInstalled(readSettingsFile())
}
