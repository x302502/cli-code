import { afterEach, describe, expect, it } from "bun:test"
import * as net from "node:net"
import * as os from "node:os"
import * as path from "node:path"
import { startDaemon } from "../src/daemon/server.js"
import { connectSession, connectSessionRetrying, daemonBuildId, daemonBuildStampPath, daemonSocketPath } from "../src/lib/daemon-client.js"
import type { PtyLike } from "../src/daemon/session.js"
import { MSG, encodeFrame, encodeJsonFrame } from "../src/lib/protocol.js"

let stop: (() => Promise<void>) | undefined
afterEach(async () => {
  await stop?.()
  stop = undefined
})

function fakePty() {
  let dataCb: (d: string) => void = () => {}
  const written: string[] = []
  const counters = { killed: 0 }
  const pty: PtyLike = {
    onData: (cb) => (dataCb = cb),
    onExit: () => {},
    write: (d) => written.push(d),
    resize: () => {},
    kill: () => counters.killed++,
    pause: () => {},
    resume: () => {},
  }
  return { pty, written, counters, emit: (d: string) => dataCb(d) }
}

const tmpSocket = () => path.join(os.tmpdir(), `cli-code-c-${Math.random().toString(16).slice(2, 10)}.sock`)
const spawnHello = { op: "spawn", toolId: "claude", command: "claude", cwd: "/tmp", env: {}, cols: 80, rows: 24 } as const

describe("daemonBuildId", () => {
  it("is 16 hex characters, the same for the same bundle in the same folder", () => {
    const id = daemonBuildId("bundle", "/ext/x302502.cli-code-0.2.4-darwin-arm64")
    expect(id).toMatch(/^[0-9a-f]{16}$/)
    expect(daemonBuildId("bundle", "/ext/x302502.cli-code-0.2.4-darwin-arm64")).toBe(id)
  })
  it("changes with the extension folder even when the bundle does not", () => {
    // An update installs into a new folder and the old one is deleted: a daemon still running
    // from it can no longer start a CLI (node-pty's spawn-helper is gone with it).
    expect(daemonBuildId("bundle", "/ext/x302502.cli-code-0.2.5-darwin-arm64")).not.toBe(daemonBuildId("bundle", "/ext/x302502.cli-code-0.2.4-darwin-arm64"))
  })
  it("changes with the bundle", () => {
    expect(daemonBuildId("bundle v2", "/ext/a")).not.toBe(daemonBuildId("bundle", "/ext/a"))
  })
})

describe("daemonSocketPath", () => {
  it("dùng named pipe trên Windows và file socket ở nơi khác", () => {
    const p = daemonSocketPath("abcd1234")
    if (process.platform === "win32") expect(p).toBe("\\\\.\\pipe\\cli-code-abcd1234")
    else expect(p).toBe(path.join(os.tmpdir(), "cli-code-abcd1234.sock"))
  })
  it("the build stamp is a plain temp file on every platform — a Windows pipe name cannot be written as a file", () => {
    expect(daemonBuildStampPath("abcd1234")).toBe(path.join(os.tmpdir(), "cli-code-abcd1234.build"))
  })
})

describe("connectSession", () => {
  it("spawn được phiên và nhận lại byte", async () => {
    const p = tmpSocket()
    const harness = fakePty()
    const daemon = await startDaemon({ socketPath: p, spawnPty: () => harness.pty })
    stop = daemon.close

    const connection = await connectSession(p, spawnHello)
    expect(connection).toBeDefined()

    const chunks: Uint8Array[] = []
    connection!.onData((c) => chunks.push(c))
    harness.emit("chao")
    for (let i = 0; i < 50 && chunks.length === 0; i++) await new Promise((r) => setTimeout(r, 10))
    expect(new TextDecoder().decode(chunks[0])).toBe("chao")
    connection!.dispose()
  })

  it("trả undefined khi attach vào phiên đã mất", async () => {
    const p = tmpSocket()
    const harness = fakePty()
    const daemon = await startDaemon({ socketPath: p, spawnPty: () => harness.pty })
    stop = daemon.close

    expect(await connectSession(p, { op: "attach", sessionId: "khong-ton-tai" })).toBeUndefined()
  })

  it("spawn lỗi (không chạy được shell): daemon vẫn sống, trả lời kèm lý do thay vì cắt kết nối", async () => {
    const p = tmpSocket()
    const daemon = await startDaemon({
      socketPath: p,
      spawnPty: () => {
        throw new Error("spawn /bin/zsh EACCES")
      },
    })
    stop = daemon.close
    let reason: string | undefined
    expect(await connectSession(p, spawnHello, { onRefused: (r) => (reason = r) })).toBeUndefined()
    expect(reason).toBe("spawn /bin/zsh EACCES")
    // The daemon is fine: the next Hello on a new connection is answered too.
    expect(await connectSession(p, { op: "attach", sessionId: "x" })).toBeUndefined()
  })

  it("a malformed HelloOk fails the handshake instead of leaving it hanging", async () => {
    const p = tmpSocket()
    const bad = net.createServer((s) => s.write(encodeFrame(MSG.HelloOk, new TextEncoder().encode("{not json"))))
    await new Promise<void>((r) => bad.listen(p, r))
    try {
      expect(await connectSession(p, spawnHello, { timeoutMs: 2000 })).toBeUndefined()
    } finally {
      await new Promise<void>((r) => bad.close(() => r()))
    }
  })

  it("the daemon's socket is owner-only", async () => {
    if (process.platform === "win32") return
    const p = tmpSocket()
    const daemon = await startDaemon({ socketPath: p, spawnPty: () => fakePty().pty })
    stop = daemon.close
    const fs = await import("node:fs")
    expect(fs.statSync(p).mode & 0o077).toBe(0)
  })

  it("trả undefined khi không có daemon nào ở đường dẫn đó", async () => {
    expect(await connectSession(tmpSocket(), spawnHello)).toBeUndefined()
  })

  it("gửi input xuống được daemon", async () => {
    const p = tmpSocket()
    const harness = fakePty()
    const daemon = await startDaemon({ socketPath: p, spawnPty: () => harness.pty })
    stop = daemon.close

    const connection = await connectSession(p, spawnHello)
    connection!.write("ls\r")
    for (let i = 0; i < 50 && harness.written.length === 0; i++) await new Promise((r) => setTimeout(r, 10))
    expect(harness.written).toEqual(["ls\r"])
    connection!.dispose()
  })

  it("báo onClose khi daemon đóng kết nối sau khi đã bắt tay", async () => {
    const p = tmpSocket()
    const harness = fakePty()
    const daemon = await startDaemon({ socketPath: p, spawnPty: () => harness.pty })
    stop = daemon.close
    const connection = await connectSession(p, spawnHello)
    let closed = false
    connection!.onClose(() => (closed = true))
    await daemon.close()
    for (let i = 0; i < 50 && !closed; i++) await new Promise((r) => setTimeout(r, 10))
    expect(closed).toBe(true)
  })

  it("dispose() không tự kích hoạt onClose", async () => {
    const p = tmpSocket()
    const harness = fakePty()
    const daemon = await startDaemon({ socketPath: p, spawnPty: () => harness.pty })
    stop = daemon.close

    const connection = await connectSession(p, spawnHello)
    let closed = false
    connection!.onClose(() => (closed = true))
    connection!.dispose()
    await new Promise((r) => setTimeout(r, 50))
    expect(closed).toBe(false)
  })

  it("kill() ngay trước dispose() vẫn tới được daemon — khung Kill không bị rớt", async () => {
    const p = tmpSocket()
    const harness = fakePty()
    const daemon = await startDaemon({ socketPath: p, spawnPty: () => harness.pty })
    stop = daemon.close

    const connection = await connectSession(p, spawnHello)
    connection!.kill()
    connection!.dispose()
    for (let i = 0; i < 50 && harness.counters.killed === 0; i++) await new Promise((r) => setTimeout(r, 10))
    expect(harness.counters.killed).toBe(1)
    expect(daemon.sessionCount()).toBe(0)
  })

  it("trả undefined khi daemon không trả lời bắt tay trong thời hạn", async () => {
    const p = tmpSocket()
    const silent = net.createServer(() => {})
    await new Promise<void>((r) => silent.listen(p, r))
    try {
      expect(await connectSession(p, spawnHello, { timeoutMs: 100 })).toBeUndefined()
    } finally {
      await new Promise<void>((r) => silent.close(() => r()))
    }
  })

  it("gộp Snapshot và Data cùng đợt với HelloOk vẫn được nhận đủ và đúng thứ tự", async () => {
    const p = tmpSocket()
    const server = net.createServer((socket) => {
      socket.once("data", () => {
        const helloOk = encodeJsonFrame(MSG.HelloOk, { sessionId: "phien-gop" })
        const snapshot = encodeFrame(MSG.Snapshot, new TextEncoder().encode("noi dung cu"))
        const data = encodeFrame(MSG.Data, new TextEncoder().encode("khung moi"))
        const combined = new Uint8Array(helloOk.length + snapshot.length + data.length)
        combined.set(helloOk, 0)
        combined.set(snapshot, helloOk.length)
        combined.set(data, helloOk.length + snapshot.length)
        // Write all three frames in ONE chunk, same as a real daemon does on attach.
        socket.write(combined)
      })
    })
    await new Promise<void>((r) => server.listen(p, r))
    try {
      const connection = await connectSession(p, spawnHello)
      expect(connection).toBeDefined()

      // Handlers are registered only AFTER connectSession resolves, i.e. after
      // the same chunk's Snapshot/Data frames were already decoded.
      const snapshots: string[] = []
      const chunks: Uint8Array[] = []
      connection!.onSnapshot((text) => snapshots.push(text))
      connection!.onData((c) => chunks.push(c))

      for (let i = 0; i < 50 && (snapshots.length === 0 || chunks.length === 0); i++) {
        await new Promise((r) => setTimeout(r, 10))
      }
      expect(snapshots).toEqual(["noi dung cu"])
      expect(chunks.length).toBe(1)
      expect(new TextDecoder().decode(chunks[0])).toBe("khung moi")
      connection!.dispose()
    } finally {
      await new Promise<void>((r) => server.close(() => r()))
    }
  })

  it("onMeta nhận cwd/title, kể cả frame tới trước khi đăng ký", async () => {
    const p = tmpSocket()
    const harness = fakePty()
    const daemon = await startDaemon({ socketPath: p, spawnPty: () => harness.pty })
    stop = daemon.close
    const connection = await connectSession(p, spawnHello)
    harness.emit("\x1b]7;file://h/tmp/z\x07")
    await new Promise((r) => setTimeout(r, 30))
    const seen: unknown[] = []
    connection!.onMeta((e) => seen.push(e))
    expect(seen).toEqual([{ kind: "cwd", cwd: "/tmp/z" }])
    connection!.dispose()
  })
})

describe("connectSessionRetrying — a daemon that idle-exited between the probe and the Hello", () => {
  it("a connection that fails at once is retried once against a freshly ensured daemon", async () => {
    const dead = daemonSocketPath("retry-dead-" + Math.random().toString(16).slice(2, 8))
    const live = daemonSocketPath("retry-live-" + Math.random().toString(16).slice(2, 8))
    const harness = fakePty()
    const daemon = await startDaemon({ socketPath: live, spawnPty: () => harness.pty })
    stop = daemon.close
    const ensured: string[] = []
    // The first ensure hands out a socket whose daemon just exited; the second, a live one.
    const ensure = async () => (ensured.push("x"), ensured.length === 1 ? dead : live)
    const conn = await connectSessionRetrying(ensure, { op: "spawn", toolId: "x", command: "x", cwd: "/tmp", env: {}, cols: 80, rows: 24 })
    expect(conn?.sessionId).toBeTruthy()
    expect(ensured.length).toBe(2)
    conn?.dispose()
  })
  it("a Hello the daemon refused is not retried (it would spawn the CLI twice)", async () => {
    const live = daemonSocketPath("retry-refuse-" + Math.random().toString(16).slice(2, 8))
    const daemon = await startDaemon({
      socketPath: live,
      spawnPty: () => {
        throw new Error("no such shell")
      },
    })
    stop = daemon.close
    let ensures = 0
    const reasons: string[] = []
    const conn = await connectSessionRetrying(async () => (ensures++, live), { op: "spawn", toolId: "x", command: "x", cwd: "/tmp", env: {}, cols: 80, rows: 24 }, { onRefused: (r) => reasons.push(r) })
    expect(conn).toBeUndefined()
    expect(reasons).toEqual(["no such shell"])
    expect(ensures).toBe(1)
  })
})
