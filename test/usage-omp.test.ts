import { describe, expect, it } from "bun:test"
import { OmpUsage, ompSnapshot, providerOfModel } from "../src/lib/usage/omp.js"

const report = (provider: string, accountId: string, limits: unknown[], extra: Record<string, unknown> = {}) => ({ provider, fetchedAt: 1, limits, metadata: { accountId, ...extra } })
const limit = (label: string, windowLabel: string, usedFraction: number, resetsAt?: number, amount: Record<string, unknown> = {}) =>
  ({ label, window: { label: windowLabel, ...(resetsAt ? { resetsAt } : {}) }, amount: { usedFraction, ...amount }, status: "ok" })
const JSON_OUT = JSON.stringify({
  generatedAt: 1,
  reports: [
    report("github-copilot", "th*-*", [limit("Premium Requests", "Monthly", 0.8997, 1793491200000, { used: 26991, limit: 30000, unit: "requests" })], { plan: "business" }),
    report("github-copilot", "di*", [limit("Premium Requests", "Monthly", 0.718, 1793491200000)]),
    report("openai-codex", "th*k*", [limit("5 hours", "5 hours", 0, 1791868000000), limit("7 days", "7 days", 0)]),
    report("weird-new", "x", [limit("Daily", "Daily", 0.5)]),
  ],
  capacity: { "github-copilot": [{ window: "Monthly", accounts: 2, usedAccounts: 1.6181375, remainingAccounts: 0.38 }] },
})

describe("providerOfModel", () => {
  it("the prefix before the first slash", () => {
    expect(providerOfModel("github-copilot/claude-opus-5.5")).toBe("github-copilot")
    expect(providerOfModel("claude-opus-5.5")).toBeUndefined()
    expect(providerOfModel(undefined)).toBeUndefined()
  })
})

describe("ompSnapshot", () => {
  it("groups by provider (named), accounts by id, capacity pooled, the model's provider active and first", () => {
    const s = ompSnapshot(JSON_OUT, "github-copilot", 7)!
    expect(s.refreshable).toBe(true)
    expect(s.fetchedAt).toBe(7)
    expect(s.groups.map((g) => [g.provider, g.active])).toEqual([["GitHub Copilot", true], ["OpenAI Codex", false], ["weird-new", false]])
    const copilot = s.groups[0]!
    expect(copilot.meta).toBe("business · 2 accounts")
    expect(copilot.capacity).toEqual([{ label: "Monthly", used: 1.6181375 / 2 }])
    expect(copilot.accounts.map((a) => a.id)).toEqual(["th*-*", "di*"])
    expect(copilot.accounts[0]!.windows[0]).toEqual({ label: "Premium Requests · Monthly", used: 0.8997, resetsAt: 1793491200000, detail: "27K / 30K requests" })
  })
  it("a label equal to its window is not repeated", () => {
    expect(ompSnapshot(JSON_OUT, undefined, 1)!.groups.find((g) => g.provider === "OpenAI Codex")!.accounts[0]!.windows[0]!.label).toBe("5 hours")
  })
  it("tolerates a warning line before the JSON; garbage → undefined", () => {
    expect(ompSnapshot(`warning: something\n${JSON_OUT}\n`, undefined, 1)).toBeDefined()
    expect(ompSnapshot("not json", undefined, 1)).toBeUndefined()
    expect(ompSnapshot('{"reports":[]}', undefined, 1)).toBeUndefined()
  })
})

describe("OmpUsage — one shared run, cached 5 minutes", () => {
  it("shares an in-flight run, caches, forces, and swallows failures", async () => {
    let t = 0
    let calls = 0
    let fail = false
    const u = new OmpUsage(async (cmd, timeout) => {
      expect(cmd).toBe("omp usage --json")
      expect(timeout).toBe(15_000)
      calls++
      if (fail) throw new Error("not logged in")
      return "{}"
    }, () => t)
    expect(await Promise.all([u.get(), u.get()])).toEqual(["{}", "{}"])
    expect(calls).toBe(1)
    t = 4 * 60_000
    await u.get()
    expect(calls).toBe(1)
    await u.get(true)
    expect(calls).toBe(2)
    fail = true
    t = 10 * 60_000
    expect(await u.get()).toBeUndefined()
  })
})
