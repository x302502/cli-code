import { describe, expect, it } from "bun:test"
import { HIGH_WATER, LOW_WATER, createCoalescer, nextPauseState } from "../src/lib/flow-control.js"

describe("nextPauseState", () => {
  it("pauses when above the high water mark", () => {
    expect(nextPauseState(false, HIGH_WATER + 1)).toBe(true)
  })

  it("does not pause when exactly at the high water mark", () => {
    expect(nextPauseState(false, HIGH_WATER)).toBe(false)
  })

  it("only resumes once below the low water mark, avoiding flapping around a single threshold", () => {
    expect(nextPauseState(true, LOW_WATER)).toBe(true)
    expect(nextPauseState(true, LOW_WATER - 1)).toBe(false)
  })
})

describe("createCoalescer", () => {
  it("coalesces multiple pushes within one window into a single flush", () => {
    const flushed: Uint8Array[] = []
    let pending: (() => void) | undefined
    const coalescer = createCoalescer(16, (c) => flushed.push(c), (fn) => (pending = fn))

    coalescer.push(new Uint8Array([1]))
    coalescer.push(new Uint8Array([2, 3]))
    expect(flushed.length).toBe(0)

    pending!()
    expect(flushed.length).toBe(1)
    expect(Array.from(flushed[0]!)).toEqual([1, 2, 3])
  })

  it("does not flush when the queue is empty", () => {
    const flushed: Uint8Array[] = []
    const coalescer = createCoalescer(16, (c) => flushed.push(c), (fn) => fn())
    coalescer.flush()
    expect(flushed.length).toBe(0)
  })

  it("manual flush drains the queue immediately", () => {
    const flushed: Uint8Array[] = []
    const coalescer = createCoalescer(16, (c) => flushed.push(c), () => undefined)
    coalescer.push(new Uint8Array([9]))
    coalescer.flush()
    expect(Array.from(flushed[0]!)).toEqual([9])
  })
})
