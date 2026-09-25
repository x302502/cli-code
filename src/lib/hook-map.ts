import { createHash } from "node:crypto"
import type { AgentState } from "./protocol.js"

type Payload = Record<string, unknown>

/**
 * Hook payload → agent state. The Claude Code shape is the lingua franca: Droid, Codex and
 * Copilot emit it, Grok adds camelCase twins, and the plugins we generate for opencode/pi/omp
 * build it by hand. Unknown events are ignored, never guessed.
 */
export type MappedHook = {
  state: AgentState
  prompt?: string
  cliSessionId?: string
  /** The tool a permission dialog waits on (PermissionRequest). */
  tool?: string
  /** A tool that finished (PostToolUse): ends "waiting" only when it is the tool waited on. */
  toolDone?: string
}

export function mapHookEvent(payload: unknown): MappedHook | undefined {
  if (!payload || typeof payload !== "object") return undefined
  const p = payload as Payload
  const mapped = mapState(p)
  if (!mapped) return undefined
  // The CLI's own session id lets a restarted tab resume the same conversation.
  const id = str(p.session_id) ?? str(p.sessionId)
  return id ? { ...mapped, cliSessionId: id } : mapped
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined
}

// Grok spells the event twice ("hookEventName":"stop" and "hook_event_name":"Stop"); normalise
// to Claude's PascalCase so one switch covers both.
function eventName(p: Payload): string | undefined {
  const raw = str(p.hook_event_name) ?? str(p.hookEventName)
  return raw ? raw[0]!.toUpperCase() + raw.slice(1) : undefined
}

/** Tool name + input, hashed: the same call is named alike in PermissionRequest and PostToolUse. */
function toolKey(p: Payload): string {
  const name = str(p.tool_name) ?? ""
  return createHash("sha1").update(`${name}\0${JSON.stringify(p.tool_input ?? null)}`).digest("hex").slice(0, 16)
}

function mapState(p: Payload): Omit<MappedHook, "cliSessionId"> | undefined {
  const prompt = str(p.prompt)
  switch (eventName(p)) {
    case "UserPromptSubmit":
      return { state: "working", prompt }
    case "Stop":
    case "StopFailure":
    case "StopCancelled":
      return { state: "done", prompt: undefined }
    case "Notification": {
      // Only notifications that actually wait on the user count. idle_prompt, auth_success,
      // task_complete, Copilot's agent_completed/agent_idle/shell_completed would otherwise flip
      // a finished tab back to "waiting". No type at all: older Claude, assume waiting.
      const type = p.notification_type ?? p.notificationType
      if (type === undefined || type === "permission_prompt" || type === "elicitation_dialog") return { state: "waiting", prompt: undefined }
      return undefined
    }
    case "PermissionRequest":
      return { state: "waiting", prompt: undefined, tool: toolKey(p) }
    // The tool a dialog waited on finished: the only sign the dialog was answered, since no
    // hook fires for the answer itself. Any other tool (a subagent's, a background agent's
    // after Stop) says nothing about the dialog — the daemon ignores it.
    case "PostToolUse":
      return { state: "working", prompt: undefined, toolDone: toolKey(p) }
    default:
      return undefined
  }
}
