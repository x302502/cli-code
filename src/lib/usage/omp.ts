import type { UsageAccount, UsageGroup, UsageSnapshot, UsageWindow } from "./types.js"

const NAMES: Record<string, string> = {
  "github-copilot": "GitHub Copilot",
  "openai-codex": "OpenAI Codex",
  "google-antigravity": "Google Antigravity",
  anthropic: "Anthropic",
  "cline-pass": "Cline Pass",
}
const CACHE_MS = 5 * 60_000
const TIMEOUT_MS = 15_000

export function providerOfModel(model: string | undefined): string | undefined {
  const i = model?.indexOf("/") ?? -1
  return i > 0 ? model!.slice(0, i) : undefined
}

const compact = (n: number) => {
  if (n >= 1000) return `${Math.round(n / 1000)}K`
  return String(Number.isInteger(n) ? n : n >= 10 ? Math.round(n) : Math.round(n * 10) / 10)
}

type Limit = { label?: unknown; window?: { label?: unknown; resetsAt?: unknown }; amount?: { usedFraction?: unknown; used?: unknown; limit?: unknown; unit?: unknown } }
type Report = { provider?: unknown; limits?: Limit[]; metadata?: { accountId?: unknown; plan?: unknown } }

function windowOf(l: Limit): UsageWindow | undefined {
  const used = l.amount?.usedFraction
  if (typeof used !== "number") return undefined
  const label = typeof l.label === "string" ? l.label : ""
  const win = typeof l.window?.label === "string" ? l.window.label : ""
  const w: UsageWindow = { label: !win || win === label ? label || win : label ? `${label} · ${win}` : win, used }
  if (typeof l.window?.resetsAt === "number") w.resetsAt = l.window.resetsAt
  const a = l.amount!
  if (a.unit !== "percent" && typeof a.used === "number" && typeof a.limit === "number") w.detail = `${compact(a.used)} / ${compact(a.limit)}${typeof a.unit === "string" ? ` ${a.unit}` : ""}`
  return w
}

/** `omp usage --json` → one group per provider; `activeProvider` (the tab model's prefix) first. */
export function ompSnapshot(output: string, activeProvider: string | undefined, now: number): UsageSnapshot | undefined {
  let data: { reports?: Report[]; capacity?: Record<string, { window?: unknown; accounts?: unknown; usedAccounts?: unknown }[]> }
  try {
    data = JSON.parse(output.slice(output.indexOf("{"), output.lastIndexOf("}") + 1))
  } catch {
    return undefined
  }
  const groups = new Map<string, UsageGroup & { plan?: string }>()
  for (const r of data.reports ?? []) {
    if (typeof r.provider !== "string") continue
    const windows = (r.limits ?? []).map(windowOf).filter((w): w is UsageWindow => !!w)
    if (!windows.length) continue
    let g = groups.get(r.provider)
    if (!g) {
      g = { provider: NAMES[r.provider] ?? r.provider, active: r.provider === activeProvider, accounts: [] }
      const cap = (data.capacity?.[r.provider] ?? []).flatMap((c) =>
        typeof c.window === "string" && typeof c.accounts === "number" && c.accounts > 0 && typeof c.usedAccounts === "number"
          ? [{ label: c.window, used: c.usedAccounts / c.accounts }] : [])
      if (cap.length) g.capacity = cap
      groups.set(r.provider, g)
    }
    if (typeof r.metadata?.plan === "string") g.plan ??= r.metadata.plan
    const account: UsageAccount = { windows }
    if (typeof r.metadata?.accountId === "string") account.id = r.metadata.accountId
    g.accounts.push(account)
  }
  if (!groups.size) return undefined
  const list = [...groups.values()].map(({ plan, ...g }) => {
    const parts = [plan, g.accounts.length > 1 ? `${g.accounts.length} accounts` : undefined].filter(Boolean)
    return parts.length ? { ...g, meta: parts.join(" · ") } : g
  })
  list.sort((a, b) => Number(b.active) - Number(a.active))
  return { fetchedAt: now, refreshable: true, groups: list }
}

/** One `omp usage --json` run shared by every OMP tab of the window. */
export class OmpUsage {
  private cached: { at: number; output: string } | undefined
  private inflight: Promise<string | undefined> | undefined
  constructor(
    private run: (command: string, timeoutMs: number) => Promise<string>,
    private clock: () => number = Date.now,
  ) {}

  /** When the cached run happened: the snapshot's age, not the render time. */
  get fetchedAt(): number | undefined {
    return this.cached?.at
  }

  /** The cached run's output, without starting a run. */
  get cachedOutput(): string | undefined {
    return this.cached?.output
  }

  get(force = false): Promise<string | undefined> {
    if (!force && this.cached && this.clock() - this.cached.at < CACHE_MS) return Promise.resolve(this.cached.output)
    this.inflight ??= this.run("omp usage --json", TIMEOUT_MS)
      .then((output) => {
        this.cached = { at: this.clock(), output }
        return output
      })
      .catch(() => undefined)
      .finally(() => (this.inflight = undefined))
    return this.inflight
  }
}
