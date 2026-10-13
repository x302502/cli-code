import * as fs from "node:fs"
import { tail } from "../history/files.js"
import { codexRolloutById, codexSessions } from "../history/scan.js"
import type { UsageSnapshot, UsageWindow } from "./types.js"

const TAIL_BYTES = 128 * 1024
const MIN = 60_000

type RawWindow = { used_percent?: unknown; window_minutes?: unknown; resets_at?: unknown }

function windowOf(raw: RawWindow | undefined): UsageWindow | undefined {
  if (!raw || typeof raw.used_percent !== "number") return undefined
  const minutes = typeof raw.window_minutes === "number" ? raw.window_minutes : undefined
  const label = minutes === 300 ? "5 hours" : minutes === 10080 ? "7 days" : minutes ? `${Math.round(minutes / 60)} hours` : "Limit"
  return {
    label,
    used: raw.used_percent / 100,
    ...(minutes ? { durationMs: minutes * MIN } : {}),
    ...(typeof raw.resets_at === "number" ? { resetsAt: raw.resets_at * 1000 } : {}),
  }
}

/** The newest `rate_limits` in a chunk of rollout text (Codex writes one per token_count event). */
export function codexSnapshot(text: string, now: number): UsageSnapshot | undefined {
  const lines = text.split("\n")
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i]!
    if (!l.includes('"rate_limits"')) continue
    let limits: { primary?: RawWindow; secondary?: RawWindow } | undefined
    try {
      limits = (JSON.parse(l) as { payload?: { rate_limits?: typeof limits } }).payload?.rate_limits
    } catch {
      continue // the line Codex is still writing
    }
    const windows = [windowOf(limits?.primary), windowOf(limits?.secondary)].filter((w): w is UsageWindow => !!w)
    if (!windows.length) return undefined
    return { fetchedAt: now, refreshable: false, groups: [{ provider: "OpenAI Codex", active: true, accounts: [{ windows }] }] }
  }
  return undefined
}

// Rollout file per tab (same keys as history/model.ts); bounded like its cache.
const rollouts = new Map<string, string>()

export function codexUsage(cwd: string, sinceMs: number, sessionId: string | undefined, now: number): UsageSnapshot | undefined {
  try {
    const key = sessionId ?? `${cwd}\0${sinceMs}`
    let file = rollouts.get(key)
    if (!file || !fs.existsSync(file)) {
      file = sessionId ? codexRolloutById(sessionId) : codexSessions(cwd, 1, sinceMs)[0]?.source
      if (!file) return undefined
      rollouts.set(key, file)
      if (rollouts.size > 32) rollouts.delete(rollouts.keys().next().value!)
    }
    return codexSnapshot(tail(file, TAIL_BYTES), now)
  } catch {
    return undefined
  }
}
