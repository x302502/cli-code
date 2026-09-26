// Source of the status plugin/extension the extension drops into a CLI's plugin directory
// (opencode/kilo/mimo plugins, pi/omp extensions). The file must be self-contained plain
// TypeScript importing nothing but node builtins, because the CLI compiles it itself.

export const MANAGED_HEADER = "// @cli-code-managed v1 — CLI Code status plugin. Safe to delete; CLI Code re-creates it."

export type PluginFlavour = "opencode" | "pi" | "omp"

const common = (from: string) => `
import { spawn } from "node:child_process"
const HOOK = process.env.CLI_CODE_HOOK
/** Pipes a Claude-shaped payload into CLI Code's hook; fire-and-forget, never throws. */
function report(payload: Record<string, unknown>): void {
  if (!HOOK) return
  try {
    // Names this CLI, so a report from another CLI started inside it is not taken for the tab's.
    const child = spawn("sh", ["-c", HOOK], { env: { ...process.env, CLI_CODE_FROM: "${from}" }, stdio: ["pipe", "ignore", "ignore"], detached: true })
    child.on("error", () => {})
    child.stdin?.on("error", () => {})
    child.stdin?.end(JSON.stringify(payload))
    child.unref()
  } catch {}
}
`

const OPENCODE = `
export default async function CliCodeStatus(input: { directory?: string; client?: any }) {
  if (!HOOK) return {}
  const cwd = input?.directory
  const text = (parts: unknown) =>
    Array.isArray(parts) ? parts.filter((p: any) => p?.type === "text" && typeof p.text === "string").map((p: any) => p.text).join("\\n") : undefined
  // Subagents run in child sessions (they have a parentID) and emit their own prompt/idle
  // events; those must not end the tab's turn or become the session the tab restarts into.
  const children = new Map<string, boolean>()
  const isChild = async (id: unknown): Promise<boolean> => {
    if (typeof id !== "string" || !input?.client?.session?.get) return false
    if (!children.has(id)) {
      try {
        const res = await input.client.session.get({ path: { id } })
        children.set(id, Boolean((res?.data ?? res)?.parentID))
      } catch {
        return false
      }
    }
    return children.get(id) === true
  }
  return {
    "chat.message": async (inp: any, out: any) => {
      if (await isChild(inp?.sessionID)) return
      report({ hook_event_name: "UserPromptSubmit", session_id: inp?.sessionID, cwd, prompt: text(out?.parts) })
    },
    "permission.ask": async (perm: any) => {
      // A subagent waiting on permission still needs the user — just not its session id.
      if (await isChild(perm?.sessionID)) report({ hook_event_name: "PermissionRequest", cwd })
      else report({ hook_event_name: "PermissionRequest", session_id: perm?.sessionID, cwd })
    },
    event: async ({ event }: any) => {
      if (event?.type !== "session.idle" || (await isChild(event?.properties?.sessionID))) return
      report({ hook_event_name: "Stop", session_id: event?.properties?.sessionID, cwd })
    },
  }
}
`

// pi and omp share the extension API; they differ in which event marks "settled" and "waiting".
const PI_OMP = (settled: string, waiting: string) => `
export default function CliCodeStatus(api: any) {
  if (!HOOK) return
  const sid = (ctx: any) => { try { return ctx?.sessionManager?.getSessionId?.() } catch { return undefined } }
  api.on("before_agent_start", async (event: any, ctx: any) => {
    report({ hook_event_name: "UserPromptSubmit", session_id: sid(ctx), cwd: ctx?.cwd, prompt: typeof event?.prompt === "string" ? event.prompt : undefined })
  })
  api.on("${settled}", async (event: any, ctx: any) => {
    if (event?.willContinue === true) return
    report({ hook_event_name: "Stop", session_id: sid(ctx), cwd: ctx?.cwd })
  })
  api.on("${waiting}", async (_event: any, ctx: any) => {
    report({ hook_event_name: "PermissionRequest", session_id: sid(ctx), cwd: ctx?.cwd })
  })
}
`

export function pluginSource(flavour: PluginFlavour, from: string): string {
  const body = flavour === "opencode" ? OPENCODE : flavour === "pi" ? PI_OMP("agent_settled", "ui_prompt_start") : PI_OMP("agent_end", "tool_approval_requested")
  return `${MANAGED_HEADER}\n${common(from)}${body}`
}

export function isManagedPlugin(text: string | undefined): boolean {
  return typeof text === "string" && text.startsWith(MANAGED_HEADER)
}
