import { hookCommand } from "../claude-hooks.js"

const COMMAND = hookCommand("copilot")

/** Copilot reads every `~/.copilot/hooks/*.json`; ours is a file of its own, so install = write,
 * uninstall = delete, and nothing of the user's is ever merged. */
// PostToolUse ends a permission wait (hook-map.ts): the tool ran, so the dialog was answered.
export const COPILOT_EVENTS = ["UserPromptSubmit", "Stop", "PermissionRequest", "Notification", "PostToolUse"] as const

export type CopilotHookFile = { version: 1; hooks: Record<string, { type: "command"; bash: string; timeoutSec: number }[]> }

export function copilotFile(): CopilotHookFile {
  const hooks: CopilotHookFile["hooks"] = {}
  for (const e of COPILOT_EVENTS) hooks[e] = [{ type: "command", bash: COMMAND, timeoutSec: 5 }]
  return { version: 1, hooks }
}

export function copilotInstalled(value: unknown): boolean {
  const f = value as { hooks?: Record<string, { bash?: string }[]> } | undefined
  return COPILOT_EVENTS.every((e) => Array.isArray(f?.hooks?.[e]) && f!.hooks![e]!.some((h) => h?.bash === COMMAND))
}
