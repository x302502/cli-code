import { Terminal, type IBufferCell } from "@xterm/headless"
import { Unicode11Addon } from "@xterm/addon-unicode11"
import { SerializeAddon } from "@xterm/addon-serialize"
import { COALESCE_MS, createCoalescer, nextPauseState } from "../lib/flow-control.js"
import { SNAPSHOT_LINKS_OSC } from "../lib/osc-link.js"
import { createOscScanner } from "../lib/osc-scan.js"
import { AGENT_STATES, type AgentState, type MetaEvent } from "../lib/protocol.js"

export type PtyLike = {
  onData(cb: (data: string) => void): void
  onExit(cb: (e: { exitCode: number; signal?: number }) => void): void
  write(data: string | Buffer): void
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
  private waitingTool: string | undefined
  /** Characters written to the mirror it has not parsed yet (see onData). */
  private mirrorPending = 0
  /** Per chunk still waiting in the mirror: whether the mirror answers its queries. */
  private readonly mirrorAnswers: boolean[] = []
  private clientHeld = false
  private mirrorHeld = false
  private waitingAgent: string | undefined
  private reporterPid: number | undefined
  private ownerDecided = false
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

    // The mirror answers the terminal's queries (cursor position `ESC[6n`, device attributes…)
    // as any terminal would. A chunk that reached a client (or an attach in progress, which
    // hands it on) is the webview's to answer; one that arrived with nobody attached (during a
    // Reload Window) is the mirror's, or a CLI waiting on the reply hangs or times out. Decided
    // when the chunk arrives: the mirror parses later, when a client may have come or gone.
    // xterm parses writes in order and answers synchronously, so the head of `mirrorAnswers`
    // belongs to the chunk being parsed.
    this.mirror.onData((reply) => {
      if (this.mirrorAnswers[0] && !this.exit && !this.disposed) this.pty.write(reply)
    })

    this.pty.onData((data) => {
      for (const osc of this.scan(data)) this.applyOsc(osc)
      // The headless mirror is always fed, even when nobody is attached — this
      // is what lets a snapshot be rebuilt correctly after a reload. It parses on its own
      // schedule, so a flood (a detached tab `cat`-ing a huge file) is held back like a slow
      // client would hold it: xterm throws once 50 MB wait unparsed, and that would take the
      // whole daemon — every tab's CLI — down with it.
      if (!this.disposed) {
        this.mirrorPending += data.length
        this.mirrorAnswers.push(!this.listener && !this.backlog)
        this.mirror.write(data, () => {
          this.mirrorAnswers.shift()
          this.mirrorPending -= data.length
          this.applyBackpressure()
        })
        this.applyBackpressure()
      }
      const chunk = ENCODER.encode(data)
      // Backpressure only tracks bytes owed to an actual listener: a detached
      // session (client gone during Reload Window) must never pause its PTY,
      // since nobody would be left to ack it and the CLI would stall forever.
      if (this.backlog) this.backlog.push(chunk)
      else if (this.listener) this.forward(chunk)
    })

    this.pty.onExit((e) => {
      this.exit = { code: e.exitCode, signal: e.signal }
      // The CLI's last output may still sit in the coalescer; it must reach the client before
      // the exit notice, or "[process exited]" lands above the CLI's final lines.
      this.coalescer.flush()
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

  /**
   * Status pushed from outside the PTY stream (a CLI hook talking to the daemon). While a
   * permission dialog is up, `tool`/`agent` name the call and the agent it belongs to; it ends
   * with that call finishing (`toolDone`) or that agent's tool batch resolving (`agentDone`,
   * which covers a denied or edited call too) — never with another agent's tools.
   */
  reportStatus(
    state: AgentState,
    prompt?: string,
    cliSessionId?: string,
    opts: { tool?: string; toolDone?: string; agent?: string; agentDone?: string; cliPid?: number; fromHook?: boolean } = {},
  ): void {
    // The first CLI process to report owns the tab; a same-kind CLI nested inside it (which
    // inherits the tab's env, so reaches the same hook) is another process and is ignored.
    // The owner always reports first: a nested CLI only runs once the tab's CLI took a prompt.
    // Only that first hook report decides — if its pid is unknown (ps failed), nothing is
    // pinned, rather than letting a later nested CLI claim the tab.
    if (opts.fromHook) {
      if (!this.ownerDecided) {
        this.ownerDecided = true
        this.reporterPid = opts.cliPid
      } else if (opts.cliPid !== undefined && this.reporterPid !== undefined && opts.cliPid !== this.reporterPid) return
    }
    if (opts.toolDone !== undefined || opts.agentDone !== undefined) {
      if (this.status?.state !== "waiting") return
      const tool = opts.toolDone !== undefined && (this.waitingTool === undefined || this.waitingTool === opts.toolDone)
      const agent = opts.agentDone !== undefined && (this.waitingAgent === undefined || this.waitingAgent === opts.agentDone)
      if (!tool && !agent) return
    }
    // A later "waiting" without a tool (Claude's permission_prompt Notification) is the same dialog.
    if (state === "waiting") {
      this.waitingTool = opts.tool ?? this.waitingTool
      this.waitingAgent = opts.agent ?? this.waitingAgent
    } else this.waitingTool = this.waitingAgent = undefined
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
    this.clientHeld = false
    this.applyBackpressure()
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
    // Attaching to an exited session: the server sends Exit right after this returns.
    if (this.exit) this.coalescer.flush()
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
    this.clientHeld = false
    this.applyBackpressure()
  }

  write(data: string | Buffer): void {
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
    return new Promise<string>((resolve) => this.mirror.write("", () => resolve(this.serializer.serialize() + mouseEncoding(this.mirror) + scrollRegion(this.mirror) + oscLinks(this.mirror))))
  }

  private forward(chunk: Uint8Array): void {
    this.unacked += chunk.length
    this.applyBackpressure()
    this.coalescer.push(chunk)
  }

  private applyBackpressure(): void {
    // Held back by the client not acking, or by the mirror not keeping up with parsing — the
    // latter on a far higher mark (a detached session has no client, and a burst of output is
    // fine), yet far below the 50 MB at which xterm starts throwing.
    this.clientHeld = nextPauseState(this.clientHeld, this.unacked)
    this.mirrorHeld = this.mirrorHeld ? this.mirrorPending >= MIRROR_LOW_WATER : this.mirrorPending > MIRROR_HIGH_WATER
    const next = this.clientHeld || this.mirrorHeld
    if (next === this.paused) return
    this.paused = next
    if (next) this.pty.pause()
    else this.pty.resume()
  }
}

/**
 * The mouse report encoding the program switched on (SGR = 1006, SGR pixels = 1016). The
 * serializer restores mouse *tracking* but not its encoding, so after a reload the webview
 * would send legacy X10 reports to a TUI still expecting SGR ones.
 */
function mouseEncoding(term: Terminal): string {
  const encoding = (term as unknown as { _core?: { coreMouseService?: { activeEncoding?: string } } })._core?.coreMouseService?.activeEncoding
  if (encoding === "SGR") return "\x1b[?1006h"
  if (encoding === "SGR_PIXELS") return "\x1b[?1016h"
  return ""
}

/**
 * The scroll region (DECSTBM) the program set, then the cursor put back where it was — setting
 * a region homes the cursor. The serializer drops the region, so after a reload a TUI with a
 * fixed header/footer would scroll the whole screen and overwrite them.
 */
function scrollRegion(term: Terminal): string {
  const buf = (term as unknown as { _core?: { buffer?: { scrollTop?: number; scrollBottom?: number } } })._core?.buffer
  const top = buf?.scrollTop
  const bottom = buf?.scrollBottom
  if (top === undefined || bottom === undefined || (top === 0 && bottom === term.rows - 1)) return ""
  const cur = term.buffer.active
  // Under origin mode (DECOM, which the serializer already switched back on) rows count from
  // the region's top.
  const row = term.modes.originMode ? cur.cursorY - top : cur.cursorY
  return `\x1b[${top + 1};${bottom + 1}r\x1b[${row + 1};${cur.cursorX + 1}H`
}

/**
 * OSC 8 hyperlinks on screen and in scrollback. The serializer keeps a link's text but drops
 * its target, so a label like "Read report" stops being clickable after a reload. Each run of
 * cells with one link goes out as [row offset from the cursor's row, column, cells, uri] in one
 * private OSC at the end of the snapshot; the webview puts the links back (webview/main.ts).
 */
function oscLinks(term: Terminal): string {
  const links = (term as unknown as { _core?: { _oscLinkService?: { getLinkData(id: number): { uri: string } | undefined; _dataByLinkId?: Map<number, unknown> } } })._core
    ?._oscLinkService
  // No link printed (or all of them trimmed away): skip the per-cell walk of the whole scrollback.
  if (!links || links._dataByLinkId?.size === 0) return ""
  const buf = term.buffer.active
  const cursorRow = buf.baseY + buf.cursorY
  const runs: [number, number, number, string][] = []
  let cell: IBufferCell | undefined
  for (let y = 0; y < buf.length; y++) {
    const line = buf.getLine(y)
    if (!line) continue
    let open: { x: number; id: number } | undefined
    const close = (end: number) => {
      const uri = open && links.getLinkData(open.id)?.uri
      if (open && uri) runs.push([y - cursorRow, open.x, end - open.x, uri])
      open = undefined
    }
    for (let x = 0; x < line.length; x++) {
      cell = line.getCell(x, cell)
      // The public cell is xterm's CellData; its extended attributes carry the link id. A reused
      // cell keeps the last `extended` it saw, so only a cell flagged as having one counts.
      const data = cell as unknown as { hasExtendedAttrs?(): number; extended?: { urlId?: number } } | undefined
      const id = data?.hasExtendedAttrs?.() ? (data.extended?.urlId ?? 0) : 0
      if (open && id !== open.id) close(x)
      if (id && !open) open = { x, id }
    }
    close(line.length)
  }
  return runs.length ? `\x1b]${SNAPSHOT_LINKS_OSC};${JSON.stringify(runs)}\x07` : ""
}

// Every PTY chunk goes through it: one for the module, not one per chunk.
const ENCODER = new TextEncoder()

const MIRROR_HIGH_WATER = 8 * 1024 * 1024
const MIRROR_LOW_WATER = 4 * 1024 * 1024

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
  // Spawn first: if it throws (no shell, bad cwd) no 5000-line mirror is left behind for the
  // life of the daemon.
  const pty = args.spawnPty({
    command: args.command,
    cwd: args.cwd,
    env: args.env,
    cols: args.cols,
    rows: args.rows,
  })

  const mirror = new Terminal({ cols: args.cols, rows: args.rows, scrollback: 5000, allowProposedApi: true })
  const serializer = new SerializeAddon()
  mirror.loadAddon(serializer)
  // The webview measures wide characters with Unicode 11; the mirror must agree or a snapshot
  // after Reload Window puts text and the cursor in different cells (emoji are 2 wide in 11).
  mirror.loadAddon(new Unicode11Addon())
  mirror.unicode.activeVersion = "11"

  const session = new Session(args.id, args.toolId, pty, mirror, serializer, args.schedule ?? setTimeout)
  // Seed with the spawn cwd: CLIs run via `$SHELL -ilc <cmd>` rarely emit OSC 7, and a
  // client attaching after Reload Window still needs a cwd (restart, path links).
  session.cwd = args.cwd
  return session
}
