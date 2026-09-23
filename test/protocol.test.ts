import { describe, expect, it } from "bun:test"
import { MSG, createFrameDecoder, decodeJsonPayload, encodeFrame, encodeJsonFrame } from "../src/lib/protocol.js"

const bytes = (...n: number[]) => new Uint8Array(n)

describe("encodeFrame", () => {
  it("đặt type ở byte đầu và độ dài big-endian ở 4 byte tiếp theo", () => {
    const frame = encodeFrame(MSG.Input, bytes(1, 2, 3))
    expect(frame.length).toBe(8)
    expect(frame[0]).toBe(MSG.Input)
    expect(Array.from(frame.slice(1, 5))).toEqual([0, 0, 0, 3])
    expect(Array.from(frame.slice(5))).toEqual([1, 2, 3])
  })

  it("mã hoá được payload rỗng", () => {
    const frame = encodeFrame(MSG.Kill, bytes())
    expect(Array.from(frame)).toEqual([MSG.Kill, 0, 0, 0, 0])
  })
})

describe("createFrameDecoder", () => {
  it("giải mã nhiều khung nằm trong cùng một chunk", () => {
    const decode = createFrameDecoder()
    const chunk = new Uint8Array([...encodeFrame(MSG.Data, bytes(9)), ...encodeFrame(MSG.Exit, bytes())])
    const frames = decode(chunk)
    expect(frames.map((f) => f.type)).toEqual([MSG.Data, MSG.Exit])
    expect(Array.from(frames[0]!.payload)).toEqual([9])
  })

  it("ghép lại khung bị cắt làm nhiều mảnh, kể cả cắt giữa phần header", () => {
    const decode = createFrameDecoder()
    const frame = encodeFrame(MSG.Data, bytes(7, 7, 7))
    expect(decode(frame.slice(0, 2))).toEqual([])
    expect(decode(frame.slice(2, 6))).toEqual([])
    const frames = decode(frame.slice(6))
    expect(frames.length).toBe(1)
    expect(Array.from(frames[0]!.payload)).toEqual([7, 7, 7])
  })

  it("giữ nguyên phần dư khi chunk chứa một khung đủ và một khung dở", () => {
    const decode = createFrameDecoder()
    const full = encodeFrame(MSG.Data, bytes(1))
    const partial = encodeFrame(MSG.Data, bytes(2, 2)).slice(0, 4)
    const frames = decode(new Uint8Array([...full, ...partial]))
    expect(frames.length).toBe(1)
    expect(Array.from(frames[0]!.payload)).toEqual([1])
  })

  it("ghép một payload lớn đến theo hàng trăm chunk 64KB, rồi trả phần dư cho khung sau", () => {
    const decode = createFrameDecoder()
    const big = new Uint8Array(2_000_000).map((_, i) => i & 0xff)
    const wire = new Uint8Array([...encodeFrame(MSG.Data, big), ...encodeFrame(MSG.Exit, bytes(4))])
    const frames = []
    for (let at = 0; at < wire.length; at += 65_536) frames.push(...decode(wire.subarray(at, at + 65_536)))
    expect(frames.map((f) => f.type)).toEqual([MSG.Data, MSG.Exit])
    expect(frames[0]!.payload.length).toBe(2_000_000)
    expect(Array.from(frames[0]!.payload.slice(1_999_997))).toEqual(Array.from(big.slice(1_999_997)))
    expect(Array.from(frames[1]!.payload)).toEqual([4])
  })

  it("chịu được payload lớn hơn 64KB", () => {
    const decode = createFrameDecoder()
    const big = new Uint8Array(200_000).fill(3)
    const frames = decode(encodeFrame(MSG.Data, big))
    expect(frames[0]!.payload.length).toBe(200_000)
  })
})

describe("khung JSON", () => {
  it("đi vòng tròn qua encode rồi decode", () => {
    const frame = encodeJsonFrame(MSG.Hello, { op: "attach", sessionId: "abc" })
    const [decoded] = createFrameDecoder()(frame)
    expect(decoded!.type).toBe(MSG.Hello)
    expect(decodeJsonPayload<{ op: string; sessionId: string }>(decoded!.payload)).toEqual({
      op: "attach",
      sessionId: "abc",
    })
  })
})
