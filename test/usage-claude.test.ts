import { describe, expect, it } from "bun:test"
import { claudeSnapshot } from "../src/lib/usage/claude.js"

describe("claudeSnapshot — statusLine rate_limits", () => {
  it("five_hour / seven_day → 5-hour / Weekly, seconds → ms", () => {
    expect(claudeSnapshot({ five_hour: { used_percentage: 23.5, resets_at: 1738425600 }, seven_day: { used_percentage: 41.2, resets_at: 1738857600 } }, 9)).toEqual({
      fetchedAt: 9, refreshable: false,
      groups: [{ provider: "Claude", active: true, accounts: [{ windows: [
        { label: "5-hour", used: 0.235, durationMs: 18_000_000, resetsAt: 1738425600000 },
        { label: "Weekly", used: 0.412, durationMs: 604_800_000, resetsAt: 1738857600000 },
      ] }] }],
    })
  })
  it("a spend limit becomes a third window with its dollars", () => {
    const s = claudeSnapshot({ spend_limit: { used_percentage: 62.8, resets_at: 1740787200, used_usd: 31.4, limit_usd: 50 } }, 1)!
    expect(s.groups[0]!.accounts[0]!.windows).toEqual([{ label: "Spend limit", used: 0.628, resetsAt: 1740787200000, detail: "$31.40 / $50.00" }])
  })
  it("nothing usable → undefined", () => {
    expect(claudeSnapshot(undefined, 1)).toBeUndefined()
    expect(claudeSnapshot({ five_hour: { resets_at: 1 } }, 1)).toBeUndefined()
  })
})
