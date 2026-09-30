import { describe, expect, it } from "bun:test"
import { mergeQuickCommands } from "../src/lib/quick-commands.js"

describe("mergeQuickCommands", () => {
  it("workspace trước global, gắn scope, bỏ mục hỏng", () => {
    const r = mergeQuickCommands([{ label: "g", text: "npm test" }, { label: 1 }], [{ label: "w", text: "bun test", submit: false }])
    expect(r).toEqual([
      { label: "w", text: "bun test", submit: false, scope: "workspace" },
      { label: "g", text: "npm test", submit: undefined, scope: "global" },
    ])
  })
  it("giá trị không phải mảng → rỗng", () => {
    expect(mergeQuickCommands("x", undefined)).toEqual([])
  })
})
