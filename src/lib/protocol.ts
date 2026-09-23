/** Frame types. Client→daemon uses 1–15, daemon→client uses 16–31, so a log line reveals its direction at a glance. */
export const MSG = {
  Hello: 1,
  Input: 2,
  Resize: 3,
  Ack: 4,
  Kill: 5,
  StatusReport: 6,
  HelloOk: 16,
  HelloFail: 17,
  Snapshot: 18,
  Data: 19,
  Exit: 20,
  Cwd: 21,
  Title: 22,
  Status: 23,
} as const

export type AgentState = "working" | "waiting" | "blocked" | "done"
export const AGENT_STATES: readonly AgentState[] = ["working", "waiting", "blocked", "done"]

export type MetaEvent =
  | { kind: "cwd"; cwd: string }
  | { kind: "title"; title: string }
  | { kind: "status"; state: AgentState; prompt?: string; cliSessionId?: string }

const HEADER_LEN = 5

export function encodeFrame(type: number, payload: Uint8Array): Uint8Array {
  const frame = new Uint8Array(HEADER_LEN + payload.length)
  frame[0] = type
  new DataView(frame.buffer).setUint32(1, payload.length, false)
  frame.set(payload, HEADER_LEN)
  return frame
}

export function encodeJsonFrame(type: number, value: unknown): Uint8Array {
  return encodeFrame(type, new TextEncoder().encode(JSON.stringify(value)))
}

export function decodeJsonPayload<T>(payload: Uint8Array): T {
  return JSON.parse(new TextDecoder().decode(payload)) as T
}

/**
 * Returns a stateful decoder: the socket splits data however it likes, so one frame
 * may arrive in several chunks, and one chunk may contain several frames.
 */
export function createFrameDecoder(): (chunk: Uint8Array) => { type: number; payload: Uint8Array }[] {
  // Chunks are held as they arrive and merged only as far as the frame being read needs:
  // concatenating the whole backlog on every chunk copies a multi-MB snapshot once per 64 KB
  // chunk (quadratic), which a reload with several tabs pays on the extension host's thread.
  let chunks: Uint8Array[] = []
  let total = 0

  /** Merges whole chunks at the front until `chunks[0]` holds at least `n` bytes (n <= total). */
  const coalesce = (n: number): Uint8Array => {
    let head = chunks[0]!
    if (head.length >= n) return head
    let size = 0
    let count = 0
    while (size < n) size += chunks[count++]!.length
    const merged = new Uint8Array(size)
    let at = 0
    for (let i = 0; i < count; i++) {
      merged.set(chunks[i]!, at)
      at += chunks[i]!.length
    }
    chunks.splice(0, count, merged)
    head = merged
    return head
  }

  return (chunk) => {
    if (chunk.length > 0) {
      chunks.push(chunk)
      total += chunk.length
    }

    const frames: { type: number; payload: Uint8Array }[] = []
    while (total >= HEADER_LEN) {
      const head = coalesce(HEADER_LEN)
      const length = new DataView(head.buffer, head.byteOffset, head.byteLength).getUint32(1, false)
      const frameLen = HEADER_LEN + length
      if (total < frameLen) break
      const full = coalesce(frameLen)
      frames.push({ type: full[0]!, payload: full.slice(HEADER_LEN, frameLen) })
      // The rest is a view into the same buffer — no copy until a later frame needs it merged.
      const rest = full.subarray(frameLen)
      if (rest.length > 0) chunks[0] = rest
      else chunks.shift()
      total -= frameLen
    }
    return frames
  }
}
