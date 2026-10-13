import { describe, expect, it } from "bun:test"
import { codexSnapshot } from "../src/lib/usage/codex.js"

const line = (primary: number, secondary: number) =>
  JSON.stringify({ type: "event_msg", payload: { type: "token_count", rate_limits: {
    limit_id: "codex", primary: { used_percent: primary, window_minutes: 300, resets_at: 1791786885 },
    secondary: { used_percent: secondary, window_minutes: 10080, resets_at: 1792373685 },
  } } })

describe("codexSnapshot — last rate_limits in the rollout tail", () => {
  it("maps primary/secondary to 5 hours / 7 days, the newest line wins", () => {
    const s = codexSnapshot(`${line(10, 1)}\n{"type":"x"}\n${line(12, 4)}\n`, 5)!
    expect(s.refreshable).toBe(false)
    expect(s.fetchedAt).toBe(5)
    expect(s.groups).toEqual([{ provider: "OpenAI Codex", active: true, accounts: [{ windows: [
      { label: "5 hours", used: 0.12, durationMs: 300 * 60_000, resetsAt: 1791786885000 },
      { label: "7 days", used: 0.04, durationMs: 10080 * 60_000, resetsAt: 1792373685000 },
    ] }] }])
  })
  it("a half-written last line or no rate_limits → the previous one / undefined", () => {
    expect(codexSnapshot(`${line(30, 2)}\n{"type":"event_msg","payload":{"rate_limits":{"prim`, 1)!.groups[0]!.accounts[0]!.windows[0]!.used).toBe(0.3)
    expect(codexSnapshot('{"type":"x"}\n', 1)).toBeUndefined()
  })
  it("a window without used_percent is skipped", () => {
    const text = JSON.stringify({ payload: { rate_limits: { primary: { window_minutes: 300 }, secondary: { used_percent: 50, window_minutes: 10080 } } } })
    expect(codexSnapshot(text, 1)!.groups[0]!.accounts[0]!.windows.map((w) => w.label)).toEqual(["7 days"])
  })
})
