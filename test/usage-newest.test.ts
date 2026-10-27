import { describe, expect, it } from "bun:test"
import { claudeSnapshot } from "../src/lib/usage/claude.js"
import { codexSnapshot } from "../src/lib/usage/codex.js"
import { newestReading } from "../src/lib/usage/newest.js"

describe("newestReading — one account reading from every tab of a CLI", () => {
  const H = 3_600_000
  const snap = (fiveHour: number, resetsAt: number, weekly?: number) =>
    claudeSnapshot({ five_hour: { used_percentage: fiveHour, resets_at: resetsAt / 1000 }, ...(weekly === undefined ? {} : { seven_day: { used_percentage: weekly, resets_at: (resetsAt + 100 * H) / 1000 } }) }, 1)!
  const windows = (s: ReturnType<typeof newestReading>) => s.groups[0]!.accounts[0]!.windows.map((w) => [w.label, Math.round(w.used * 100)])
  const now = 10 * H

  it("no reading yet → the report", () => {
    expect(newestReading(undefined, snap(30, now + 2 * H), now)).toEqual(snap(30, now + 2 * H))
  })
  it("same window: more used wins, a lower figure from an idle tab is an older reading", () => {
    expect(windows(newestReading(snap(30, now + 2 * H), snap(45, now + 2 * H), now))).toEqual([["5-hour", 45]])
    expect(windows(newestReading(snap(45, now + 2 * H), snap(0, now + 2 * H + 30_000), now))).toEqual([["5-hour", 45]])
  })
  it("an earlier window is older; a later one (after a reset) wins even at 0%", () => {
    expect(windows(newestReading(snap(45, now + 2 * H), snap(90, now + H), now))).toEqual([["5-hour", 45]])
    expect(windows(newestReading(snap(45, now + 2 * H), snap(0, now + 7 * H), now))).toEqual([["5-hour", 0]])
  })
  it("an expired window gives way to any report", () => {
    expect(windows(newestReading(snap(80, now - 1), snap(5, now - 2 * H), now))).toEqual([["5-hour", 5]])
  })
  it("Codex windows too: an idle tab's lower figure does not win", () => {
    const codex = (used: number) => codexSnapshot(JSON.stringify({ payload: { rate_limits: { primary: { used_percent: used, window_minutes: 300, resets_at: (now + H) / 1000 } } } }), 1)!
    expect(windows(newestReading(codex(60), codex(12), now))).toEqual([["5 hours", 60]])
  })
  it("windows merge one by one; one the report lacks is kept", () => {
    expect(windows(newestReading(snap(45, now + 2 * H, 20), snap(50, now + 2 * H), now))).toEqual([["5-hour", 50], ["Weekly", 20]])
    expect(windows(newestReading(snap(45, now + 2 * H, 20), snap(10, now + 2 * H, 25), now))).toEqual([["5-hour", 45], ["Weekly", 25]])
  })
})
