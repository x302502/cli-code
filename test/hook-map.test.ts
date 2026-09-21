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

describe("mapHookEvent — Claude session id", () => {
  it("carries session_id so a restart can resume the same conversation", () => {
    expect(mapHookEvent({ hook_event_name: "UserPromptSubmit", prompt: "x", session_id: "abc" })).toEqual({ state: "working", prompt: "x", cliSessionId: "abc" })
    expect(mapHookEvent({ hook_event_name: "Stop", session_id: 42 })).toEqual({ state: "done", prompt: undefined })
  })
})

describe("mapHookEvent — other CLIs' spellings", () => {
  it("grok: camelCase keys, StopFailure/StopCancelled end a turn, idle_prompt/task_complete ignored", () => {
    expect(mapHookEvent({ hookEventName: "stop", hook_event_name: "Stop", sessionId: "g-1" })).toEqual({ state: "done", prompt: undefined, cliSessionId: "g-1" })
    expect(mapHookEvent({ hookEventName: "userPromptSubmit", prompt: "p", sessionId: "g-1" })).toEqual({ state: "working", prompt: "p", cliSessionId: "g-1" })
    expect(mapHookEvent({ hook_event_name: "StopFailure" })).toEqual({ state: "done", prompt: undefined })
    expect(mapHookEvent({ hook_event_name: "StopCancelled" })).toEqual({ state: "done", prompt: undefined })
    expect(mapHookEvent({ hook_event_name: "Notification", notificationType: "permission_prompt" })).toEqual({ state: "waiting", prompt: undefined })
    expect(mapHookEvent({ hook_event_name: "Notification", notificationType: "task_complete" })).toBeUndefined()
  })
  it("copilot: system notifications (agent_completed, agent_idle, shell_completed) never mean waiting", () => {
    for (const t of ["agent_completed", "agent_idle", "shell_completed"]) expect(mapHookEvent({ hook_event_name: "Notification", notification_type: t })).toBeUndefined()
  })
})
