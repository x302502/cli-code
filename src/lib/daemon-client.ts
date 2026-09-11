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
    let disposed = false

    let onData: ((chunk: Uint8Array) => void) | undefined
    let onSnapshot: ((text: string) => void) | undefined
    let onExit: ((e: { code: number; signal?: number }) => void) | undefined
    let onClose: (() => void) | undefined

    // Frames (and the close signal) can arrive before the consumer has had a
    // chance to register its handler — e.g. Snapshot/Data land in the same
    // chunk as HelloOk, decoded synchronously while the awaited connectSession
    // promise has only just resolved. Queue them and drain on registration.
    const pendingData: Uint8Array[] = []
    const pendingSnapshot: string[] = []
    const pendingExit: { code: number; signal?: number }[] = []
    let closePending = false

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
    // attempt. After it, the caller learns via onClose instead — unless the
    // caller itself asked for the close via dispose().
    socket.on("close", () => {
      if (!settled) return fail()
      if (disposed) return
      if (onClose) onClose()
      else closePending = true
    })

    socket.on("connect", () => socket.write(encodeJsonFrame(MSG.Hello, hello)))

    socket.on("data", (chunk) => {
      try {
        for (const frame of decode(new Uint8Array(chunk))) {
          if (frame.type === MSG.HelloFail) return fail()
          if (frame.type === MSG.HelloOk) {
            if (settled) continue
            settled = true
            clearTimeout(timer)
            const { sessionId } = decodeJsonPayload<{ sessionId: string }>(frame.payload)
            resolve({
              sessionId,
              onData: (cb) => {
                onData = cb
                while (pendingData.length > 0) cb(pendingData.shift()!)
              },
              onSnapshot: (cb) => {
                onSnapshot = cb
                while (pendingSnapshot.length > 0) cb(pendingSnapshot.shift()!)
              },
              onExit: (cb) => {
                onExit = cb
                while (pendingExit.length > 0) cb(pendingExit.shift()!)
              },
              onClose: (cb) => {
                onClose = cb
                if (closePending) {
                  closePending = false
                  cb()
                }
              },
              write: (data) => socket.write(encodeFrame(MSG.Input, new TextEncoder().encode(data))),
              resize: (cols, rows) => socket.write(encodeJsonFrame(MSG.Resize, { cols, rows })),
              ack: (bytes) => {
                const payload = new Uint8Array(4)
                new DataView(payload.buffer).setUint32(0, bytes, false)
                socket.write(encodeFrame(MSG.Ack, payload))
              },
              kill: () => socket.write(encodeFrame(MSG.Kill, new Uint8Array(0))),
              dispose: () => {
                disposed = true
                socket.destroy()
              },
            })
            continue
          }
          if (frame.type === MSG.Data) {
            if (onData) onData(frame.payload)
            else pendingData.push(frame.payload)
          } else if (frame.type === MSG.Snapshot) {
            const text = new TextDecoder().decode(frame.payload)
            if (onSnapshot) onSnapshot(text)
            else pendingSnapshot.push(text)
          } else if (frame.type === MSG.Exit) {
            const e = decodeJsonPayload<{ code: number; signal?: number }>(frame.payload)
            if (onExit) onExit(e)
            else pendingExit.push(e)
          }
        }
      } catch (err) {
        // A malformed frame (or a throwing consumer handler) must not become an
        // uncaught exception in the extension host — drop the connection instead.
        // Log it, so a consumer bug does not surface only as a silent "gone" panel.
        console.error("[cli-code] daemon frame dispatch failed", err)
        if (!settled) fail()
        else socket.destroy()
      }
    })
  })
}
