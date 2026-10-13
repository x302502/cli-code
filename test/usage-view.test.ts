import { describe, expect, it } from "bun:test"
import type { UsageSnapshot } from "../src/lib/usage/types.js"
import { chipView, formatCountdown, headline, levelOf, popoverView } from "../src/lib/usage/view.js"

const H = 3_600_000
const now = 1_800_000_000_000
const claude = (fiveUsed: number, weekUsed: number, fetchedAt = now): UsageSnapshot => ({
  fetchedAt,
  refreshable: false,
  groups: [{ provider: "Claude", active: true, accounts: [{ windows: [
    { label: "5-hour", used: fiveUsed, durationMs: 5 * H, resetsAt: now + 2 * H + 10 * 60_000 },
    { label: "Weekly", used: weekUsed, durationMs: 168 * H, resetsAt: now + 50 * H },
  ] }] }],
})

describe("levelOf / formatCountdown", () => {
  it("levels at 70% and 90%", () => {
    expect(levelOf(0.69)).toBe("ok")
    expect(levelOf(0.7)).toBe("warn")
    expect(levelOf(0.9)).toBe("err")
  })
  it("hours+minutes under a day, whole days above, minutes under an hour", () => {
    expect(formatCountdown(2 * H + 10 * 60_000)).toBe("2h10m")
    expect(formatCountdown(4 * H + 59 * 60_000 + 59_000)).toBe("4h59m")
    expect(formatCountdown(45 * 60_000)).toBe("45m")
    expect(formatCountdown(0)).toBe("0m")
    expect(formatCountdown(18 * 24 * H + 23 * H)).toBe("18d")
  })
})

describe("headline — the active group's shortest live window", () => {
  it("prefers the 5-hour window even when the weekly one is higher", () => {
    expect(headline(claude(0.23, 0.84), now)).toEqual({ used: 0.23, label: "5-hour", resetsAt: now + 2 * H + 10 * 60_000 })
  })
  it("a label like \"15 hours\" is not taken for the 5-hour window", () => {
    const s: UsageSnapshot = { fetchedAt: now, refreshable: true, groups: [{ provider: "X", active: true, accounts: [{ windows: [
      { label: "15 hours", used: 0.9 }, { label: "5 hours", used: 0.1 },
    ] }] }] }
    expect(headline(s, now)?.label).toBe("5 hours")
  })
  it("skips a window whose reset has passed", () => {
    const s = claude(0.5, 0.4)
    s.groups[0]!.accounts[0]!.windows[0]!.resetsAt = now - 1
    expect(headline(s, now)?.label).toBe("Weekly")
  })
  it("uses the group's capacity for several accounts, else the highest account", () => {
    const s: UsageSnapshot = { fetchedAt: now, refreshable: true, groups: [{
      provider: "GitHub Copilot", active: true,
      capacity: [{ label: "Monthly", used: 0.81 }],
      accounts: [
        { id: "a", windows: [{ label: "Premium Requests · Monthly", used: 0.9, resetsAt: now + 400 * H }] },
        { id: "b", windows: [{ label: "Premium Requests · Monthly", used: 0.718, resetsAt: now + 400 * H }] },
      ],
    }] }
    expect(headline(s, now)?.used).toBe(0.81)
    delete s.groups[0]!.capacity
    expect(headline(s, now)?.used).toBe(0.9)
  })
  it("no active group → nothing", () => {
    const s = claude(0.1, 0.1)
    s.groups[0]!.active = false
    expect(headline(s, now)).toBeUndefined()
  })
})

describe("chipView", () => {
  it("percent, countdown, level and tooltip", () => {
    expect(chipView(claude(0.23, 0.84), now)).toEqual({ pct: "23%", countdown: "2h10m", level: "ok", alarm: undefined, tooltip: "5-hour 23% · resets in 2h10m", stale: false })
  })
  it("an alarm when a longer window is at 90%+", () => {
    const v = chipView(claude(0.23, 0.92), now)!
    expect(v.alarm).toBe("Weekly 92%")
    expect(v.tooltip).toBe("5-hour 23% · resets in 2h10m\nWeekly 92% — close to the limit")
  })
  it("stale after 15 minutes", () => {
    expect(chipView(claude(0.2, 0.2, now - 16 * 60_000), now)!.stale).toBe(true)
  })
})

describe("popoverView", () => {
  it("active group first, rows with level and reset text, 'reset' when past", () => {
    const s = claude(0.95, 0.3)
    s.groups.unshift({ provider: "Other", active: false, accounts: [{ windows: [{ label: "Monthly", used: 0.1, resetsAt: now - 5 }] }] })
    const v = popoverView(s, now)
    expect(v.groups.map((g) => g.provider)).toEqual(["Claude", "Other"])
    expect(v.groups[0]!.accounts[0]!.rows[0]).toEqual({ label: "5-hour", used: 0.95, pct: "95%", level: "err", detail: undefined, reset: "in 2h10m" })
    expect(v.groups[1]!.accounts[0]!.rows[0]!.reset).toBe("reset")
    expect(v.updated).toBe("just now")
  })
})
