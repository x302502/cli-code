import { describe, expect, it } from "bun:test"
import { mapHookEvent } from "../src/lib/hook-map.js"

describe("mapHookEvent", () => {
  it("ánh xạ các sự kiện Claude", () => {
    expect(mapHookEvent({ hook_event_name: "UserPromptSubmit", prompt: "sửa bug" })).toEqual({ state: "working", prompt: "sửa bug" })
    expect(mapHookEvent({ hook_event_name: "Stop" })).toEqual({ state: "done", prompt: undefined })
    expect(mapHookEvent({ hook_event_name: "Notification", message: "needs input" })).toEqual({ state: "waiting", prompt: undefined })
    expect(mapHookEvent({ hook_event_name: "PermissionRequest" })).toEqual({ state: "waiting", prompt: undefined })
  })
  it("bỏ qua sự kiện khác và payload hỏng", () => {
    expect(mapHookEvent({ hook_event_name: "SubagentStop" })).toBeUndefined()
    expect(mapHookEvent(null)).toBeUndefined()
    expect(mapHookEvent("x")).toBeUndefined()
  })
})
