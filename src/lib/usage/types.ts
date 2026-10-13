// One shape for every CLI's plan quota (see docs/superpowers/specs/2026-10-13-cli-usage-chip-design.md).

/** One quota window: `used` 0..1; `durationMs` orders windows (5-hour before weekly); times in ms. */
export type UsageWindow = { label: string; used: number; durationMs?: number; resetsAt?: number; detail?: string }
export type UsageAccount = { id?: string; windows: UsageWindow[] }
/** A provider. `active`: the one the tab's model runs on. `capacity`: several accounts pooled (OMP). */
export type UsageGroup = {
  provider: string
  active: boolean
  meta?: string
  accounts: UsageAccount[]
  capacity?: { durationMs?: number; label: string; used: number }[]
}
export type UsageSnapshot = { fetchedAt: number; groups: UsageGroup[]; refreshable: boolean }
