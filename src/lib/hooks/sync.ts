import type { StatusHookInstaller } from "./registry.js"

export type SyncResult = { id: string; label: string; action: "installed" | "removed" | "unchanged" | "skipped" | "error"; error?: string }

/**
 * Brings every CLI's hook config in line with the setting: enabled → installed wherever the
 * CLI's binary is present; disabled → removed everywhere it was ours. One CLI's failure never
 * stops the others; it is reported, not thrown.
 */
export function syncStatusHooks(args: {
  installers: readonly StatusHookInstaller[]
  home: string
  enabled: boolean
  onPath: (binary: string) => boolean
}): SyncResult[] {
  return args.installers.map((inst) => {
    const base = { id: inst.id, label: inst.label }
    try {
      if (!args.enabled) return { ...base, action: inst.uninstall(args.home) ? "removed" : "unchanged" }
      if (!args.onPath(inst.binary)) return { ...base, action: "skipped" }
      return { ...base, action: inst.install(args.home) ? "installed" : "unchanged" }
    } catch (err) {
      return { ...base, action: "error", error: String(err) }
    }
  })
}

/** One line for the toast: "Installed: Codex, Grok · Removed: … · Failed: …". */
export function summarize(results: SyncResult[]): string {
  const names = (a: SyncResult["action"]) => results.filter((r) => r.action === a).map((r) => r.label)
  const parts: string[] = []
  if (names("installed").length) parts.push(`Installed: ${names("installed").join(", ")}`)
  if (names("removed").length) parts.push(`Removed: ${names("removed").join(", ")}`)
  if (names("error").length) parts.push(`Failed: ${results.filter((r) => r.action === "error").map((r) => `${r.label} (${r.error})`).join("; ")}`)
  return parts.join(" · ") || "Nothing to change."
}
