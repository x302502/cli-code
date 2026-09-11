import { Terminal } from "@xterm/headless"
import { SerializeAddon } from "@xterm/addon-serialize"
import { COALESCE_MS, createCoalescer, nextPauseState } from "../lib/flow-control.js"

// Terminal.write() queues data asynchronously (it schedules a setTimeout
// internally), so a snapshot() taken right after new output could see a
// stale buffer. CoreTerminal exposes a synchronous writeSync for this exact
// case, but it isn't part of the public typings, so we reach through the
// internal `_core` field on purpose. logLevel is set to "off" in the
// constructor below to mute writeSync's own deprecation warning.
function writeSyncToMirror(mirror: Terminal, data: string): void {
  ;(mirror as unknown as { _core: { writeSync(data: string): void } })._core.writeSync(data)
}

export type PtyLike = {
  onData(cb: (data: string) => void): void
  onExit(cb: (e: { exitCode: number; signal?: number }) => void): void
  write(data: string): void
  resize(cols: number, rows: number): void
  kill(): void
  pause(): void
  resume(): void
}

export type SpawnPty = (opts: {
  command: string
  cwd: string
  env: Record<string, string>
  cols: number
  rows: number
}) => PtyLike

export class Session {
  exit: { code: number; signal?: number } | undefined
  private listener: ((chunk: Uint8Array) => void) | undefined
  private unacked = 0
  private paused = false

  constructor(
    readonly id: string,
    readonly toolId: string,
    private readonly pty: PtyLike,
    private readonly mirror: Terminal,
    private readonly serializer: SerializeAddon,
    schedule: (fn: () => void, ms: number) => unknown,
  ) {
    const coalescer = createCoalescer(COALESCE_MS, (chunk) => this.listener?.(chunk), schedule)

    this.pty.onData((data) => {
      // The headless mirror is always fed, even when nobody is attached — this
      // is what lets a snapshot be rebuilt correctly after a reload.
      writeSyncToMirror(this.mirror, data)
      // Backpressure only tracks bytes owed to an actual listener: a detached
      // session (client gone during Reload Window) must never pause its PTY,
      // since nobody would be left to ack it and the CLI would stall forever.
      if (this.listener) {
        const chunk = new TextEncoder().encode(data)
        this.unacked += chunk.length
        this.applyBackpressure()
        coalescer.push(chunk)
      }
    })

    this.pty.onExit((e) => {
      this.exit = { code: e.exitCode, signal: e.signal }
    })
  }

  onOutput(cb: (chunk: Uint8Array) => void): void {
    this.listener = cb
  }

  /** Detaches the client while leaving the PTY running. This is the mechanism that keeps a session alive across Reload Window. */
  detach(): void {
    this.listener = undefined
    this.unacked = 0
    if (this.paused) {
      this.paused = false
      this.pty.resume()
    }
  }

  write(data: string): void {
    if (this.exit) return
    this.pty.write(data)
  }

  resize(cols: number, rows: number): void {
    if (this.exit) return
    this.mirror.resize(cols, rows)
    this.pty.resize(cols, rows)
  }

  ack(bytes: number): void {
    this.unacked = Math.max(0, this.unacked - bytes)
    this.applyBackpressure()
  }

  snapshot(): string {
    return this.serializer.serialize()
  }

  kill(): void {
    if (!this.exit) this.pty.kill()
  }

  private applyBackpressure(): void {
    const next = nextPauseState(this.paused, this.unacked)
    if (next === this.paused) return
    this.paused = next
    if (next) this.pty.pause()
    else this.pty.resume()
  }
}

export function createSession(args: {
  id: string
  toolId: string
  command: string
  cwd: string
  env: Record<string, string>
  cols: number
  rows: number
  spawnPty: SpawnPty
  schedule?: (fn: () => void, ms: number) => unknown
}): Session {
  const mirror = new Terminal({
    cols: args.cols,
    rows: args.rows,
    scrollback: 5000,
    allowProposedApi: true,
    logLevel: "off",
  })
  const serializer = new SerializeAddon()
  mirror.loadAddon(serializer)

  const pty = args.spawnPty({
    command: args.command,
    cwd: args.cwd,
    env: args.env,
    cols: args.cols,
    rows: args.rows,
  })

  return new Session(args.id, args.toolId, pty, mirror, serializer, args.schedule ?? setTimeout)
}
