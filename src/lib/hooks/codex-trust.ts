import { createHash } from "node:crypto"
import { HOOK_COMMAND, isOurs, type HookGroup } from "../claude-hooks.js"

/**
 * Codex only runs hooks it has been told to trust: `~/.codex/config.toml` carries one
 * `[hooks.state."<hooks.json>:<event_snake>:<group>:<index>"]` table per hook with the sha256 of
 * the hook's canonical JSON. The formula below reproduced every existing entry on a real machine.
 */
export function codexHookHash(eventSnake: string, command: string, timeout: number): string {
  const canonical = JSON.stringify({ event_name: eventSnake, hooks: [{ async: false, command, timeout, type: "command" }] })
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`
}

function snake(event: string): string {
  return event.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase()
}

/** Trust keys + hashes for our own hooks as they sit in the given hooks.json content. */
export function codexTrustKeys(hooksJsonPath: string, value: unknown): { key: string; hash: string }[] {
  const hooks = (value as { hooks?: Record<string, HookGroup[]> } | undefined)?.hooks
  if (!hooks || typeof hooks !== "object") return []
  const out: { key: string; hash: string }[] = []
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) continue
    groups.forEach((g, gi) => {
      if (!isOurs(g)) return
      g.hooks.forEach((h, hi) => {
        if (h.command !== HOOK_COMMAND) return
        out.push({ key: `${hooksJsonPath}:${snake(event)}:${gi}:${hi}`, hash: codexHookHash(snake(event), h.command, h.timeout ?? 10) })
      })
    })
  }
  return out
}

const block = (key: string, hash: string) => `[hooks.state."${key}"]\nenabled = true\ntrusted_hash = "${hash}"\n`

// One `[hooks.state."<key>"]` table: its header and the non-blank lines under it, up to the next
// header, a blank line or the end of the file (whether or not that ends in a newline). TOML
// allows whitespace before a header, so an indented `[table]` still ends ours.
const TABLE_RE = /\n?[ \t]*\[hooks\.state\."([^"\n]*)"\]\n?(?:(?![ \t]*\[)[^\n]+(?:\n|$))*/g
const hashIn = (table: string) => /trusted_hash = "([^"]*)"/.exec(table)?.[1]

/** Whether the table at `key` trusts exactly `hash`. */
export function trustedWith(toml: string, key: string, hash: string): boolean {
  for (const m of toml.matchAll(TABLE_RE)) if (m[1] === key && hashIn(m[0]) === hash) return true
  return false
}

/**
 * Makes each key trust our hash. A table already at that key but holding another hash (the
 * user's hook sat in that slot before they removed it, and ours moved in) is replaced; Codex
 * would otherwise keep treating our hook as untrusted. Missing tables are appended.
 */
export function addTrust(toml: string, entries: { key: string; hash: string }[]): { text: string; changed: boolean } {
  let text = toml
  let changed = false
  for (const { key, hash } of entries) {
    if (trustedWith(text, key, hash)) continue
    text = text.replace(TABLE_RE, (m, k: string) => (k === key ? "" : m))
    if (text.length && !text.endsWith("\n")) text += "\n"
    if (text.length && !text.endsWith("\n\n")) text += "\n"
    text += block(key, hash)
    changed = true
  }
  return { text, changed }
}

/** Removes every hooks.state table whose trusted_hash is one of ours — content-addressed, so a
 * group index that shifted after a user edit cannot orphan a block. */
export function removeTrust(toml: string, hashes: string[]): { text: string; changed: boolean } {
  let changed = false
  const text = toml.replace(TABLE_RE, (m) => {
    const h = hashIn(m)
    if (!h || !hashes.includes(h)) return m
    changed = true
    return ""
  })
  return { text: changed && text.length && !text.endsWith("\n") ? `${text}\n` : text, changed }
}

/** Trust keys of every handler that is not ours, per event, in hooks.json order. */
function userKeys(hooksJsonPath: string, value: unknown): Map<string, string[]> {
  const out = new Map<string, string[]>()
  const hooks = (value as { hooks?: Record<string, HookGroup[]> } | undefined)?.hooks
  if (!hooks || typeof hooks !== "object") return out
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) continue
    const keys: string[] = []
    groups.forEach((g, gi) => {
      if (!Array.isArray(g?.hooks)) return
      g.hooks.forEach((h, hi) => {
        if (h?.command !== HOOK_COMMAND) keys.push(`${hooksJsonPath}:${snake(event)}:${gi}:${hi}`)
      })
    })
    out.set(event, keys)
  }
  return out
}

/**
 * Removing our handlers shifts the group/handler index of the user's hooks after them, and
 * Codex looks trust up by that index — so a hook the user approved would stop running. Moves
 * each trust table from the handler's old key to its new one (removal keeps order, so the
 * user's handlers pair up one to one). All renames happen in one pass, so no chain collides.
 */
export function remapTrust(toml: string, hooksJsonPath: string, before: unknown, after: unknown): { text: string; changed: boolean } {
  const rename = new Map<string, string>()
  const was = userKeys(hooksJsonPath, before)
  const now = userKeys(hooksJsonPath, after)
  for (const [event, oldKeys] of was) {
    const newKeys = now.get(event) ?? []
    oldKeys.forEach((k, i) => {
      if (newKeys[i] && newKeys[i] !== k) rename.set(k, newKeys[i]!)
    })
  }
  if (rename.size === 0) return { text: toml, changed: false }
  let changed = false
  const text = toml.replace(/\[hooks\.state\."([^"\n]*)"\]/g, (m, key: string) => {
    const to = rename.get(key)
    if (!to) return m
    changed = true
    return `[hooks.state."${to}"]`
  })
  return { text, changed }
}
