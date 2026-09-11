import * as fs from "node:fs"
import * as net from "node:net"
import { randomUUID } from "node:crypto"
import { MSG, createFrameDecoder, decodeJsonPayload, encodeFrame, encodeJsonFrame } from "../lib/protocol.js"
import { createSession, type Session, type SpawnPty } from "./session.js"

const DEFAULT_IDLE_MS = 60_000

type HelloSpawn = {
  op: "spawn"
  toolId: string
  command: string
  cwd: string
  env: Record<string, string>
  cols: number
  rows: number
}
type HelloAttach = { op: "attach"; sessionId: string }

export async function startDaemon(args: {
  socketPath: string
  spawnPty: SpawnPty
  idleMs?: number
  onIdleExit?: () => void
}): Promise<{ close(): Promise<void>; sessionCount(): number }> {
  const sessions = new Map<string, Session>()
  const idleMs = args.idleMs ?? DEFAULT_IDLE_MS
  let connections = 0
  let idleTimer: ReturnType<typeof setTimeout> | undefined
  let closed = false

  const server = net.createServer((socket) => {
    connections++
    if (idleTimer) clearTimeout(idleTimer)

    const decode = createFrameDecoder()
    let session: Session | undefined

    socket.on("data", (chunk) => {
      for (const frame of decode(new Uint8Array(chunk))) {
        if (frame.type === MSG.Hello) {
          session = handleHello(frame.payload, socket, sessions, args.spawnPty)
          continue
        }
        if (!session) continue
        if (frame.type === MSG.Input) session.write(new TextDecoder().decode(frame.payload))
        else if (frame.type === MSG.Resize) {
          const size = decodeJsonPayload<{ cols: number; rows: number }>(frame.payload)
          session.resize(size.cols, size.rows)
        } else if (frame.type === MSG.Ack) {
          session.ack(new DataView(frame.payload.buffer, frame.payload.byteOffset).getUint32(0, false))
        } else if (frame.type === MSG.Kill) {
          session.kill()
          sessions.delete(session.id)
        }
      }
    })

    const onGone = () => {
      // Only detach the client. The PTY must keep living — this is exactly
      // what happens during a Reload Window.
      session?.detach()
      connections--
      if (connections === 0) scheduleIdleExit()
    }
    socket.on("close", onGone)
    socket.on("error", () => {})
  })

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(args.socketPath, () => resolve())
  })

  scheduleIdleExit()

  function scheduleIdleExit() {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      if (connections > 0 || closed) return
      for (const session of sessions.values()) session.kill()
      sessions.clear()
      args.onIdleExit?.()
    }, idleMs)
    idleTimer.unref?.()
  }

  return {
    sessionCount: () => sessions.size,
    close: async () => {
      closed = true
      if (idleTimer) clearTimeout(idleTimer)
      for (const session of sessions.values()) session.kill()
      sessions.clear()
      await new Promise<void>((resolve) => server.close(() => resolve()))
      if (process.platform !== "win32") fs.rmSync(args.socketPath, { force: true })
    },
  }
}

function handleHello(
  payload: Uint8Array,
  socket: net.Socket,
  sessions: Map<string, Session>,
  spawnPty: SpawnPty,
): Session | undefined {
  const hello = decodeJsonPayload<HelloSpawn | HelloAttach>(payload)

  if (hello.op === "attach") {
    const existing = sessions.get(hello.sessionId)
    if (!existing) {
      socket.write(encodeJsonFrame(MSG.HelloFail, { reason: "gone" }))
      return undefined
    }
    socket.write(encodeJsonFrame(MSG.HelloOk, { sessionId: existing.id }))
    void existing
      .attach(
        (text) => socket.write(encodeFrame(MSG.Snapshot, new TextEncoder().encode(text))),
        (chunk) => socket.write(encodeFrame(MSG.Data, chunk)),
      )
      .then(() => {
        existing.onExit((e) => socket.write(encodeJsonFrame(MSG.Exit, e)))
        if (existing.exit) socket.write(encodeJsonFrame(MSG.Exit, existing.exit))
      })
    return existing
  }

  const session = createSession({
    id: randomUUID(),
    toolId: hello.toolId,
    command: hello.command,
    cwd: hello.cwd,
    env: hello.env,
    cols: hello.cols,
    rows: hello.rows,
    spawnPty,
  })
  sessions.set(session.id, session)
  socket.write(encodeJsonFrame(MSG.HelloOk, { sessionId: session.id }))
  wire(session, socket)
  return session
}

function wire(session: Session, socket: net.Socket): void {
  session.onOutput((chunk) => socket.write(encodeFrame(MSG.Data, chunk)))
  session.onExit((e) => socket.write(encodeJsonFrame(MSG.Exit, e)))
  if (session.exit) socket.write(encodeJsonFrame(MSG.Exit, session.exit))
}
