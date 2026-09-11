import { Terminal } from "@xterm/headless"
import { SerializeAddon } from "@xterm/addon-serialize"
import { COALESCE_MS, createCoalescer, nextPauseState } from "../lib/flow-control.js"

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
  private exitListener: ((e: { code: number; signal?: number }) => void) | undefined
  private unacked = 0
  private paused = false
  // While a client is re-attaching, PTY output is held here instead of being
  // forwarded live, so it can be replayed after the snapshot is delivered.
  private backlog: Uint8Array[] | undefined
  private readonly coalescer: { push(chunk: Uint8Array): void; flush(): void }

  constructor(
    readonly id: string,
    readonly toolId: string,
    private readonly pty: PtyLike,
    private readonly mirror: Terminal,
    private readonly serializer: SerializeAddon,
    schedule: (fn: () => void, ms: number) => unknown,
  ) {
    this.coalescer = createCoalescer(COALESCE_MS, (chunk) => this.listener?.(chunk), schedule)

    this.pty.onData((data) => {
      // The headless mirror is always fed, even when nobody is attached — this
      // is what lets a snapshot be rebuilt correctly after a reload.
      this.mirror.write(data)
      const chunk = new TextEncoder().encode(data)
      // Backpressure only tracks bytes owed to an actual listener: a detached
      // session (client gone during Reload Window) must never pause its PTY,
      // since nobody would be left to ack it and the CLI would stall forever.
      if (this.backlog) this.backlog.push(chunk)
      else if (this.listener) this.forward(chunk)
    })

    this.pty.onExit((e) => {
      this.exit = { code: e.exitCode, signal: e.signal }
      this.exitListener?.(this.exit)
    })
  }

  onOutput(cb: (chunk: Uint8Array) => void): void {
    this.listener = cb
  }

  onExit(cb: (e: { code: number; signal?: number }) => void): void {
    this.exitListener = cb
  }

  /**
   * Re-attach a client after a reload. Bytes that arrive while the parser
   * drains are held back and forwarded only after the snapshot has been
   * delivered, so the client never sees data older than its snapshot.
   */
  async attach(onSnapshot: (text: string) => void, onOutput: (chunk: Uint8Array) => void): Promise<void> {
    const backlog: Uint8Array[] = []
    this.backlog = backlog
    // Queue the snapshot marker before any later chunk can arrive, so every
    // byte that comes in during the await lands in `backlog`, not in the
    // snapshot.
    const text = await this.snapshotAtMarker()
    onSnapshot(text)
    this.backlog = undefined
    this.listener = onOutput
    for (const chunk of backlog) this.forward(chunk)
  }

  /** Detaches the client while leaving the PTY running. This is the mechanism that keeps a session alive across Reload Window. */
  detach(): void {
    // Deliver any coalesced bytes to the departing listener now and empty the
    // queue — otherwise a later attach() within COALESCE_MS would receive a
    // flush of pre-detach bytes that are already covered by its snapshot.
    this.coalescer.flush()
    this.listener = undefined
    this.exitListener = undefined
    this.backlog = undefined
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

  snapshot(): Promise<string> {
    return this.snapshotAtMarker()
  }

  kill(): void {
    if (!this.exit) this.pty.kill()
  }

  /**
   * Serialize inside a marker write's callback so the snapshot reflects exactly
   * the writes queued before this call — xterm parses its whole queue in one
   * macrotask, so awaiting an earlier write's callback is not a stable cut point.
   */
  private snapshotAtMarker(): Promise<string> {
    return new Promise<string>((resolve) => this.mirror.write("", () => resolve(this.serializer.serialize())))
  }

  private forward(chunk: Uint8Array): void {
    this.unacked += chunk.length
    this.applyBackpressure()
    this.coalescer.push(chunk)
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
  const mirror = new Terminal({ cols: args.cols, rows: args.rows, scrollback: 5000, allowProposedApi: true })
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
