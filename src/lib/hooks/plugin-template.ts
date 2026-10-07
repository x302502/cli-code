// Source of the status plugin/extension the extension drops into a CLI's plugin directory
// (opencode/kilo/mimo plugins, pi/omp extensions). The file must be self-contained plain
// TypeScript importing nothing but node builtins, because the CLI compiles it itself.

export const MANAGED_HEADER = "// @cli-code-managed v1 — CLI Code status plugin. Safe to delete; CLI Code re-creates it."

export type PluginFlavour = "opencode" | "pi" | "omp"

const common = (from: string, serialize: boolean) => `
import { spawn } from "node:child_process"
const HOOK = process.env.CLI_CODE_HOOK
${serialize ? "let reports = Promise.resolve()" : ""}
/** Pipes a Claude-shaped payload into CLI Code's hook; fire-and-forget, never throws. */
function report(payload: Record<string, unknown>): void {
  ${serialize ? "reports = reports.then(() => deliver(payload))" : "void deliver(payload)"}
}
function deliver(payload: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => {
    if (!HOOK) { resolve(); return }
    try {
    // Names this CLI, so a report from another CLI started inside it is not taken for the tab's.
    const child = spawn("sh", ["-c", HOOK], { env: { ...process.env, CLI_CODE_FROM: "${from}" }, stdio: ["pipe", "ignore", "ignore"], detached: true })
    child.on("error", () => resolve())
    child.on("exit", () => resolve())
    child.stdin?.on("error", () => {})
    child.stdin?.end(JSON.stringify(payload))
    child.unref()
    } catch { resolve() }
  })
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
    // A tool ran: a permission it waited on was answered (ends "waiting", see hook-map.ts).
    "tool.execute.after": async (inp: any) => {
      if (await isChild(inp?.sessionID)) return
      report({ hook_event_name: "PostToolUse", session_id: inp?.sessionID, cwd })
    },
    event: async ({ event }: any) => {
      if (event?.type !== "session.idle" || (await isChild(event?.properties?.sessionID))) return
      report({ hook_event_name: "Stop", session_id: event?.properties?.sessionID, cwd })
    },
  }
}
`

// pi and omp share the extension API; they differ in which event marks "settled" and "waiting".
const PI_OMP = (settled: string, waiting: string, trackSession = false) => `
export default function CliCodeStatus(api: any) {
  if (!HOOK) return
  const sid = (ctx: any) => { try { return ctx?.sessionManager?.getSessionId?.() } catch { return undefined } }
  const identity = (ctx: any) => ({ session_id: sid(ctx)${trackSession ? ", session_file: (() => { try { return ctx?.sessionManager?.getSessionFile?.() } catch { return undefined } })()" : ""} })
  let lastModel: string | undefined
  let activeContext: any
  let modelTimer: ReturnType<typeof setInterval> | undefined
  function syncModel(ctx: any, selected?: any): void {
    try {
      const model = selected ?? ctx?.models?.current?.() ?? ctx?.model
      if (typeof model?.id !== "string" || !model.id) return
      const key = String(sid(ctx)) + ":" + model.id
      if (key === lastModel) return
      lastModel = key
      report({ hook_event_name: "ModelChange", ...identity(ctx), model: model.id })
    } catch {}
  }
  for (const name of ["session_start", "session_switch"]) {
    api.on(name, async (_event: any, ctx: any) => {
      activeContext = ctx
      ${trackSession ? 'report({ hook_event_name: "SessionStart", ...identity(ctx), identityOnly: true })' : ""}
      syncModel(ctx)
      ${trackSession ? `// OMP has no extension-facing model_changed hook. Its context exposes a live getter;
      // sampling it is cheap and sees menu/cycling/fallback changes before a transcript exists.
      if (!modelTimer) {
        modelTimer = setInterval(() => syncModel(activeContext), 250)
        modelTimer.unref()
      }` : ""}
    })
  }
  api.on("session_shutdown", async () => {
    clearInterval(modelTimer)
    modelTimer = undefined
    activeContext = undefined
  })
  ${trackSession ? "" : 'api.on("model_select", async (event: any, ctx: any) => syncModel(ctx, event?.model))'}
  api.on("before_agent_start", async (event: any, ctx: any) => {
    report({ hook_event_name: "UserPromptSubmit", ...identity(ctx), cwd: ctx?.cwd, prompt: typeof event?.prompt === "string" ? event.prompt : undefined })
  })
  api.on("${settled}", async (event: any, ctx: any) => {
    if (event?.willContinue === true) return
    report({ hook_event_name: "Stop", ...identity(ctx), cwd: ctx?.cwd })
  })
  api.on("${waiting}", async (_event: any, ctx: any) => {
    report({ hook_event_name: "PermissionRequest", ...identity(ctx), cwd: ctx?.cwd })
  })
  // A tool ran: a permission it waited on was answered (ends "waiting", see hook-map.ts).
  api.on("tool_execution_end", async (_event: any, ctx: any) => {
    report({ hook_event_name: "PostToolUse", ...identity(ctx), cwd: ctx?.cwd })
  })
}
`

export function pluginSource(flavour: PluginFlavour, from: string): string {
  const body = flavour === "opencode" ? OPENCODE : flavour === "pi" ? PI_OMP("agent_settled", "ui_prompt_start") : PI_OMP("agent_end", "tool_approval_requested", true)
  return `${MANAGED_HEADER}\n${common(from, flavour === "omp" || flavour === "pi")}${body}`
}

export function isManagedPlugin(text: string | undefined): boolean {
  return typeof text === "string" && text.startsWith(MANAGED_HEADER)
}
