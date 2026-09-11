import * as net from "node:net"
import * as os from "node:os"
import * as path from "node:path"
import { MSG, createFrameDecoder, decodeJsonPayload, encodeFrame, encodeJsonFrame } from "./protocol.js"

export type SessionConnection = {
  sessionId: string
  onData(cb: (chunk: Uint8Array) => void): void
  onSnapshot(cb: (text: string) => void): void
  onExit(cb: (e: { code: number; signal?: number }) => void): void
  onClose(cb: () => void): void
  write(data: string): void
  resize(cols: number, rows: number): void
  ack(bytes: number): void
  kill(): void
  dispose(): void
}

export type SpawnHello = {
  op: "spawn"
  toolId: string
  command: string
  cwd: string
  env: Record<string, string>
  cols: number
  rows: number
}
export type AttachHello = { op: "attach"; sessionId: string }

const DEFAULT_HANDSHAKE_TIMEOUT_MS = 5000

export function daemonSocketPath(id: string): string {
  if (process.platform === "win32") return `\\\\.\\pipe\\cli-code-${id}`
  return path.join(os.tmpdir(), `cli-code-${id}.sock`)
}

export function connectSession(
  socketPath: string,
  hello: SpawnHello | AttachHello,
  timeoutMs = DEFAULT_HANDSHAKE_TIMEOUT_MS,
): Promise<SessionConnection | undefined> {
  return new Promise((resolve) => {
    const socket = net.createConnection(socketPath)
    const decode = createFrameDecoder()
    let settled = false

    let onData: ((chunk: Uint8Array) => void) | undefined
    let onSnapshot: ((text: string) => void) | undefined
    let onExit: ((e: { code: number; signal?: number }) => void) | undefined
    let onClose: (() => void) | undefined

    const timer = setTimeout(fail, timeoutMs)

    function fail() {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.destroy()
      resolve(undefined)
    }

    socket.on("error", fail)
    // Before the handshake completes, a close is just a failed connection
    // attempt. After it, the caller learns via onClose instead.
    socket.on("close", () => {
      if (!settled) return fail()
      onClose?.()
    })

    socket.on("connect", () => socket.write(encodeJsonFrame(MSG.Hello, hello)))

    socket.on("data", (chunk) => {
      for (const frame of decode(new Uint8Array(chunk))) {
        if (frame.type === MSG.HelloFail) return fail()
        if (frame.type === MSG.HelloOk) {
          if (settled) continue
          settled = true
          clearTimeout(timer)
          const { sessionId } = decodeJsonPayload<{ sessionId: string }>(frame.payload)
          resolve({
            sessionId,
            onData: (cb) => (onData = cb),
            onSnapshot: (cb) => (onSnapshot = cb),
            onExit: (cb) => (onExit = cb),
            onClose: (cb) => (onClose = cb),
            write: (data) => socket.write(encodeFrame(MSG.Input, new TextEncoder().encode(data))),
            resize: (cols, rows) => socket.write(encodeJsonFrame(MSG.Resize, { cols, rows })),
            ack: (bytes) => {
              const payload = new Uint8Array(4)
              new DataView(payload.buffer).setUint32(0, bytes, false)
              socket.write(encodeFrame(MSG.Ack, payload))
            },
            kill: () => socket.write(encodeFrame(MSG.Kill, new Uint8Array(0))),
            dispose: () => socket.destroy(),
          })
          continue
        }
        if (frame.type === MSG.Data) onData?.(frame.payload)
        else if (frame.type === MSG.Snapshot) onSnapshot?.(new TextDecoder().decode(frame.payload))
        else if (frame.type === MSG.Exit) onExit?.(decodeJsonPayload(frame.payload))
      }
    })
  })
}
