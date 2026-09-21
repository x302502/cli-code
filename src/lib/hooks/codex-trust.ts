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

/** Appends missing trust tables at the end of the TOML text (a table may appear anywhere). */
export function addTrust(toml: string, entries: { key: string; hash: string }[]): { text: string; changed: boolean } {
  let text = toml
  let changed = false
  for (const { key, hash } of entries) {
    if (text.includes(`[hooks.state."${key}"]`)) continue
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
  const re = /\n?\[hooks\.state\."[^"\n]*"\]\n(?:(?!\[)[^\n]+\n)*/g
  let changed = false
  const text = toml.replace(re, (m) => {
    if (!hashes.some((h) => m.includes(`trusted_hash = "${h}"`))) return m
    changed = true
    return ""
  })
  return { text, changed }
}
