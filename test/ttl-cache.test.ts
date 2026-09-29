import { describe, expect, it } from "bun:test"
import { pruneExpired } from "../src/lib/ttl-cache.js"

describe("pruneExpired", () => {
  it("drops expired entries once the map outgrows its cap, keeps the fresh ones", () => {
    const m = new Map<string, { at: number }>()
    for (let i = 0; i < 10; i++) m.set(`old-${i}`, { at: 0 })
    for (let i = 0; i < 3; i++) m.set(`new-${i}`, { at: 9_000 })
    pruneExpired(m, 10_000, 5_000, 20) // under the cap: nothing happens
    expect(m.size).toBe(13)
    pruneExpired(m, 10_000, 5_000, 10)
    expect([...m.keys()]).toEqual(["new-0", "new-1", "new-2"])
  })
  it("still bounded when every entry is fresh: the oldest go first", () => {
    const m = new Map<string, { at: number }>()
    for (let i = 0; i < 30; i++) m.set(`k-${i}`, { at: 9_000 })
    pruneExpired(m, 10_000, 5_000, 10)
    expect(m.size).toBe(10)
    expect(m.has("k-29")).toBe(true)
    expect(m.has("k-0")).toBe(false)
  })
})
