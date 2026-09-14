import type { AgentState } from "./protocol.js"

/** Claude Code hook payload → agent state. Unknown events are ignored, never guessed. */
export function mapHookEvent(payload: unknown): { state: AgentState; prompt?: string } | undefined {
  if (!payload || typeof payload !== "object") return undefined
  const p = payload as { hook_event_name?: unknown; prompt?: unknown }
  const prompt = typeof p.prompt === "string" ? p.prompt : undefined
  switch (p.hook_event_name) {
    case "UserPromptSubmit":
      return { state: "working", prompt }
    case "Stop":
      return { state: "done", prompt: undefined }
    case "Notification":
      return { state: "waiting", prompt: undefined }
    case "PermissionRequest":
      return { state: "waiting", prompt: undefined }
    default:
      return undefined
  }
}
