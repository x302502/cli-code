import type { UsageGroup, UsageSnapshot, UsageWindow } from "./types.js"

export type Level = "ok" | "warn" | "err"
const MIN = 60_000
const STALE_MS = 15 * MIN
// Windows without a duration sort by their label: 5-hour, then week, then month.
const LABEL_ORDER: [RegExp, number][] = [[/5[\s-]?h/i, 5 * 60 * MIN], [/week|7[\s-]?d/i, 7 * 24 * 60 * MIN], [/month|30[\s-]?d/i, 30 * 24 * 60 * MIN]]

export function levelOf(used: number): Level {
  return used >= 0.9 ? "err" : used >= 0.7 ? "warn" : "ok"
}

export function formatCountdown(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / MIN))
  if (minutes >= 24 * 60) return `${Math.floor(minutes / (24 * 60))}d`
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h${minutes % 60}m`
  return `${minutes}m`
}

const pct = (used: number) => `${Math.round(used * 100)}%`
const durationOf = (w: { durationMs?: number; label: string }) =>
  w.durationMs ?? LABEL_ORDER.find(([re]) => re.test(w.label))?.[1] ?? Number.MAX_SAFE_INTEGER
const live = (w: UsageWindow, now: number) => w.resetsAt === undefined || w.resetsAt > now

/** Live windows of a group merged across accounts: one per label, the highest use (or the pooled capacity). */
function groupWindows(g: UsageGroup, now: number): (UsageWindow & { duration: number })[] {
  const byLabel = new Map<string, UsageWindow & { duration: number }>()
  for (const a of g.accounts) {
    for (const w of a.windows) {
      if (!live(w, now)) continue
      const seen = byLabel.get(w.label)
      if (!seen || w.used > seen.used) byLabel.set(w.label, { ...w, duration: durationOf(w) })
    }
  }
  const windows = [...byLabel.values()]
  for (const c of g.capacity ?? []) {
    const d = durationOf(c)
    for (const w of windows) if (w.duration === d) w.used = c.used
  }
  return windows.sort((x, y) => x.duration - y.duration)
}

export function headline(s: UsageSnapshot, now: number): { used: number; label: string; resetsAt?: number } | undefined {
  const g = s.groups.find((x) => x.active)
  const w = g && groupWindows(g, now)[0]
  return w ? { used: w.used, label: w.label, resetsAt: w.resetsAt } : undefined
}

export function chipView(s: UsageSnapshot, now: number):
  { pct: string; countdown?: string; level: Level; alarm?: string; tooltip: string; stale: boolean } | undefined {
  const g = s.groups.find((x) => x.active)
  const windows = g ? groupWindows(g, now) : []
  const first = windows[0]
  if (!first) return undefined
  const countdown = first.resetsAt !== undefined ? formatCountdown(first.resetsAt - now) : undefined
  const high = windows.slice(1).find((w) => w.used >= 0.9)
  const alarm = high ? `${high.label} ${pct(high.used)}` : undefined
  const tooltip = `${first.label} ${pct(first.used)}${countdown ? ` · resets in ${countdown}` : ""}${alarm ? `\n${alarm} — close to the limit` : ""}`
  return { pct: pct(first.used), countdown, level: levelOf(first.used), alarm, tooltip, stale: now - s.fetchedAt > STALE_MS }
}

function updatedText(ms: number): string {
  if (ms < MIN) return "just now"
  if (ms < 60 * MIN) return `${Math.floor(ms / MIN)} min ago`
  return `${Math.floor(ms / (60 * MIN))} h ago`
}

export function popoverView(s: UsageSnapshot, now: number) {
  const groups = [...s.groups].sort((a, b) => Number(b.active) - Number(a.active)).map((g) => ({
    provider: g.provider,
    active: g.active,
    meta: g.meta,
    accounts: g.accounts.map((a) => ({
      id: a.id,
      rows: [...a.windows].sort((x, y) => durationOf(x) - durationOf(y)).map((w) => ({
        label: w.label,
        used: w.used,
        pct: pct(w.used),
        level: levelOf(w.used),
        detail: w.detail,
        reset: w.resetsAt === undefined ? "" : live(w, now) ? `in ${formatCountdown(w.resetsAt - now)}` : "reset",
      })),
    })),
  }))
  return { groups, updated: updatedText(now - s.fetchedAt), stale: now - s.fetchedAt > STALE_MS, refreshable: s.refreshable }
}
