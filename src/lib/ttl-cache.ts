/**
 * Keeps a map of `{ at }` entries bounded: once it holds more than `max`, entries older than
 * `ttlMs` go, and if that is not enough the oldest ones (insertion order) — a cache that only
 * ever overwrote its keys grew with every distinct token a long session printed.
 */
export function pruneExpired<V extends { at: number }>(map: Map<string, V>, now: number, ttlMs: number, max: number): void {
  if (map.size <= max) return
  for (const [key, v] of map) if (now - v.at > ttlMs) map.delete(key)
  for (const key of map.keys()) {
    if (map.size <= max) break
    map.delete(key)
  }
}
