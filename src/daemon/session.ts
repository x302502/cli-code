import { Terminal } from "@xterm/headless"
import { Unicode11Addon } from "@xterm/addon-unicode11"
import { SerializeAddon } from "@xterm/addon-serialize"
import { COALESCE_MS, createCoalescer, nextPauseState } from "../lib/flow-control.js"
import { createOscScanner } from "../lib/osc-scan.js"
import { AGENT_STATES, type AgentState, type MetaEvent } from "../lib/protocol.js"

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
  // Bumped by every attach() and detach(). An attach() that resumes after its
  // snapshot await compares its own token against this: if a detach (or a
  // newer attach) happened meanwhile, it must not install its listener — that
  // would forward bytes to a dead socket and grow `unacked` with nobody to ack.
  private attachGen = 0
  private readonly coalescer: { push(chunk: Uint8Array): void; flush(): void }
  cwd: string | undefined
  oscTitle: string | undefined
  status: { state: AgentState; prompt?: string; cliSessionId?: string } | undefined
  private metaListener: ((e: MetaEvent) => void) | undefined
  private readonly scan = createOscScanner()
  private disposed = false

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
      for (const osc of this.scan(data)) this.applyOsc(osc)
      // The headless mirror is always fed, even when nobody is attached — this
      // is what lets a snapshot be rebuilt correctly after a reload.
      if (!this.disposed) this.mirror.write(data)
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

  onMeta(cb: (e: MetaEvent) => void): void {
    this.metaListener = cb
  }

  /** Status pushed from outside the PTY stream (a CLI hook talking to the daemon). */
  reportStatus(state: AgentState, prompt?: string, cliSessionId?: string): void {
    // The CLI's own session id (from its hook) is kept across later reports that omit it.
    this.status = { state, prompt, cliSessionId: cliSessionId ?? this.status?.cliSessionId }
    this.metaListener?.({ kind: "status", ...this.status })
  }

  private applyOsc(osc: { kind: "title"; title: string } | { kind: "cwd"; cwd: string } | { kind: "status"; payload: string }): void {
    if (osc.kind === "cwd") {
      this.cwd = osc.cwd
      this.metaListener?.({ kind: "cwd", cwd: osc.cwd })
    } else if (osc.kind === "title") {
      this.oscTitle = osc.title
      this.metaListener?.({ kind: "title", title: osc.title })
    } else {
      // OSC 9999 carries JSON; anything malformed or with an unknown state is ignored
      // rather than surfaced — a CLI must not be able to put the tab into a bogus state.
      try {
        const parsed = JSON.parse(osc.payload) as { state?: unknown; prompt?: unknown }
        if (typeof parsed.state === "string" && (AGENT_STATES as readonly string[]).includes(parsed.state)) {
          this.reportStatus(parsed.state as AgentState, typeof parsed.prompt === "string" ? parsed.prompt : undefined)
        }
      } catch {
        // ignore
      }
    }
  }

  /**
   * Re-attach a client after a reload. Bytes that arrive while the parser
   * drains are held back and forwarded only after the snapshot has been
   * delivered, so the client never sees data older than its snapshot.
   */
  async attach(onSnapshot: (text: string) => void, onOutput: (chunk: Uint8Array) => void): Promise<void> {
    // Start from a clean slate: the new client owes nothing yet, and a
    // previous client's outstanding byte count must not be charged to it.
    this.unacked = 0
    if (this.paused) {
      this.paused = false
      this.pty.resume()
    }
    const backlog: Uint8Array[] = []
    this.backlog = backlog
    const gen = ++this.attachGen
    // Queue the snapshot marker before any later chunk can arrive, so every
    // byte that comes in during the await lands in `backlog`, not in the
    // snapshot.
    const text = await this.snapshot()
    if (gen !== this.attachGen) return
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
    this.attachGen++
    this.listener = undefined
    this.exitListener = undefined
    this.metaListener = undefined
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

  kill(): void {
    if (!this.exit) this.pty.kill()
  }

  /** Kill and release the mirror's 5000-line buffer: a removed session must not wait for GC. */
  dispose(): void {
    this.kill()
    this.disposed = true
    this.mirror.dispose()
  }

  /**
   * Serialize inside a marker write's callback so the snapshot reflects exactly
   * the writes queued before this call — xterm parses its whole queue in one
   * macrotask, so awaiting an earlier write's callback is not a stable cut point.
   */
  snapshot(): Promise<string> {
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
  // The webview measures wide characters with Unicode 11; the mirror must agree or a snapshot
  // after Reload Window puts text and the cursor in different cells (emoji are 2 wide in 11).
  mirror.loadAddon(new Unicode11Addon())
  mirror.unicode.activeVersion = "11"

  const pty = args.spawnPty({
    command: args.command,
    cwd: args.cwd,
    env: args.env,
    cols: args.cols,
    rows: args.rows,
  })

  const session = new Session(args.id, args.toolId, pty, mirror, serializer, args.schedule ?? setTimeout)
  // Seed with the spawn cwd: CLIs run via `$SHELL -ilc <cmd>` rarely emit OSC 7, and a
  // client attaching after Reload Window still needs a cwd (restart, path links).
  session.cwd = args.cwd
  return session
}
