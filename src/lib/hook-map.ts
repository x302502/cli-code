import type { AgentState } from "./protocol.js"

/** Claude Code hook payload → agent state. Unknown events are ignored, never guessed. */
export function mapHookEvent(payload: unknown): { state: AgentState; prompt?: string } | undefined {
  if (!payload || typeof payload !== "object") return undefined
  const p = payload as { hook_event_name?: unknown; prompt?: unknown; notification_type?: unknown }
  const prompt = typeof p.prompt === "string" ? p.prompt : undefined
  switch (p.hook_event_name) {
    case "UserPromptSubmit":
      return { state: "working", prompt }
    case "Stop":
      return { state: "done", prompt: undefined }
    case "Notification":
      // Only notifications that actually wait on the user count; idle_prompt (60 s idle) and
      // auth_success would flip a finished tab back to "waiting". No type at all: older Claude, assume waiting.
      if (p.notification_type === undefined || p.notification_type === "permission_prompt" || p.notification_type === "elicitation_dialog") {
        return { state: "waiting", prompt: undefined }
      }
      return undefined
    case "PermissionRequest":
      return { state: "waiting", prompt: undefined }
    default:
      return undefined
  }
}
