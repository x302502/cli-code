import * as fs from "node:fs"
import * as net from "node:net"
import { randomUUID } from "node:crypto"
import { AGENT_STATES, type AgentState, MSG, type MetaEvent, createFrameDecoder, decodeJsonPayload, encodeFrame, encodeJsonFrame } from "../lib/protocol.js"
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
  // The socket currently wired to each session, so a stale connection's
  // eventual 'close' cannot detach a session another connection has since
  // taken over.
  const owners = new Map<string, net.Socket>()
  // All currently-open client connections, so close() can drop them instead
  // of waiting forever for clients to disconnect themselves.
  const clientSockets = new Set<net.Socket>()
  const idleMs = args.idleMs ?? DEFAULT_IDLE_MS
  let connections = 0
  let idleTimer: ReturnType<typeof setTimeout> | undefined
  let closed = false

  const server = net.createServer((socket) => {
    connections++
    clientSockets.add(socket)
    if (idleTimer) clearTimeout(idleTimer)

    const decode = createFrameDecoder()
    let session: Session | undefined

    socket.on("data", (chunk) => {
      // A single malformed frame from one client must not take down the
      // daemon or any other hosted session — only that connection is lost.
      try {
        for (const frame of decode(new Uint8Array(chunk))) {
          if (frame.type === MSG.Hello) {
            session = handleHello(frame.payload, socket, sessions, owners, args.spawnPty, args.socketPath)
            continue
          }
          if (frame.type === MSG.StatusReport) {
            // Sent by a CLI hook over its own short-lived connection: it names the
            // session explicitly because it never did a Hello.
            const report = decodeJsonPayload<{ sessionId: string; state: AgentState; prompt?: string; cliSessionId?: unknown }>(frame.payload)
            if ((AGENT_STATES as readonly string[]).includes(report.state)) {
              const cliSessionId = typeof report.cliSessionId === "string" ? report.cliSessionId : undefined
              sessions.get(report.sessionId)?.reportStatus(report.state, report.prompt, cliSessionId)
            }
            continue
          }
          if (!session) continue
          if (frame.type === MSG.Input) session.write(new TextDecoder().decode(frame.payload))
          else if (frame.type === MSG.Resize) {
            const size = decodeJsonPayload<{ cols: number; rows: number }>(frame.payload)
            session.resize(size.cols, size.rows)
          } else if (frame.type === MSG.Ack) {
            session.ack(new DataView(frame.payload.buffer, frame.payload.byteOffset).getUint32(0, false))
          } else if (frame.type === MSG.Kill && owners.get(session.id) === socket) {
            // Only the current owner may kill; a stale connection's late Kill must not
            // take down a session another connection has since taken over.
            session.detach()
            session.kill()
            sessions.delete(session.id)
            owners.delete(session.id)
          }
        }
      } catch {
        socket.destroy()
      }
    })

    const onGone = () => {
      // Only detach the client if this connection is still the session's
      // current owner — a stale connection closing after a newer attach has
      // already taken over must not wipe the new owner's listener.
      if (session && owners.get(session.id) === socket) {
        session.detach()
        owners.delete(session.id)
      }
      connections--
      clientSockets.delete(socket)
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
      owners.clear()
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
      owners.clear()
      for (const socket of clientSockets) socket.destroy()
      await new Promise<void>((resolve) => server.close(() => resolve()))
      if (process.platform !== "win32") fs.rmSync(args.socketPath, { force: true })
    },
  }
}

function handleHello(
  payload: Uint8Array,
  socket: net.Socket,
  sessions: Map<string, Session>,
  owners: Map<string, net.Socket>,
  spawnPty: SpawnPty,
  socketPath: string,
): Session | undefined {
  const hello = decodeJsonPayload<HelloSpawn | HelloAttach>(payload)

  if (hello.op === "attach") {
    const existing = sessions.get(hello.sessionId)
    if (!existing) {
      socket.write(encodeJsonFrame(MSG.HelloFail, { reason: "gone" }))
      return undefined
    }
    // A stale owner may still be an open connection (its 'close' hasn't
    // landed yet). Evict it now so its later close sees it is no longer the
    // owner and does not detach the connection taking over here.
    const stale = owners.get(existing.id)
    if (stale && stale !== socket) {
      existing.detach()
      stale.destroy()
    }
    owners.set(existing.id, socket)
    socket.write(encodeJsonFrame(MSG.HelloOk, { sessionId: existing.id }))
    void existing
      .attach(
        (text) => socket.write(encodeFrame(MSG.Snapshot, new TextEncoder().encode(text))),
        (chunk) => socket.write(encodeFrame(MSG.Data, chunk)),
      )
      .then(() => {
        // The socket may have closed, or been evicted by a newer attach, while
        // the snapshot was pending — then it no longer owns the session and
        // must not overwrite the current owner's exit listener.
        if (owners.get(existing.id) !== socket) return
        for (const frame of currentMeta(existing)) socket.write(frame)
        existing.onMeta((e) => socket.write(metaFrame(e)))
        existing.onExit((e) => socket.write(encodeJsonFrame(MSG.Exit, e)))
        if (existing.exit) socket.write(encodeJsonFrame(MSG.Exit, existing.exit))
      })
    return existing
  }

  const id = randomUUID()
  const session = createSession({
    id,
    toolId: hello.toolId,
    command: hello.command,
    cwd: hello.cwd,
    env: { ...hello.env, CLI_CODE_SESSION_ID: id, CLI_CODE_DAEMON_SOCK: socketPath },
    cols: hello.cols,
    rows: hello.rows,
    spawnPty,
  })
  sessions.set(session.id, session)
  owners.set(session.id, socket)
  socket.write(encodeJsonFrame(MSG.HelloOk, { sessionId: session.id }))
  wire(session, socket)
  return session
}

function wire(session: Session, socket: net.Socket): void {
  session.onOutput((chunk) => socket.write(encodeFrame(MSG.Data, chunk)))
  session.onExit((e) => socket.write(encodeJsonFrame(MSG.Exit, e)))
  if (session.exit) socket.write(encodeJsonFrame(MSG.Exit, session.exit))
  session.onMeta((e) => socket.write(metaFrame(e)))
}

function metaFrame(e: MetaEvent): Uint8Array {
  if (e.kind === "cwd") return encodeJsonFrame(MSG.Cwd, { cwd: e.cwd })
  if (e.kind === "title") return encodeJsonFrame(MSG.Title, { title: e.title })
  return encodeJsonFrame(MSG.Status, { state: e.state, prompt: e.prompt, cliSessionId: e.cliSessionId })
}

/** Current meta of a session, for a client that just attached. */
function currentMeta(session: Session): Uint8Array[] {
  const frames: Uint8Array[] = []
  if (session.cwd) frames.push(encodeJsonFrame(MSG.Cwd, { cwd: session.cwd }))
  if (session.oscTitle) frames.push(encodeJsonFrame(MSG.Title, { title: session.oscTitle }))
  if (session.status) frames.push(encodeJsonFrame(MSG.Status, session.status))
  return frames
}
