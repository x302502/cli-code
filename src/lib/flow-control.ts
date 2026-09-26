export const HIGH_WATER = 256 * 1024
export const LOW_WATER = 128 * 1024
export const COALESCE_MS = 16

/**
 * Two distinct thresholds (not one) so the stream doesn't flap: once paused,
 * it must drop below `LOW_WATER` before resuming.
 */
export function nextPauseState(paused: boolean, unacked: number): boolean {
  if (paused) return unacked >= LOW_WATER
  return unacked > HIGH_WATER
}

/**
 * Batches PTY bytes over a time window before pushing them out, so
 * `postMessage` isn't called on every `onData`. `schedule` is injectable so
 * tests don't have to wait on a real clock.
 */
export function createCoalescer(
  flushMs: number,
  onFlush: (chunk: Uint8Array) => void,
  schedule: (fn: () => void, ms: number) => unknown = setTimeout,
): { push(chunk: Uint8Array): void; flush(): void } {
  let queue: Uint8Array[] = []
  let scheduled = false

  const flush = () => {
    scheduled = false
    if (queue.length === 0) return
    const total = queue.reduce((n, c) => n + c.length, 0)
    const merged = new Uint8Array(total)
    let offset = 0
    for (const chunk of queue) {
      merged.set(chunk, offset)
      offset += chunk.length
    }
    queue = []
    onFlush(merged)
  }

  return {
    push(chunk) {
      queue.push(chunk)
      if (scheduled) return
      scheduled = true
      schedule(flush, flushMs)
    },
    flush,
  }
}
