export type QuickCommand = { label: string; text: string; submit?: boolean; scope: "global" | "workspace" }

function normalise(value: unknown, scope: QuickCommand["scope"]): QuickCommand[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((v) => {
    if (!v || typeof v !== "object") return []
    const o = v as { label?: unknown; text?: unknown; submit?: unknown }
    if (typeof o.label !== "string" || typeof o.text !== "string") return []
    return [{ label: o.label, text: o.text, submit: typeof o.submit === "boolean" ? o.submit : undefined, scope }]
  })
}

/** Workspace entries first (more specific), then global. */
export function mergeQuickCommands(globalValue: unknown, workspaceValue: unknown): QuickCommand[] {
  return [...normalise(workspaceValue, "workspace"), ...normalise(globalValue, "global")]
}
