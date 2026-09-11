import { afterEach, describe, expect, it } from "bun:test"
import * as net from "node:net"
import * as os from "node:os"
import * as path from "node:path"
import { startDaemon } from "../src/daemon/server.js"
import { connectSession, daemonSocketPath } from "../src/lib/daemon-client.js"
import type { PtyLike } from "../src/daemon/session.js"

let stop: (() => Promise<void>) | undefined
afterEach(async () => {
  await stop?.()
  stop = undefined
})

function fakePty() {
  let dataCb: (d: string) => void = () => {}
  const written: string[] = []
  const pty: PtyLike = {
    onData: (cb) => (dataCb = cb),
    onExit: () => {},
    write: (d) => written.push(d),
    resize: () => {},
    kill: () => {},
    pause: () => {},
    resume: () => {},
  }
  return { pty, written, emit: (d: string) => dataCb(d) }
}

const tmpSocket = () => path.join(os.tmpdir(), `cli-code-c-${Math.random().toString(16).slice(2, 10)}.sock`)
const spawnHello = { op: "spawn", toolId: "claude", command: "claude", cwd: "/tmp", env: {}, cols: 80, rows: 24 } as const

describe("daemonSocketPath", () => {
  it("dùng named pipe trên Windows và file socket ở nơi khác", () => {
    const p = daemonSocketPath("abcd1234")
    if (process.platform === "win32") expect(p).toBe("\\\\.\\pipe\\cli-code-abcd1234")
    else expect(p).toBe(path.join(os.tmpdir(), "cli-code-abcd1234.sock"))
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
    const connection = await connectSession(p, spawnHello)
    let closed = false
    connection!.onClose(() => (closed = true))
    await daemon.close()
    for (let i = 0; i < 50 && !closed; i++) await new Promise((r) => setTimeout(r, 10))
    expect(closed).toBe(true)
  })

  it("trả undefined khi daemon không trả lời bắt tay trong thời hạn", async () => {
    const p = tmpSocket()
    const silent = net.createServer(() => {})
    await new Promise<void>((r) => silent.listen(p, r))
    try {
      expect(await connectSession(p, spawnHello, 100)).toBeUndefined()
    } finally {
      await new Promise<void>((r) => silent.close(() => r()))
    }
  })
})
