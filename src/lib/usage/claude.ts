import type { UsageSnapshot, UsageWindow } from "./types.js"

const H = 3_600_000
type Raw = { used_percentage?: unknown; resets_at?: unknown; used_usd?: unknown; limit_usd?: unknown }
const usd = (n: number) => `$${n.toFixed(2)}`

function windowOf(raw: Raw | undefined, label: string, durationMs?: number): UsageWindow | undefined {
  if (!raw || typeof raw.used_percentage !== "number") return undefined
  const w: UsageWindow = { label, used: +(raw.used_percentage / 100).toFixed(6) }
  if (durationMs) w.durationMs = durationMs
  if (typeof raw.resets_at === "number") w.resetsAt = raw.resets_at * 1000
  if (typeof raw.used_usd === "number" && typeof raw.limit_usd === "number") w.detail = `${usd(raw.used_usd)} / ${usd(raw.limit_usd)}`
  return w
}

/** Claude Code hands `rate_limits` only to its statusLine (Pro/Max, after the first reply). */
export function claudeSnapshot(rateLimits: unknown, now: number): UsageSnapshot | undefined {
  if (!rateLimits || typeof rateLimits !== "object") return undefined
  const r = rateLimits as Record<string, Raw | undefined>
  const windows = [
    windowOf(r.five_hour, "5-hour", 5 * H),
    windowOf(r.seven_day, "Weekly", 168 * H),
    windowOf(r.spend_limit, "Spend limit"),
  ].filter((w): w is UsageWindow => !!w)
  if (!windows.length) return undefined
  return { fetchedAt: now, refreshable: false, groups: [{ provider: "Claude", active: true, accounts: [{ windows }] }] }
}
