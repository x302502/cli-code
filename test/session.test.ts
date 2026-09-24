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

  it("onExit báo cho listener khi PTY thoát", () => {
    const { session, die } = makeSession()
    const seen: number[] = []
    session.onExit((e) => seen.push(e.code))
    die(7)
    expect(seen).toEqual([7])
  })

  it("kill() trên phiên đã thoát không đụng PTY", () => {
    const { session, calls, die } = makeSession()
    die(0)
    session.kill()
    expect(calls.killed).toBe(0)
  })

  it("cwd được seed từ spawn và vẫn bị OSC 7 ghi đè", () => {
    const harness = fakePty()
    const session = createSession({
      id: "s1",
      toolId: "claude",
      command: "claude",
      cwd: "/w",
      env: {},
      cols: 80,
      rows: 24,
      spawnPty: () => harness.pty,
      schedule: (fn) => fn(),
    })
    expect(session.cwd).toBe("/w")
    harness.emit("\x1b]7;file://h/x\x07")
    expect(session.cwd).toBe("/x")
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

  it("detach trong lúc attach đang chờ snapshot thì attach không gắn listener", async () => {
    const { session, calls, emit } = makeSession()
    const got: string[] = []
    const done = session.attach(
      () => got.push("snapshot"),
      (c) => got.push("data:" + new TextDecoder().decode(c)),
    )
    session.detach()
    await done
    emit("x".repeat(HIGH_WATER + 1))
    expect(got).toEqual([])
    expect(calls.paused).toBe(0)
  })

  it("attach thứ hai thắng attach thứ nhất còn đang chờ", async () => {
    const { session, emit } = makeSession()
    const first: string[] = []
    const second: string[] = []
    const p1 = session.attach(() => first.push("snapshot"), (c) => first.push(new TextDecoder().decode(c)))
    session.detach()
    const p2 = session.attach(() => second.push("snapshot"), (c) => second.push(new TextDecoder().decode(c)))
    await Promise.all([p1, p2])
    emit("sau")
    expect(first).toEqual([])
    expect(second).toEqual(["snapshot", "sau"])
  })

  it("phát meta cwd/title từ OSC trong output và nhớ giá trị mới nhất", () => {
    const { session, emit } = makeSession()
    const seen: unknown[] = []
    session.onMeta((e) => seen.push(e))
    emit("\x1b]7;file://h/tmp/a\x07\x1b]0;Claude • fix\x07")
    expect(seen).toEqual([
      { kind: "cwd", cwd: "/tmp/a" },
      { kind: "title", title: "Claude • fix" },
    ])
    expect(session.cwd).toBe("/tmp/a")
    expect(session.oscTitle).toBe("Claude • fix")
  })

  it("OSC 9999 hợp lệ thành meta status, không hợp lệ thì bỏ qua", () => {
    const { session, emit } = makeSession()
    const seen: unknown[] = []
    session.onMeta((e) => seen.push(e))
    emit('\x1b]9999;{"state":"working","prompt":"sua bug"}\x07\x1b]9999;{"state":"nope"}\x07\x1b]9999;{\x07')
    expect(seen).toEqual([{ kind: "status", state: "working", prompt: "sua bug" }])
    expect(session.status).toEqual({ state: "working", prompt: "sua bug" })
  })

  it("reportStatus phát meta như OSC 9999", () => {
    const { session } = makeSession()
    const seen: unknown[] = []
    session.onMeta((e) => seen.push(e))
    session.reportStatus("done")
    expect(seen).toEqual([{ kind: "status", state: "done", prompt: undefined }])
  })

  it("detach gỡ meta listener", () => {
    const { session, emit } = makeSession()
    const seen: unknown[] = []
    session.onMeta((e) => seen.push(e))
    session.detach()
    emit("\x1b]0;x\x07")
    expect(seen).toEqual([])
    expect(session.oscTitle).toBe("x")
  })
})

describe("Session mirror — same Unicode width rules as the webview (Unicode 11)", () => {
  it("an emoji is two cells wide, so text written after it lands where the webview puts it", async () => {
    const { session, emit } = makeSession()
    // A😀B, then CR and a cursor jump to column 4 (1-based), then X. Unicode 11: A|😀😀|B → X replaces B.
    emit("A\u{1F600}B\r\x1b[4GX")
    let snapshot = ""
    await session.attach((s) => (snapshot = s), () => {})
    expect(snapshot).toContain("A\u{1F600}X")
    expect(snapshot).not.toContain("BX")
  })
})

describe("Session snapshot — mouse encoding", () => {
  it("restores SGR mouse encoding (1006) along with tracking, so clicks after a reload use the same format", async () => {
    const { session, emit } = makeSession()
    emit("\x1b[?1000h\x1b[?1006h")
    let snapshot = ""
    await session.attach((s) => (snapshot = s), () => {})
    expect(snapshot).toContain("\x1b[?1000h")
    expect(snapshot).toContain("\x1b[?1006h")
  })
  it("adds nothing when the default encoding is active", async () => {
    const { session, emit } = makeSession()
    emit("\x1b[?1000h")
    let snapshot = ""
    await session.attach((s) => (snapshot = s), () => {})
    expect(snapshot).not.toContain("\x1b[?1006h")
  })
})
