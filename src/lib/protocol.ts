/** Các loại khung. Client→daemon dùng 1–15, daemon→client dùng 16–31, để đọc log là biết chiều. */
export const MSG = {
  Hello: 1,
  Input: 2,
  Resize: 3,
  Ack: 4,
  Kill: 5,
  HelloOk: 16,
  HelloFail: 17,
  Snapshot: 18,
  Data: 19,
  Exit: 20,
} as const

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
 * Trả về một hàm giải mã có trạng thái: socket chia dữ liệu theo ý nó, nên một khung
 * có thể tới làm nhiều mảnh, và một mảnh có thể chứa nhiều khung.
 */
export function createFrameDecoder(): (chunk: Uint8Array) => { type: number; payload: Uint8Array }[] {
  let pending = new Uint8Array(0)

  return (chunk) => {
    const combined = new Uint8Array(pending.length + chunk.length)
    combined.set(pending)
    combined.set(chunk, pending.length)

    const frames: { type: number; payload: Uint8Array }[] = []
    const view = new DataView(combined.buffer, combined.byteOffset, combined.byteLength)
    let offset = 0

    while (combined.length - offset >= HEADER_LEN) {
      const length = view.getUint32(offset + 1, false)
      if (combined.length - offset - HEADER_LEN < length) break
      frames.push({
        type: combined[offset]!,
        payload: combined.slice(offset + HEADER_LEN, offset + HEADER_LEN + length),
      })
      offset += HEADER_LEN + length
    }

    pending = combined.slice(offset)
    return frames
  }
}
