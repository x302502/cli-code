import { describe, expect, test } from "bun:test"
import { clickReachesProgram } from "../src/lib/mouse-gesture.js"

const plain = { moved: false, button: 0, detail: 1, altKey: false, shiftKey: false, metaKey: false, ctrlKey: false }

describe("clickReachesProgram", () => {
  test("a plain click with no travel reaches the program (Claude moves its caret)", () => {
    expect(clickReachesProgram(plain)).toBe(true)
  })
  test("a drag stays a terminal selection", () => {
    expect(clickReachesProgram({ ...plain, moved: true })).toBe(false)
  })
  test("double/triple clicks stay xterm's word/line selection", () => {
    expect(clickReachesProgram({ ...plain, detail: 2 })).toBe(false)
    expect(clickReachesProgram({ ...plain, detail: 3 })).toBe(false)
  })
  test("modified clicks are link opens or native gestures, never forwarded", () => {
    expect(clickReachesProgram({ ...plain, metaKey: true })).toBe(false)
    expect(clickReachesProgram({ ...plain, ctrlKey: true })).toBe(false)
    expect(clickReachesProgram({ ...plain, altKey: true })).toBe(false)
    expect(clickReachesProgram({ ...plain, shiftKey: true })).toBe(false)
  })
  test("only the left button", () => {
    expect(clickReachesProgram({ ...plain, button: 2 })).toBe(false)
  })
})
