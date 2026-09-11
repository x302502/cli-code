import { describe, expect, it } from "bun:test"
import { HIGH_WATER } from "../src/lib/flow-control.js"
import { createSession, type PtyLike } from "../src/daemon/session.js"

function fakePty() {
  const calls = { written: [] as string[], resized: [] as [number, number][], paused: 0, resumed: 0, killed: 0 }
  let dataCb: (d: string) => void = () => {}
  let exitCb: (e: { exitCode: number; signal?: number }) => void = () => {}
  const pty: PtyLike = {
    onData: (cb) => (dataCb = cb),
    onExit: (cb) => (exitCb = cb),
    write: (d) => calls.written.push(d),
    resize: (c, r) => calls.resized.push([c, r]),
    kill: () => calls.killed++,
    pause: () => calls.paused++,
    resume: () => calls.resumed++,
  }
  return { pty, calls, emit: (d: string) => dataCb(d), die: (code: number) => exitCb({ exitCode: code }) }
}

function makeSession(schedule: (fn: () => void, ms: number) => unknown = (fn) => fn()) {
  const harness = fakePty()
  const session = createSession({
    id: "s1",
    toolId: "claude",
    command: "claude",
    cwd: "/tmp",
    env: {},
    cols: 80,
    rows: 24,
    spawnPty: () => harness.pty,
    schedule,
  })
  return { session, ...harness }
}

describe("Session", () => {
  it("chuyển output của PTY ra dạng byte", () => {
    const { session, emit } = makeSession()
    const chunks: Uint8Array[] = []
    session.onOutput((c) => chunks.push(c))
    emit("hello")
    expect(new TextDecoder().decode(chunks[0])).toBe("hello")
  })

  it("ghi input xuống PTY", () => {
    const { session, calls } = makeSession()
    session.write("ls\r")
    expect(calls.written).toEqual(["ls\r"])
  })

  it("chuyển tiếp resize", () => {
    const { session, calls } = makeSession()
    session.resize(120, 40)
    expect(calls.resized).toEqual([[120, 40]])
  })

  it("dừng PTY khi client chưa ack quá ngưỡng, chạy lại khi đã ack", () => {
    const { session, calls, emit } = makeSession()
    session.onOutput(() => {})
    emit("x".repeat(HIGH_WATER + 1))
    expect(calls.paused).toBe(1)
    session.ack(HIGH_WATER + 1)
    expect(calls.resumed).toBe(1)
  })

  it("ghi lại mã thoát và không còn nhận input nữa", () => {
    const { session, calls, die } = makeSession()
    die(3)
    expect(session.exit).toEqual({ code: 3, signal: undefined })
    session.write("ls\r")
    expect(calls.written).toEqual([])
  })

  it("snapshot dựng lại được nội dung đã in ra", async () => {
    const { session, emit } = makeSession()
    emit("xin chao")
    expect(await session.snapshot()).toContain("xin chao")
  })

  it("detach gỡ listener nhưng KHÔNG giết PTY — đây chính là điều giữ phiên sống qua reload", async () => {
    const { session, calls, emit } = makeSession()
    const chunks: Uint8Array[] = []
    session.onOutput((c) => chunks.push(c))
    session.detach()
    emit("sau khi detach")
    expect(chunks.length).toBe(0)
    expect(calls.killed).toBe(0)
    expect(await session.snapshot()).toContain("sau khi detach")
  })

  it("không có listener thì output không làm PTY bị pause — phiên detached không được kẹt", () => {
    const { session, calls, emit } = makeSession()
    emit("x".repeat(HIGH_WATER + 1))
    expect(calls.paused).toBe(0)
    session.onOutput(() => {})
    emit("x".repeat(HIGH_WATER + 1))
    expect(calls.paused).toBe(1)
  })

  it("attach gửi snapshot trước, rồi mới forward byte tới trong lúc chờ snapshot — không nhân đôi", async () => {
    const { session, emit } = makeSession()
    emit("cu")
    const order: string[] = []
    let snapshotText = ""
    const done = session.attach(
      (text) => {
        snapshotText = text
        order.push("snapshot")
      },
      (chunk) => order.push("data:" + new TextDecoder().decode(chunk)),
    )
    emit("moi")
    await done
    expect(order[0]).toBe("snapshot")
    expect(snapshotText).toContain("cu")
    expect(snapshotText).not.toContain("moi")
    expect(order.filter((o) => o === "data:moi").length).toBe(1)
  })

  it("detach xả hết coalescer để byte cũ không rò sang listener sau attach", async () => {
    let pending: (() => void) | undefined
    const { session, emit } = makeSession((fn) => (pending = fn))
    const first: string[] = []
    session.onOutput((c) => first.push(new TextDecoder().decode(c)))
    emit("truoc")
    expect(first).toEqual([])
    session.detach()
    expect(first).toEqual(["truoc"])
    const second: string[] = []
    await session.attach(
      () => {},
      (c) => second.push(new TextDecoder().decode(c)),
    )
    pending?.()
    expect(second).toEqual([])
  })
})
