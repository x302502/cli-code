import { describe, expect, it } from "bun:test"
import { mapHookEvent } from "../src/lib/hook-map.js"

describe("mapHookEvent", () => {
  it("ánh xạ các sự kiện Claude", () => {
    expect(mapHookEvent({ hook_event_name: "UserPromptSubmit", prompt: "sửa bug" })).toEqual({ state: "working", prompt: "sửa bug" })
    expect(mapHookEvent({ hook_event_name: "Stop" })).toEqual({ state: "done", prompt: undefined })
    expect(mapHookEvent({ hook_event_name: "Notification", message: "needs input" })).toEqual({ state: "waiting", prompt: undefined })
    expect(mapHookEvent({ hook_event_name: "PermissionRequest" })).toEqual({ state: "waiting", prompt: undefined })
  })
  it("Notification: chỉ permission_prompt/elicitation_dialog là waiting; idle_prompt/auth_success bỏ qua", () => {
    expect(mapHookEvent({ hook_event_name: "Notification", notification_type: "permission_prompt" })).toEqual({ state: "waiting", prompt: undefined })
    expect(mapHookEvent({ hook_event_name: "Notification", notification_type: "elicitation_dialog" })).toEqual({ state: "waiting", prompt: undefined })
    expect(mapHookEvent({ hook_event_name: "Notification", notification_type: "idle_prompt" })).toBeUndefined()
    expect(mapHookEvent({ hook_event_name: "Notification", notification_type: "auth_success" })).toBeUndefined()
  })
  it("bỏ qua sự kiện khác và payload hỏng", () => {
    expect(mapHookEvent({ hook_event_name: "SubagentStop" })).toBeUndefined()
    expect(mapHookEvent(null)).toBeUndefined()
    expect(mapHookEvent("x")).toBeUndefined()
  })
})
