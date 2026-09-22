import { afterEach, describe, expect, it } from "bun:test"
import * as net from "node:net"
import * as os from "node:os"
import * as path from "node:path"
import { MSG, createFrameDecoder, decodeJsonPayload, encodeFrame, encodeJsonFrame } from "../src/lib/protocol.js"
import { startDaemon } from "../src/daemon/server.js"
import type { PtyLike } from "../src/daemon/session.js"

let stop: (() => Promise<void>) | undefined
afterEach(async () => {
  await stop?.()
  stop = undefined
})

function scriptedPty() {
  let dataCb: (d: string) => void = () => {}
  let exitCb: (e: { exitCode: number; signal?: number }) => void = () => {}
  const written: string[] = []
  const pty: PtyLike = {
    onData: (cb) => (dataCb = cb),
    onExit: (cb) => (exitCb = cb),
    write: (d) => written.push(d),
    resize: () => {},
    kill: () => {},
    pause: () => {},
    resume: () => {},
  }
  return { pty, written, emit: (d: string) => dataCb(d), die: (code: number) => exitCb({ exitCode: code }) }
}

function socketPath(): string {
  return path.join(os.tmpdir(), `cli-code-test-${Math.random().toString(16).slice(2, 10)}.sock`)
}

/** Mở kết nối và trả về một hàm chờ khung tiếp theo có type cho trước. */
function connect(p: string) {
  const socket = net.createConnection(p)
  const decode = createFrameDecoder()
  const frames: { type: number; payload: Uint8Array }[] = []
  socket.on("data", (chunk) => frames.push(...decode(new Uint8Array(chunk))))
  const waitFor = async (type: number) => {
    for (let i = 0; i < 200; i++) {
      const found = frames.find((f) => f.type === type)
      if (found) return found
      await new Promise((r) => setTimeout(r, 10))
    }
    throw new Error(`không thấy khung type=${type}`)
  }
  return { socket, frames, waitFor }
}

describe("startDaemon", () => {
  it("spawn phiên mới và trả về sessionId", async () => {
    const p = socketPath()
    const harness = scriptedPty()
    const daemon = await startDaemon({ socketPath: p, spawnPty: () => harness.pty })
    stop = daemon.close

    const client = connect(p)
    client.socket.write(
      encodeJsonFrame(MSG.Hello, { op: "spawn", toolId: "claude", command: "claude", cwd: "/tmp", env: {}, cols: 80, rows: 24 }),
    )
    const ok = await client.waitFor(MSG.HelloOk)
    expect(decodeJsonPayload<{ sessionId: string }>(ok.payload).sessionId).toBeTruthy()
    expect(daemon.sessionCount()).toBe(1)
    client.socket.destroy()
  })

  it("spawn đóng dấu env CLI_CODE_SESSION_ID và CLI_CODE_DAEMON_SOCK", async () => {
    const p = socketPath()
    const harness = scriptedPty()
    let capturedEnv: Record<string, string> | undefined
    const daemon = await startDaemon({
      socketPath: p,
      spawnPty: (opts) => {
        capturedEnv = opts.env
        return harness.pty
      },
    })
    stop = daemon.close

    const client = connect(p)
    client.socket.write(
      encodeJsonFrame(MSG.Hello, { op: "spawn", toolId: "claude", command: "claude", cwd: "/tmp", env: {}, cols: 80, rows: 24 }),
    )
    const ok = await client.waitFor(MSG.HelloOk)
    const { sessionId } = decodeJsonPayload<{ sessionId: string }>(ok.payload)
    expect(capturedEnv?.CLI_CODE_SESSION_ID).toBe(sessionId)
    expect(capturedEnv?.CLI_CODE_DAEMON_SOCK).toBe(p)
    client.socket.destroy()
  })

  it("chuyển output của PTY về client dưới dạng khung Data", async () => {
    const p = socketPath()
    const harness = scriptedPty()
    const daemon = await startDaemon({ socketPath: p, spawnPty: () => harness.pty })
    stop = daemon.close

    const client = connect(p)
    client.socket.write(
      encodeJsonFrame(MSG.Hello, { op: "spawn", toolId: "claude", command: "claude", cwd: "/tmp", env: {}, cols: 80, rows: 24 }),
    )
    await client.waitFor(MSG.HelloOk)
    harness.emit("xin chao")
    const data = await client.waitFor(MSG.Data)
    expect(new TextDecoder().decode(data.payload)).toBe("xin chao")
    client.socket.destroy()
  })

  it("attach lại phiên cũ thì gửi snapshot trước", async () => {
    const p = socketPath()
    const harness = scriptedPty()
    const daemon = await startDaemon({ socketPath: p, spawnPty: () => harness.pty })
    stop = daemon.close

    const first = connect(p)
    first.socket.write(
      encodeJsonFrame(MSG.Hello, { op: "spawn", toolId: "claude", command: "claude", cwd: "/tmp", env: {}, cols: 80, rows: 24 }),
    )
    const ok = await first.waitFor(MSG.HelloOk)
    const { sessionId } = decodeJsonPayload<{ sessionId: string }>(ok.payload)
    harness.emit("noi dung cu")
    await first.waitFor(MSG.Data)
    first.socket.destroy()

    const second = connect(p)
    second.socket.write(encodeJsonFrame(MSG.Hello, { op: "attach", sessionId }))
    await second.waitFor(MSG.HelloOk)
    const snapshot = await second.waitFor(MSG.Snapshot)
    expect(new TextDecoder().decode(snapshot.payload)).toContain("noi dung cu")
    second.socket.destroy()
  })

  it("attach vào id không tồn tại thì báo HelloFail", async () => {
    const p = socketPath()
    const harness = scriptedPty()
    const daemon = await startDaemon({ socketPath: p, spawnPty: () => harness.pty })
    stop = daemon.close

    const client = connect(p)
    client.socket.write(encodeJsonFrame(MSG.Hello, { op: "attach", sessionId: "khong-co" }))
    const fail = await client.waitFor(MSG.HelloFail)
    expect(decodeJsonPayload<{ reason: string }>(fail.payload).reason).toBe("gone")
    client.socket.destroy()
  })

  it("chuyển input của client xuống PTY", async () => {
    const p = socketPath()
    const harness = scriptedPty()
    const daemon = await startDaemon({ socketPath: p, spawnPty: () => harness.pty })
    stop = daemon.close

    const client = connect(p)
    client.socket.write(
      encodeJsonFrame(MSG.Hello, { op: "spawn", toolId: "claude", command: "claude", cwd: "/tmp", env: {}, cols: 80, rows: 24 }),
    )
    await client.waitFor(MSG.HelloOk)
    client.socket.write(encodeFrame(MSG.Input, new TextEncoder().encode("ls\r")))
    for (let i = 0; i < 50 && harness.written.length === 0; i++) await new Promise((r) => setTimeout(r, 10))
    expect(harness.written).toEqual(["ls\r"])
    client.socket.destroy()
  })

  it("client ngắt kết nối thì phiên vẫn còn — không giết PTY", async () => {
    const p = socketPath()
    const harness = scriptedPty()
    const daemon = await startDaemon({ socketPath: p, spawnPty: () => harness.pty })
    stop = daemon.close

    const client = connect(p)
    client.socket.write(
      encodeJsonFrame(MSG.Hello, { op: "spawn", toolId: "claude", command: "claude", cwd: "/tmp", env: {}, cols: 80, rows: 24 }),
    )
    await client.waitFor(MSG.HelloOk)
    client.socket.destroy()
    await new Promise((r) => setTimeout(r, 50))
    expect(daemon.sessionCount()).toBe(1)
  })

  it("tự thoát khi không còn kết nối nào trong khoảng rảnh", async () => {
    const p = socketPath()
    const harness = scriptedPty()
    let exited = false
    const daemon = await startDaemon({
      socketPath: p,
      spawnPty: () => harness.pty,
      idleMs: 30,
      onIdleExit: () => (exited = true),
    })
    stop = daemon.close

    await new Promise((r) => setTimeout(r, 120))
    expect(exited).toBe(true)
  })

  it("một client bám giữ (keep-alive) không cứu daemon đã hết phiên: vẫn idle-exit sau khi phiên cuối bị Kill", async () => {
    const p = socketPath()
    const harness = scriptedPty()
    let exited = false
    const daemon = await startDaemon({ socketPath: p, spawnPty: () => harness.pty, idleMs: 30, onIdleExit: () => (exited = true) })
    stop = daemon.close
    const hold = connect(p)
    const owner = connect(p)
    owner.socket.write(encodeJsonFrame(MSG.Hello, { op: "spawn", toolId: "claude", command: "claude", cwd: "/tmp", env: {}, cols: 80, rows: 24 }))
    await owner.waitFor(MSG.HelloOk)
    await new Promise((r) => setTimeout(r, 80))
    expect(exited).toBe(false)
    owner.socket.write(encodeFrame(MSG.Kill, new Uint8Array(0)))
    await new Promise((r) => setTimeout(r, 120))
    expect(exited).toBe(true)
    hold.socket.destroy()
  })

  it("gửi khung Exit khi PTY thoát trong lúc client đang nối", async () => {
    const p = socketPath()
    const harness = scriptedPty()
    const daemon = await startDaemon({ socketPath: p, spawnPty: () => harness.pty })
    stop = daemon.close

    const client = connect(p)
    client.socket.write(
      encodeJsonFrame(MSG.Hello, { op: "spawn", toolId: "claude", command: "claude", cwd: "/tmp", env: {}, cols: 80, rows: 24 }),
    )
    await client.waitFor(MSG.HelloOk)
    harness.die(9)
    const exit = await client.waitFor(MSG.Exit)
    expect(decodeJsonPayload<{ code: number }>(exit.payload).code).toBe(9)
    client.socket.destroy()
  })

  it("client mới attach trước khi socket cũ đóng vẫn nhận được Data sau snapshot", async () => {
    const p = socketPath()
    const harness = scriptedPty()
    const daemon = await startDaemon({ socketPath: p, spawnPty: () => harness.pty })
    stop = daemon.close
    const first = connect(p)
    first.socket.write(
      encodeJsonFrame(MSG.Hello, { op: "spawn", toolId: "claude", command: "claude", cwd: "/tmp", env: {}, cols: 80, rows: 24 }),
    )
    const ok = await first.waitFor(MSG.HelloOk)
    const { sessionId } = decodeJsonPayload<{ sessionId: string }>(ok.payload)
    // Do NOT destroy `first` yet — the second client attaches while the first is still open.
    const second = connect(p)
    second.socket.write(encodeJsonFrame(MSG.Hello, { op: "attach", sessionId }))
    await second.waitFor(MSG.Snapshot)
    harness.emit("sau khi doi chu")
    const data = await second.waitFor(MSG.Data)
    expect(new TextDecoder().decode(data.payload)).toBe("sau khi doi chu")
    first.socket.destroy()
    second.socket.destroy()
  })

  it("attach lại rồi PTY thoát thì client mới nhận khung Exit", async () => {
    const p = socketPath()
    const harness = scriptedPty()
    const daemon = await startDaemon({ socketPath: p, spawnPty: () => harness.pty })
    stop = daemon.close
    const first = connect(p)
    first.socket.write(
      encodeJsonFrame(MSG.Hello, { op: "spawn", toolId: "claude", command: "claude", cwd: "/tmp", env: {}, cols: 80, rows: 24 }),
    )
    const ok = await first.waitFor(MSG.HelloOk)
    const { sessionId } = decodeJsonPayload<{ sessionId: string }>(ok.payload)
    first.socket.destroy()
    await new Promise((r) => setTimeout(r, 20))
    const second = connect(p)
    second.socket.write(encodeJsonFrame(MSG.Hello, { op: "attach", sessionId }))
    await second.waitFor(MSG.Snapshot)
    harness.die(4)
    const exit = await second.waitFor(MSG.Exit)
    expect(decodeJsonPayload<{ code: number }>(exit.payload).code).toBe(4)
    second.socket.destroy()
  })

  it("khung hỏng chỉ làm rớt kết nối đó, daemon và phiên khác vẫn sống", async () => {
    const p = socketPath()
    const harness = scriptedPty()
    const daemon = await startDaemon({ socketPath: p, spawnPty: () => harness.pty })
    stop = daemon.close
    const good = connect(p)
    good.socket.write(
      encodeJsonFrame(MSG.Hello, { op: "spawn", toolId: "claude", command: "claude", cwd: "/tmp", env: {}, cols: 80, rows: 24 }),
    )
    await good.waitFor(MSG.HelloOk)
    const bad = connect(p)
    bad.socket.write(encodeFrame(MSG.Hello, new TextEncoder().encode("{khong phai json")))
    await new Promise((r) => setTimeout(r, 50))
    expect(daemon.sessionCount()).toBe(1)
    harness.emit("van chay")
    const data = await good.waitFor(MSG.Data)
    expect(new TextDecoder().decode(data.payload)).toBe("van chay")
    good.socket.destroy()
    bad.socket.destroy()
  })

  it("chuyển meta cwd/title thành khung Cwd/Title", async () => {
    const p = socketPath()
    const harness = scriptedPty()
    const daemon = await startDaemon({ socketPath: p, spawnPty: () => harness.pty })
    stop = daemon.close
    const client = connect(p)
    client.socket.write(encodeJsonFrame(MSG.Hello, { op: "spawn", toolId: "claude", command: "claude", cwd: "/tmp", env: {}, cols: 80, rows: 24 }))
    await client.waitFor(MSG.HelloOk)
    harness.emit("\x1b]7;file://h/tmp/x\x07\x1b]0;hello\x07")
    const cwd = await client.waitFor(MSG.Cwd)
    const title = await client.waitFor(MSG.Title)
    expect(decodeJsonPayload<{ cwd: string }>(cwd.payload)).toEqual({ cwd: "/tmp/x" })
    expect(decodeJsonPayload<{ title: string }>(title.payload)).toEqual({ title: "hello" })
    client.socket.destroy()
  })

  it("attach lại thì nhận meta hiện tại ngay sau Snapshot", async () => {
    const p = socketPath()
    const harness = scriptedPty()
    const daemon = await startDaemon({ socketPath: p, spawnPty: () => harness.pty })
    stop = daemon.close
    const first = connect(p)
    first.socket.write(encodeJsonFrame(MSG.Hello, { op: "spawn", toolId: "claude", command: "claude", cwd: "/tmp", env: {}, cols: 80, rows: 24 }))
    const ok = await first.waitFor(MSG.HelloOk)
    const { sessionId } = decodeJsonPayload<{ sessionId: string }>(ok.payload)
    harness.emit("\x1b]7;file://h/tmp/y\x07")
    await first.waitFor(MSG.Cwd)
    first.socket.destroy()
    await new Promise((r) => setTimeout(r, 20))
    const second = connect(p)
    second.socket.write(encodeJsonFrame(MSG.Hello, { op: "attach", sessionId }))
    await second.waitFor(MSG.Snapshot)
    const cwd = await second.waitFor(MSG.Cwd)
    expect(decodeJsonPayload<{ cwd: string }>(cwd.payload)).toEqual({ cwd: "/tmp/y" })
    second.socket.destroy()
  })

  it("Kill từ owner xoá phiên: attach lại báo gone, StatusReport tới id đó bị bỏ qua", async () => {
    const p = socketPath()
    const harness = scriptedPty()
    const daemon = await startDaemon({ socketPath: p, spawnPty: () => harness.pty })
    stop = daemon.close
    const owner = connect(p)
    owner.socket.write(encodeJsonFrame(MSG.Hello, { op: "spawn", toolId: "claude", command: "claude", cwd: "/tmp", env: {}, cols: 80, rows: 24 }))
    const ok = await owner.waitFor(MSG.HelloOk)
    const { sessionId } = decodeJsonPayload<{ sessionId: string }>(ok.payload)
    owner.socket.write(encodeFrame(MSG.Kill, new Uint8Array(0)))
    await new Promise((r) => setTimeout(r, 50))
    expect(daemon.sessionCount()).toBe(0)

    const again = connect(p)
    again.socket.write(encodeJsonFrame(MSG.Hello, { op: "attach", sessionId }))
    const fail = await again.waitFor(MSG.HelloFail)
    expect(decodeJsonPayload<{ reason: string }>(fail.payload).reason).toBe("gone")

    const hook = connect(p)
    hook.socket.write(encodeJsonFrame(MSG.StatusReport, { sessionId, state: "working" }))
    await new Promise((r) => setTimeout(r, 50))
    expect(owner.frames.some((f) => f.type === MSG.Status)).toBe(false)
    expect(daemon.sessionCount()).toBe(0)
    owner.socket.destroy()
    again.socket.destroy()
    hook.socket.destroy()
  })

  it("StatusReport từ một kết nối không Hello được chuyển tới owner của phiên", async () => {
    const p = socketPath()
    const harness = scriptedPty()
    const daemon = await startDaemon({ socketPath: p, spawnPty: () => harness.pty })
    stop = daemon.close
    const owner = connect(p)
    owner.socket.write(encodeJsonFrame(MSG.Hello, { op: "spawn", toolId: "claude", command: "claude", cwd: "/tmp", env: {}, cols: 80, rows: 24 }))
    const ok = await owner.waitFor(MSG.HelloOk)
    const { sessionId } = decodeJsonPayload<{ sessionId: string }>(ok.payload)
    const hook = connect(p)
    hook.socket.write(encodeJsonFrame(MSG.StatusReport, { sessionId, state: "working", prompt: "abc" }))
    const status = await owner.waitFor(MSG.Status)
    expect(decodeJsonPayload<unknown>(status.payload)).toEqual({ state: "working", prompt: "abc" })
    hook.socket.destroy()
    owner.socket.destroy()
  })
})
