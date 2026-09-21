import * as fs from "node:fs"
import * as path from "node:path"
import type { AgentState } from "./protocol.js"

/**
 * A CLI reads its MCP servers, plugins and hooks once, at start-up. When one of those files
 * changes after a tab was spawned, the running CLI is stale: restarting it into the same
 * conversation is the only way the change takes effect (Orca keeps processes alive across an
 * app restart exactly like we do, so it has the same property).
 */
type Paths = { home: string[]; project: string[] }

const CONFIG_PATHS: Record<string, Paths> = {
  claude: { home: [".claude/settings.json", ".claude/settings.local.json", ".claude.json"], project: [".mcp.json", ".claude/settings.json", ".claude/settings.local.json"] },
  codex: { home: [".codex/config.toml", ".codex/hooks.json"], project: [".codex/config.toml", ".codex/hooks.json"] },
  copilot: { home: [".copilot/config.json", ".copilot/mcp-config.json", ".copilot/hooks"], project: [".github/hooks"] },
  droid: { home: [".factory/settings.json", ".factory/mcp.json"], project: [".factory/settings.json", ".factory/mcp.json"] },
  grok: { home: [".grok/config.toml", ".grok/hooks"], project: [".grok"] },
  opencode: { home: [".config/opencode/opencode.json", ".config/opencode/opencode.jsonc", ".config/opencode/plugins"], project: ["opencode.json", "opencode.jsonc", ".opencode"] },
  kilo: { home: [".config/kilo/kilo.json", ".config/kilo/kilo.jsonc", ".config/kilo/plugins"], project: ["kilo.json", "kilo.jsonc", ".kilo"] },
  mimo: { home: [".config/mimocode/mimocode.json", ".config/mimocode/mimocode.jsonc", ".config/mimocode/plugins"], project: ["mimocode.json", "mimocode.jsonc", ".mimocode"] },
  pi: { home: [".pi/agent/settings.json", ".pi/agent/extensions"], project: [".pi"] },
  omp: { home: [".omp/agent/settings.json", ".omp/agent/extensions"], project: [".omp"] },
  cursor: { home: [".cursor/hooks.json", ".cursor/mcp.json"], project: [".cursor/hooks.json", ".cursor/mcp.json"] },
  cline: { home: [".cline/hooks", ".cline/data/settings"], project: [".clinerules"] },
  "command-code": { home: [".commandcode/settings.json", ".commandcode/mods"], project: [".commandcode"] },
  antigravity: { home: [".gemini/config/hooks.json", ".gemini/antigravity-cli/settings.json"], project: [] },
  amp: { home: [".config/amp/settings.json", ".config/amp/plugins"], project: [] },
}

export function configPathsFor(toolId: string, historyToolId: string | undefined, cwd: string | undefined, home: string): string[] {
  const p = CONFIG_PATHS[historyToolId ?? toolId]
  if (!p) return []
  return [...p.home.map((r) => path.join(home, r)), ...(cwd ? p.project.map((r) => path.join(cwd, r)) : [])]
}

/** Newest mtime under `p` (a file, or a directory scanned two levels deep); undefined if absent. */
export function newestMtime(p: string, depth = 2): number | undefined {
  let st: fs.Stats
  try {
    st = fs.statSync(p)
  } catch {
    return undefined
  }
  let newest = st.mtimeMs
  if (st.isDirectory() && depth > 0) {
    let entries: string[] = []
    try {
      entries = fs.readdirSync(p)
    } catch {
      return newest
    }
    for (const name of entries) {
      // Our own backups and staging files are not configuration.
      if (name.endsWith(".cli-code.bak") || name.endsWith(".tmp")) continue
      const m = newestMtime(path.join(p, name), depth - 1)
      if (m !== undefined && m > newest) newest = m
    }
  }
  return newest
}

/** The config path that changed after `sinceMs` (the tab's spawn), or undefined when none did. */
export function configChangedSince(paths: string[], sinceMs: number): string | undefined {
  let hit: { p: string; m: number } | undefined
  for (const p of paths) {
    const m = newestMtime(p)
    if (m !== undefined && m > sinceMs && (!hit || m > hit.m)) hit = { p, m }
  }
  return hit?.p
}

/**
 * A stale tab restarts by itself only when nothing would be lost: the agent is not working
 * and not waiting on the user, and the terminal has been quiet for a moment. Otherwise the
 * tab just shows a notice and the user restarts when ready.
 */
export function canAutoRestart(args: { state: AgentState | undefined; lastOutputAt: number; now: number; quietMs?: number }): boolean {
  if (args.state === "working" || args.state === "waiting" || args.state === "blocked") return false
  return args.now - args.lastOutputAt >= (args.quietMs ?? 5000)
}
