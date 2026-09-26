import { createHash } from "node:crypto"
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
  const id = historyToolId ?? toolId
  const p = CONFIG_PATHS[id]
  if (!p) return []
  // Codex's home folder moves with CODEX_HOME; its project-level `.codex/` does not.
  const homeFile = (r: string) => (id === "codex" && process.env.CODEX_HOME ? path.join(process.env.CODEX_HOME, r.replace(/^\.codex\//, "")) : path.join(home, r))
  return [...p.home.map(homeFile), ...(cwd ? p.project.map((r) => path.join(cwd, r)) : [])]
}

/**
 * Newest mtime under `p`: a file's own, or the newest of a directory's entries two levels deep.
 * A directory's own mtime is ignored — it moves whenever anything is created next to the
 * config (our `.cli-code.bak`, an editor's swap file) and says nothing about the config.
 */
export function newestMtime(p: string, depth = 2): number | undefined {
  let st: fs.Stats
  try {
    st = fs.statSync(p)
  } catch {
    return undefined
  }
  if (!st.isDirectory()) return st.mtimeMs
  let newest = 0
  for (const name of configEntries(p)) {
    const m = depth > 0 ? newestMtime(path.join(p, name), depth - 1) : undefined
    if (m !== undefined && m > newest) newest = m
  }
  return newest
}

/** Directory entries that are configuration — not our backups or staging files. */
function configEntries(dir: string): string[] {
  try {
    // node_modules (a plugin folder's dependencies) is not config, and walking it two levels
    // deep on every tab switch is the one case that would be slow.
    return fs.readdirSync(dir).filter((n) => !n.endsWith(".cli-code.bak") && !n.endsWith(".tmp") && n !== "node_modules")
  } catch {
    return []
  }
}

/**
 * Per-path signature. Most files: newest mtime. Files the CLI itself rewrites while running —
 * `~/.claude.json` (Claude stores its state there) and Codex's `config.toml` (notices, trust
 * entries, model availability) — would otherwise look "changed" all the time, so for those only
 * the parts that matter (MCP servers, hooks) are hashed. Claude's `settings*.json` also gets a
 * write whenever the user answers a permission with "don't ask again": hashed without `permissions`. A missing path is recorded as "" (not
 * dropped), so a config file created after the snapshot still shows up as a change.
 */
export function configSnapshot(paths: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const p of paths) out[p] = signature(p) ?? ""
  return out
}

/** The first path whose signature differs between two snapshots (added or removed counts too). */
export function changedPath(before: Record<string, string>, after: Record<string, string>): string | undefined {
  for (const p of new Set([...Object.keys(before), ...Object.keys(after)])) if (before[p] !== after[p]) return p
  return undefined
}

function signature(p: string): string | undefined {
  const base = path.basename(p)
  if (base === ".claude.json") return hashOf(p, claudeMcp)
  const parent = path.dirname(p)
  if ((base === "settings.json" || base === "settings.local.json") && path.basename(parent) === ".claude") return hashOf(p, withoutPermissions)
  if (base === "config.toml" && (path.basename(parent) === ".codex" || (process.env.CODEX_HOME && path.resolve(parent) === path.resolve(process.env.CODEX_HOME)))) return hashOf(p, codexMcpAndHooks)
  const m = newestMtime(p)
  if (m === undefined) return undefined
  // A directory also lists its entries, so a removed plugin file counts as a change.
  let dir = false
  try {
    dir = fs.statSync(p).isDirectory()
  } catch {
    return undefined
  }
  return dir ? `${m}:${configEntries(p).sort().join(",")}` : String(m)
}

// Hash per file, keyed by its mtime+size: ~/.claude.json can be hundreds of KB and is
// re-signed on every tab switch, so only a file that actually changed is re-read and parsed.
const hashes = new Map<string, { stamp: string; hash: string }>()

function hashOf(p: string, extract: (text: string) => string): string | undefined {
  let stamp: string
  let text: string
  try {
    const st = fs.statSync(p)
    stamp = `${st.mtimeMs}:${st.size}`
    const cached = hashes.get(p)
    if (cached?.stamp === stamp) return cached.hash
    text = fs.readFileSync(p, "utf8")
  } catch {
    return undefined
  }
  const hash = createHash("sha256").update(extract(text)).digest("hex").slice(0, 16)
  hashes.set(p, { stamp, hash })
  return hash
}

/** Everything but `permissions` (Claude reads allow/deny rules live; no restart needed). */
function withoutPermissions(text: string): string {
  try {
    const { permissions: _, ...rest } = JSON.parse(text) as Record<string, unknown>
    return JSON.stringify(rest)
  } catch {
    return text
  }
}

/** `mcpServers` at the top level and per project. */
function claudeMcp(text: string): string {
  try {
    const j = JSON.parse(text) as { mcpServers?: unknown; projects?: Record<string, { mcpServers?: unknown }> }
    const projects = Object.fromEntries(Object.entries(j.projects ?? {}).map(([k, v]) => [k, v?.mcpServers]))
    return JSON.stringify({ mcpServers: j.mcpServers, projects })
  } catch {
    return text
  }
}

/** Lines of the `[mcp_servers.*]` and `[hooks.*]` tables (a table runs until the next header). */
function codexMcpAndHooks(text: string): string {
  const kept: string[] = []
  let keep = false
  for (const line of text.split("\n")) {
    if (/^\s*\[/.test(line)) keep = /^\s*\[(mcp_servers|hooks)\b/.test(line)
    if (keep) kept.push(line)
  }
  return kept.join("\n")
}

/**
 * A stale tab restarts by itself only when nothing would be lost: its hook reported the agent
 * done, nothing is typed into the prompt, and the terminal has been quiet for a moment.
 * Otherwise the tab just shows a notice and the user restarts when ready.
 */
export function canAutoRestart(args: { state: AgentState | undefined; lastOutputAt: number; now: number; hasDraft?: boolean; quietMs?: number }): boolean {
  // Only a hook-reported "done" is evidence of idleness; no state at all (CLIs without hooks,
  // or before the first prompt) may be an agent at work, and a restart would kill it.
  if (args.state !== "done") return false
  if (args.hasDraft) return false
  return args.now - args.lastOutputAt >= (args.quietMs ?? 5000)
}
