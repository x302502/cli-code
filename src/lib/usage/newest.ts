import type { UsageSnapshot, UsageWindow } from "./types.js"

// Two readings of one window carry resets_at a few seconds apart (Orca allows a minute too).
const SAME_WINDOW_MS = 60_000

/** Whether `next` is an older reading than `prev`: from an earlier window, or from the same one with less used. */
function older(prev: UsageWindow, next: UsageWindow, now: number): boolean {
  if (prev.resetsAt === undefined || next.resetsAt === undefined || prev.resetsAt <= now) return false
  if (next.resetsAt < prev.resetsAt - SAME_WINDOW_MS) return true
  return Math.abs(next.resetsAt - prev.resetsAt) <= SAME_WINDOW_MS && next.used < prev.used
}

/** Claude's and Codex's quota is per account and every tab of the CLI reports it — an idle tab its
 * last, stale figures. Window by window, keep the newest reading; one the report lacks stays as it was. */
export function newestReading(prev: UsageSnapshot | undefined, next: UsageSnapshot, now: number): UsageSnapshot {
  const before = prev?.groups[0]?.accounts[0]?.windows ?? []
  const reported = next.groups[0]!.accounts[0]!.windows
  const windows = reported.map((w) => {
    const p = before.find((b) => b.label === w.label)
    return p && older(p, w, now) ? p : w
  })
  windows.push(...before.filter((b) => !reported.some((w) => w.label === b.label)))
  return { ...next, groups: [{ ...next.groups[0]!, accounts: [{ windows }] }] }
}
