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
  /** The agent (main or a subagent's id) whose permission dialog it is (PermissionRequest). */
  agent?: string
  /** An agent whose tool batch resolved (PostToolBatch) — approved, denied or edited alike:
   * ends "waiting" when that agent's dialog is the one waited on. */
  agentDone?: string
}

/** `from`: the CLI that ran the hook (CLI_CODE_FROM), when its hook command names it. */
export function mapHookEvent(payload: unknown, from?: string): MappedHook | undefined {
  if (!payload || typeof payload !== "object") return undefined
  const p = payload as Payload
  const mapped = mapState(p, from)
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

/** Main agent or a subagent: Claude sets agent_id only on hooks fired inside a subagent. */
const agentKey = (p: Payload) => str(p.agent_id) ?? "main"

function mapState(p: Payload, from: string | undefined): Omit<MappedHook, "cliSessionId"> | undefined {
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
      // a finished tab back to "waiting". No type at all: assume waiting only where a missing
      // type can mean a permission prompt (older Claude; Grok, unverified) — Droid and Copilot
      // always name theirs, so an untyped one from them is something else.
      const type = p.notification_type ?? p.notificationType
      const untypedWaits = from === undefined || from === "claude" || from === "grok"
      if ((type === undefined && untypedWaits) || type === "permission_prompt" || type === "elicitation_dialog") return { state: "waiting", prompt: undefined }
      return undefined
    }
    case "PermissionRequest":
      return { state: "waiting", prompt: undefined, tool: toolKey(p), agent: agentKey(p) }
    // The tool a dialog waited on finished: the only sign the dialog was answered, since no
    // hook fires for the answer itself. Any other tool (a subagent's, a background agent's
    // after Stop) says nothing about the dialog — the daemon ignores it.
    case "PostToolUse":
      return { state: "working", prompt: undefined, toolDone: toolKey(p) }
    // Every call of a batch resolved — including one the user denied or edited, which never
    // gets a matching PostToolUse — so that agent's dialog is closed.
    case "PostToolBatch":
      return { state: "working", prompt: undefined, agentDone: agentKey(p) }
    default:
      return undefined
  }
}
