import { describe, expect, it } from "bun:test"
import { HIGH_WATER } from "../src/lib/flow-control.js"
import { EscapeTracker, createSession, type PtyLike } from "../src/daemon/session.js"

function fakePty() {
  const calls = { written: [] as string[], resized: [] as [number, number][], paused: 0, resumed: 0, killed: 0 }
  let dataCb: (d: string) => void = () => {}
  let exitCb: (e: { exitCode: number; signal?: number }) => void = () => {}
  const pty: PtyLike = {
    onData: (cb) => (dataCb = cb),
    onExit: (cb) => (exitCb = cb),
    write: (d) => calls.written.push(d),
    resize: (c, r) => calls.resized.push([c, r]),
    kill: () => calls.killed++,
    pause: () => calls.paused++,
    resume: () => calls.resumed++,
  }
  return { pty, calls, emit: (d: string) => dataCb(d), die: (code: number) => exitCb({ exitCode: code }) }
}

function makeSession(schedule: (fn: () => void, ms: number) => unknown = (fn) => fn()) {
  const harness = fakePty()
  const session = createSession({
    id: "s1",
    toolId: "claude",
    command: "claude",
    cwd: "/tmp",
    env: {},
    cols: 80,
    rows: 24,
    spawnPty: () => harness.pty,
    schedule,
  })
  return { session, ...harness }
}

describe("Session", () => {
  it("clears a live model when a status report names a different conversation", () => {
    const { session } = makeSession()
    session.reportStatus("done", undefined, "original", { identityOnly: true, model: "old-model" })
    session.reportStatus("working", undefined, "selected")
    expect(session.model).toBeUndefined()
    session.dispose()
  })
  it("a live model change preserves activity and cannot be overwritten by a nested CLI", () => {
    const { session } = makeSession()
    const events: unknown[] = []
    session.onMeta((e) => events.push(e))
    session.reportStatus("working", "prompt", "selected", { fromHook: true, cliPid: 123 })
    session.reportStatus("done", undefined, "selected", { fromHook: true, cliPid: 123, identityOnly: true, model: "new-model" })
    expect(session.status?.state).toBe("working")
    expect(session.model).toBe("new-model")
    expect(events.at(-1)).toEqual({ kind: "model", model: "new-model", cliSessionId: "selected" })
    session.reportStatus("done", undefined, "nested", { fromHook: true, cliPid: 456, identityOnly: true, model: "wrong-model" })
    expect(session.model).toBe("new-model")
    session.dispose()
  })
  it("tracks session switches without changing agent status and rejects a nested CLI identity", () => {
    const { session } = makeSession()
    const events: unknown[] = []
    session.onMeta((e) => events.push(e))
    session.reportStatus("working", "prompt", "original", { fromHook: true, cliPid: 123 })
    session.reportStatus("done", undefined, "selected", { fromHook: true, cliPid: 123, identityOnly: true, cliSessionFile: "/custom/selected.jsonl" })
    expect(session.status?.state).toBe("working")
    expect(session.cliSessionId).toBe("selected")
    expect(events.at(-1)).toEqual({ kind: "cliSession", cliSessionId: "selected", cliSessionFile: "/custom/selected.jsonl" })
    session.reportStatus("done", undefined, "nested", { fromHook: true, cliPid: 456, identityOnly: true })
    expect(session.cliSessionId).toBe("selected")
    session.dispose()
  })
  it("chuyển output của PTY ra dạng byte", () => {
    const { session, emit } = makeSession()
    const chunks: Uint8Array[] = []
    session.onOutput((c) => chunks.push(c))
    emit("hello")
    expect(new TextDecoder().decode(chunks[0])).toBe("hello")
  })

  it("ghi input xuống PTY", () => {
    const { session, calls } = makeSession()
    session.write("ls\r")
    expect(calls.written).toEqual(["ls\r"])
  })

  it("chuyển tiếp resize", () => {
    const { session, calls } = makeSession()
    session.resize(120, 40)
    expect(calls.resized).toEqual([[120, 40]])
  })

  it("dừng PTY khi client chưa ack quá ngưỡng, chạy lại khi đã ack", () => {
    const { session, calls, emit } = makeSession()
    session.onOutput(() => {})
    emit("x".repeat(HIGH_WATER + 1))
    expect(calls.paused).toBe(1)
    session.ack(HIGH_WATER + 1)
    expect(calls.resumed).toBe(1)
  })

  it("ghi lại mã thoát và không còn nhận input nữa", () => {
    const { session, calls, die } = makeSession()
    die(3)
    expect(session.exit).toEqual({ code: 3, signal: undefined })
    session.write("ls\r")
    expect(calls.written).toEqual([])
  })

  it("onExit báo cho listener khi PTY thoát", () => {
    const { session, die } = makeSession()
    const seen: number[] = []
    session.onExit((e) => seen.push(e.code))
    die(7)
    expect(seen).toEqual([7])
  })

  it("kill() trên phiên đã thoát không đụng PTY", () => {
    const { session, calls, die } = makeSession()
    die(0)
    session.kill()
    expect(calls.killed).toBe(0)
  })

  it("cwd được seed từ spawn và vẫn bị OSC 7 ghi đè", () => {
    const harness = fakePty()
    const session = createSession({
      id: "s1",
      toolId: "claude",
      command: "claude",
      cwd: "/w",
      env: {},
      cols: 80,
      rows: 24,
      spawnPty: () => harness.pty,
      schedule: (fn) => fn(),
    })
    expect(session.cwd).toBe("/w")
    harness.emit("\x1b]7;file://h/x\x07")
    expect(session.cwd).toBe("/x")
  })

  it("snapshot dựng lại được nội dung đã in ra", async () => {
    const { session, emit } = makeSession()
    emit("xin chao")
    expect(await session.snapshot()).toContain("xin chao")
  })

  it("detach gỡ listener nhưng KHÔNG giết PTY — đây chính là điều giữ phiên sống qua reload", async () => {
    const { session, calls, emit } = makeSession()
    const chunks: Uint8Array[] = []
    session.onOutput((c) => chunks.push(c))
    session.detach()
    emit("sau khi detach")
    expect(chunks.length).toBe(0)
    expect(calls.killed).toBe(0)
    expect(await session.snapshot()).toContain("sau khi detach")
  })

  it("không có listener thì output không làm PTY bị pause — phiên detached không được kẹt", () => {
    const { session, calls, emit } = makeSession()
    emit("x".repeat(HIGH_WATER + 1))
    expect(calls.paused).toBe(0)
    session.onOutput(() => {})
    emit("x".repeat(HIGH_WATER + 1))
    expect(calls.paused).toBe(1)
  })

  it("attach gửi snapshot trước, rồi mới forward byte tới trong lúc chờ snapshot — không nhân đôi", async () => {
    const { session, emit } = makeSession()
    emit("cu")
    const order: string[] = []
    let snapshotText = ""
    const done = session.attach(
      (text) => {
        snapshotText = text
        order.push("snapshot")
      },
      (chunk) => order.push("data:" + new TextDecoder().decode(chunk)),
    )
    emit("moi")
    await done
    expect(order[0]).toBe("snapshot")
    expect(snapshotText).toContain("cu")
    expect(snapshotText).not.toContain("moi")
    expect(order.filter((o) => o === "data:moi").length).toBe(1)
  })

  it("detach xả hết coalescer để byte cũ không rò sang listener sau attach", async () => {
    let pending: (() => void) | undefined
    const { session, emit } = makeSession((fn) => (pending = fn))
    const first: string[] = []
    session.onOutput((c) => first.push(new TextDecoder().decode(c)))
    emit("truoc")
    expect(first).toEqual([])
    session.detach()
    expect(first).toEqual(["truoc"])
    const second: string[] = []
    await session.attach(
      () => {},
      (c) => second.push(new TextDecoder().decode(c)),
    )
    pending?.()
    expect(second).toEqual([])
  })

  it("detach trong lúc attach đang chờ snapshot thì attach không gắn listener", async () => {
    const { session, calls, emit } = makeSession()
    const got: string[] = []
    const done = session.attach(
      () => got.push("snapshot"),
      (c) => got.push("data:" + new TextDecoder().decode(c)),
    )
    session.detach()
    await done
    emit("x".repeat(HIGH_WATER + 1))
    expect(got).toEqual([])
    expect(calls.paused).toBe(0)
  })

  it("attach thứ hai thắng attach thứ nhất còn đang chờ", async () => {
    const { session, emit } = makeSession()
    const first: string[] = []
    const second: string[] = []
    const p1 = session.attach(() => first.push("snapshot"), (c) => first.push(new TextDecoder().decode(c)))
    session.detach()
    const p2 = session.attach(() => second.push("snapshot"), (c) => second.push(new TextDecoder().decode(c)))
    await Promise.all([p1, p2])
    emit("sau")
    expect(first).toEqual([])
    expect(second).toEqual(["snapshot", "sau"])
  })

  it("phát meta cwd/title từ OSC trong output và nhớ giá trị mới nhất", () => {
    const { session, emit } = makeSession()
    const seen: unknown[] = []
    session.onMeta((e) => seen.push(e))
    emit("\x1b]7;file://h/tmp/a\x07\x1b]0;Claude • fix\x07")
    expect(seen).toEqual([
      { kind: "cwd", cwd: "/tmp/a" },
      { kind: "title", title: "Claude • fix" },
    ])
    expect(session.cwd).toBe("/tmp/a")
    expect(session.oscTitle).toBe("Claude • fix")
  })

  it("OSC 9999 hợp lệ thành meta status, không hợp lệ thì bỏ qua", () => {
    const { session, emit } = makeSession()
    const seen: unknown[] = []
    session.onMeta((e) => seen.push(e))
    emit('\x1b]9999;{"state":"working","prompt":"sua bug"}\x07\x1b]9999;{"state":"nope"}\x07\x1b]9999;{\x07')
    expect(seen).toEqual([{ kind: "status", state: "working", prompt: "sua bug" }])
    expect(session.status).toEqual({ state: "working", prompt: "sua bug" })
  })

  it("reportStatus phát meta như OSC 9999", () => {
    const { session } = makeSession()
    const seen: unknown[] = []
    session.onMeta((e) => seen.push(e))
    session.reportStatus("done")
    expect(seen).toEqual([{ kind: "status", state: "done", prompt: undefined }])
  })

  it("toolDone chỉ kết thúc waiting khi đúng tool đang chờ permission; không bao giờ kéo done/working", () => {
    const { session } = makeSession()
    session.reportStatus("working", "p")
    session.reportStatus("waiting", undefined, undefined, { tool: "A" })
    // Notification permission_prompt (không có tool) là cùng một dialog.
    session.reportStatus("waiting")
    session.reportStatus("working", undefined, undefined, { toolDone: "B" }) // tool của subagent
    expect(session.status?.state).toBe("waiting")
    session.reportStatus("working", undefined, undefined, { toolDone: "A" })
    expect(session.status?.state).toBe("working")
    session.reportStatus("done")
    session.reportStatus("working", undefined, undefined, { toolDone: "C" }) // background agent sau Stop
    expect(session.status?.state).toBe("done")
    // waiting chỉ từ Notification (không biết tool): tool nào xong cũng kết thúc nó.
    session.reportStatus("waiting")
    session.reportStatus("working", undefined, undefined, { toolDone: "D" })
    expect(session.status?.state).toBe("working")
  })

  it("chỉ tiến trình CLI báo đầu tiên sở hữu tab: CLI cùng loại chạy lồng bên trong bị bỏ qua", () => {
    const { session } = makeSession()
    const hook = (cliPid?: number) => ({ fromHook: true, cliPid })
    session.reportStatus("working", "p", "tab-conv", hook(100))
    session.reportStatus("done", undefined, "nested-conv", hook(200)) // `claude -p` trong Bash tool
    expect(session.status).toEqual({ state: "working", prompt: "p", cliSessionId: "tab-conv" })
    session.reportStatus("done", undefined, undefined, hook(100))
    expect(session.status?.state).toBe("done")
    // Report không có PID (ps lỗi): vẫn được nhận.
    session.reportStatus("working", undefined, undefined, hook())
    expect(session.status?.state).toBe("working")
  })

  it("report đầu tiên không có PID (ps lỗi) thì không ghim: CLI lồng về sau không chiếm được tab", () => {
    const { session } = makeSession()
    session.reportStatus("working", "p", "tab-conv", { fromHook: true })
    session.reportStatus("working", undefined, undefined, { fromHook: true, cliPid: 200 })
    session.reportStatus("done", undefined, undefined, { fromHook: true, cliPid: 100 })
    expect(session.status?.state).toBe("done")
  })

  it("PostToolBatch của đúng agent kết thúc waiting, kể cả khi tool bị từ chối (không có PostToolUse khớp)", () => {
    const { session } = makeSession()
    session.reportStatus("working", "p")
    session.reportStatus("waiting", undefined, undefined, { tool: "A", agent: "main" })
    session.reportStatus("working", undefined, undefined, { agentDone: "sub-1" }) // batch của subagent
    expect(session.status?.state).toBe("waiting")
    session.reportStatus("working", undefined, undefined, { agentDone: "main" }) // user bấm deny
    expect(session.status?.state).toBe("working")
    session.reportStatus("done")
    session.reportStatus("working", undefined, undefined, { agentDone: "main" }) // đến trễ sau Stop
    expect(session.status?.state).toBe("done")
  })

  it("detach gỡ meta listener", () => {
    const { session, emit } = makeSession()
    const seen: unknown[] = []
    session.onMeta((e) => seen.push(e))
    session.detach()
    emit("\x1b]0;x\x07")
    expect(seen).toEqual([])
    expect(session.oscTitle).toBe("x")
  })
})

describe("Session mirror — same Unicode width rules as the webview (Unicode 11)", () => {
  it("an emoji is two cells wide, so text written after it lands where the webview puts it", async () => {
    const { session, emit } = makeSession()
    // A😀B, then CR and a cursor jump to column 4 (1-based), then X. Unicode 11: A|😀😀|B → X replaces B.
    emit("A\u{1F600}B\r\x1b[4GX")
    let snapshot = ""
    await session.attach((s) => (snapshot = s), () => {})
    expect(snapshot).toContain("A\u{1F600}X")
    expect(snapshot).not.toContain("BX")
  })
})

describe("Session snapshot — mouse encoding", () => {
  it("restores SGR mouse encoding (1006) along with tracking, so clicks after a reload use the same format", async () => {
    const { session, emit } = makeSession()
    emit("\x1b[?1000h\x1b[?1006h")
    let snapshot = ""
    await session.attach((s) => (snapshot = s), () => {})
    expect(snapshot).toContain("\x1b[?1000h")
    expect(snapshot).toContain("\x1b[?1006h")
  })
  it("adds nothing when the default encoding is active", async () => {
    const { session, emit } = makeSession()
    emit("\x1b[?1000h")
    let snapshot = ""
    await session.attach((s) => (snapshot = s), () => {})
    expect(snapshot).not.toContain("\x1b[?1006h")
  })
})

describe("Session snapshot — scroll region", () => {
  it("restores a DECSTBM region and the cursor, so a newline at the region's bottom leaves the footer alone", async () => {
    const { session, emit } = makeSession()
    // Header on row 1, footer on row 24, region 2..23, cursor at the region's last row.
    emit("\x1b[1;1HHEADER\x1b[24;1HFOOTER\x1b[2;23r\x1b[23;5H")
    let snapshot = ""
    await session.attach((s) => (snapshot = s), () => {})
    const { Terminal } = await import("@xterm/headless")
    const replay = new Terminal({ cols: 80, rows: 24, allowProposedApi: true })
    await new Promise<void>((r) => replay.write(snapshot, r))
    expect(replay.buffer.active.cursorY).toBe(22)
    expect(replay.buffer.active.cursorX).toBe(4)
    await new Promise<void>((r) => replay.write("\nnew", r))
    const line = (y: number) => replay.buffer.active.getLine(y)!.translateToString(true)
    expect(line(0)).toBe("HEADER")
    expect(line(23)).toBe("FOOTER")
    replay.dispose()
  })
  it("under origin mode (DECOM) the cursor goes back to the same absolute row", async () => {
    const { session, emit } = makeSession()
    // Region 3..8, origin mode on, cursor at region row 2 = absolute row 4.
    emit("\x1b[3;8r\x1b[?6h\x1b[2;5H")
    let snapshot = ""
    await session.attach((s) => (snapshot = s), () => {})
    const { Terminal } = await import("@xterm/headless")
    const replay = new Terminal({ cols: 80, rows: 24, allowProposedApi: true })
    await new Promise<void>((r) => replay.write(snapshot, r))
    expect(replay.buffer.active.cursorY).toBe(3)
    expect(replay.buffer.active.cursorX).toBe(4)
    expect(replay.modes.originMode).toBe(true)
    replay.dispose()
  })
  it("adds nothing for the full-screen default region", async () => {
    const { session, emit } = makeSession()
    emit("hello")
    let snapshot = ""
    await session.attach((s) => (snapshot = s), () => {})
    expect(snapshot).not.toMatch(/\x1b\[\d+;\d+r/)
  })
})

describe("Session snapshot — OSC 8 links survive a reload", () => {
  it("a link whose label holds no URL is clickable again after the snapshot is replayed", async () => {
    const { createSnapshotLinks } = await import("../src/webview/links.js")
    const { Terminal } = await import("@xterm/headless")
    const { session, emit } = makeSession()
    emit("see \x1b]8;id=1;https://example.com/report\x07Read report\x1b]8;;\x07 now\r\n".repeat(1) + "next line\r\n")
    let snapshot = ""
    await session.attach((s) => (snapshot = s), () => {})
    const replay = new Terminal({ cols: 80, rows: 24, allowProposedApi: true })
    const opened: string[] = []
    const links = createSnapshotLinks(replay as never, (_e, uri) => opened.push(uri), () => {}, () => {})
    links.begin()
    await new Promise<void>((r) => replay.write(snapshot, r))
    links.end()
    const found = await new Promise<{ text: string; range: unknown; activate(e: unknown, t: string): void }[]>((r) =>
      links.provider.provideLinks(1, (l) => r((l ?? []) as never)),
    )
    expect(found.map((l) => [l.text, l.range])).toEqual([["https://example.com/report", { start: { x: 5, y: 1 }, end: { x: 15, y: 1 } }]])
    found[0]!.activate({}, "")
    expect(opened).toEqual(["https://example.com/report"])
    // Overwriting the label drops the link; a CLI printing the private OSC itself places none.
    await new Promise<void>((r) => replay.write("\x1b[1;5HXXXXXXXXXXX\x1b]9998;[[0,0,4,\"https://evil\"]]\x07", r))
    const after = await new Promise<unknown[]>((r) => links.provider.provideLinks(1, (l) => r(l ?? [])))
    expect(after).toEqual([])
    replay.dispose()
  })
})

describe("Session — exit after the last output", () => {
  it("the CLI's final bytes reach the client before the exit notice", () => {
    const pending: (() => void)[] = []
    const { session, emit, die } = makeSession((fn) => pending.push(fn))
    const events: string[] = []
    session.onOutput((c) => events.push(`data:${new TextDecoder().decode(c)}`))
    session.onExit(() => events.push("exit"))
    emit("last line\r\n")
    die(0)
    expect(events).toEqual(["data:last line\r\n", "exit"])
  })
})

describe("Session snapshot — OSC 8 links on the alternate screen", () => {
  it("a full-screen TUI's link is clickable again after a reload", async () => {
    const { createSnapshotLinks } = await import("../src/webview/links.js")
    const { Terminal } = await import("@xterm/headless")
    const { session, emit } = makeSession()
    emit("\x1b[?1049h\x1b[3;1Hsee \x1b]8;;https://example.com/report\x07Read report\x1b]8;;\x07")
    let snapshot = ""
    await session.attach((s) => (snapshot = s), () => {})
    const replay = new Terminal({ cols: 80, rows: 24, allowProposedApi: true })
    const links = createSnapshotLinks(replay as never, () => {}, () => {}, () => {})
    links.begin()
    await new Promise<void>((r) => replay.write(snapshot, r))
    links.end()
    expect(replay.buffer.active.type).toBe("alternate")
    const found = await new Promise<{ text: string; range: unknown }[]>((r) => links.provider.provideLinks(3, (l) => r((l ?? []) as never)))
    expect(found.map((l) => [l.text, l.range])).toEqual([["https://example.com/report", { start: { x: 5, y: 3 }, end: { x: 15, y: 3 } }]])
    // The TUI scrolls its screen up a line (CSI 1 S): the link moves with its text, to row 2.
    await new Promise<void>((r) => replay.write("\x1b[1S", r))
    expect(await new Promise<unknown[]>((r) => links.provider.provideLinks(3, (l) => r(l ?? [])))).toEqual([])
    const moved = await new Promise<{ range: unknown }[]>((r) => links.provider.provideLinks(2, (l) => r((l ?? []) as never)))
    expect(moved.map((l) => l.range)).toEqual([{ start: { x: 5, y: 2 }, end: { x: 15, y: 2 } }])
    // Leaving the alternate screen drops them: the normal screen has other text on those rows.
    await new Promise<void>((r) => replay.write("\x1b[?1049l", r))
    expect(await new Promise<unknown[]>((r) => links.provider.provideLinks(3, (l) => r(l ?? [])))).toEqual([])
    replay.dispose()
  })
})

describe("Session snapshot — same-label links on the alternate screen keep their own targets", () => {
  it("two 'Read report' links (A, B) on adjacent rows: after a scroll each row still opens its own URL", async () => {
    const { createSnapshotLinks } = await import("../src/webview/links.js")
    const { Terminal } = await import("@xterm/headless")
    const { session, emit } = makeSession()
    const link = (uri: string) => `\x1b]8;;${uri}\x07Read report\x1b]8;;\x07`
    emit(`\x1b[?1049h\x1b[3;1H${link("https://a")}\x1b[4;1H${link("https://b")}`)
    let snapshot = ""
    await session.attach((s) => (snapshot = s), () => {})
    const replay = new Terminal({ cols: 80, rows: 24, allowProposedApi: true })
    const links = createSnapshotLinks(replay as never, () => {}, () => {}, () => {})
    links.begin()
    await new Promise<void>((r) => replay.write(snapshot, r))
    links.end()
    const at = (y: number) => new Promise<string[]>((r) => links.provider.provideLinks(y, (l) => r((l ?? []).map((x) => x.text))))
    expect([await at(3), await at(4)]).toEqual([["https://a"], ["https://b"]])
    await new Promise<void>((r) => replay.write("\x1b[1S", r))
    expect([await at(2), await at(3), await at(4)]).toEqual([["https://a"], ["https://b"], []])
    // Inside a scroll region (rows 1..3, now [blank, A, B]) two lines up: A scrolls off, B
    // reaches row 1 and keeps its own URL.
    await new Promise<void>((r) => replay.write("\x1b[1;3r\x1b[2S\x1b[r", r))
    expect([await at(1), await at(2), await at(3)]).toEqual([["https://b"], [], []])
    replay.dispose()
  })
})

describe("Session snapshot — a recycled alternate-screen line does not keep its old link", () => {
  it("a scroll that reuses the top line for new plain text 'Read report' at the bottom has no link there", async () => {
    const { createSnapshotLinks } = await import("../src/webview/links.js")
    const { Terminal } = await import("@xterm/headless")
    const { session, emit } = makeSession()
    emit("\x1b[?1049h\x1b[1;1H\x1b]8;;https://a\x07Read report\x1b]8;;\x07")
    let snapshot = ""
    await session.attach((s) => (snapshot = s), () => {})
    const replay = new Terminal({ cols: 80, rows: 24, allowProposedApi: true })
    const links = createSnapshotLinks(replay as never, () => {}, () => {}, () => {})
    links.begin()
    await new Promise<void>((r) => replay.write(snapshot, r))
    links.end()
    const at = (y: number) => new Promise<string[]>((r) => links.provider.provideLinks(y, (l) => r((l ?? []).map((x) => x.text))))
    expect(await at(1)).toEqual(["https://a"])
    await new Promise<void>((r) => replay.write("\x1b[24;1H\r\nRead report", r))
    expect(replay.buffer.active.getLine(23)!.translateToString(true)).toBe("Read report")
    expect([await at(1), await at(24)]).toEqual([[], []])
    replay.dispose()
  })
})

describe("Session — the mirror holds back a flood like a slow client would", () => {
  it("a detached tab flooding output pauses its PTY until the mirror caught up, instead of overflowing xterm", async () => {
    const harness = fakePty()
    // Small marks, same mechanism as the real 8 MB / 4 MB: well past them, the PTY pauses; once
    // the mirror has parsed its backlog, it resumes on its own (no client to ack anything).
    const session = createSession({ id: "s", toolId: "c", command: "c", cwd: "/tmp", env: {}, cols: 80, rows: 24, spawnPty: () => harness.pty, schedule: (fn) => fn(), mirrorWater: { high: 64 * 1024, low: 32 * 1024 } })
    const chunk = "x".repeat(16 * 1024)
    for (let i = 0; i < 8; i++) harness.emit(chunk)
    expect(harness.calls.paused).toBe(1)
    await session.snapshot()
    expect(harness.calls.resumed).toBe(1)
    session.dispose()
  })
})

describe("Session snapshot — a resize keeps the alternate-screen links still on screen", () => {
  it("shrinking the screen by a row with the link on the last row keeps the link on the row it moved to", async () => {
    const { createSnapshotLinks } = await import("../src/webview/links.js")
    const { Terminal } = await import("@xterm/headless")
    const { session, emit } = makeSession()
    emit("\x1b[?1049h\x1b[24;1H\x1b]8;;https://a\x07Read report\x1b]8;;\x07")
    let snapshot = ""
    await session.attach((s) => (snapshot = s), () => {})
    const replay = new Terminal({ cols: 80, rows: 24, allowProposedApi: true })
    const links = createSnapshotLinks(replay as never, () => {}, () => {}, () => {})
    links.begin()
    await new Promise<void>((r) => replay.write(snapshot, r))
    links.end()
    const at = (y: number) => new Promise<string[]>((r) => links.provider.provideLinks(y, (l) => r((l ?? []).map((x) => x.text))))
    expect(await at(24)).toEqual(["https://a"])
    replay.resize(80, 23)
    expect(replay.buffer.active.getLine(22)!.translateToString(true)).toBe("Read report")
    expect(await at(23)).toEqual(["https://a"])
    replay.dispose()
  })
})

describe("Session — terminal queries while no client is attached", () => {
  it("a detached session answers ESC[6n from the mirror; an attached one leaves it to the webview", async () => {
    const { session, calls, emit } = makeSession()
    emit("ab\x1b[6n")
    await session.snapshot() // the mirror has parsed everything written so far
    expect(calls.written).toEqual(["\x1b[1;3R"])
    session.onOutput(() => {})
    emit("\x1b[6n")
    await session.snapshot()
    expect(calls.written).toEqual(["\x1b[1;3R"])
  })
  it("a query that arrived detached is answered even when an attach starts before the mirror parsed it", async () => {
    const { session, calls, emit } = makeSession()
    emit("ab\x1b[6n")
    // The attach begins at once — before the mirror got to the query.
    await session.attach(() => {}, () => {})
    expect(calls.written).toEqual(["\x1b[1;3R"])
  })
  it("a query split across the attach (ESC[6 detached, n attached): the client gets the whole of it, and answers", async () => {
    const { session, calls, emit } = makeSession()
    emit("ab\x1b[6")
    const got: string[] = []
    await session.attach(() => {}, (c) => got.push(new TextDecoder().decode(c)))
    emit("n")
    await session.snapshot()
    // The client's parser sees ESC[6n (no stray "n" on its screen) and is the one to answer;
    // the mirror, for a sequence completed while attached, stays quiet.
    expect(got.join("")).toBe("\x1b[6n")
    expect(calls.written).toEqual([])
  })
  it("a query held for an attach that is then cancelled (detach) is answered by the mirror", async () => {
    const { session, calls, emit } = makeSession()
    const attaching = session.attach(() => {}, () => {})
    emit("ab\x1b[6n") // held for the attach: it waits on its snapshot
    session.detach()
    await attaching
    await session.snapshot()
    expect(calls.written).toEqual(["\x1b[1;3R"])
  })
  it("a query held for an attach that completes is the client's: the mirror stays quiet", async () => {
    const { session, calls, emit } = makeSession()
    const got: string[] = []
    const attaching = session.attach(() => {}, (c) => got.push(new TextDecoder().decode(c)))
    emit("ab\x1b[6n")
    await attaching
    await session.snapshot()
    expect(got.join("")).toContain("\x1b[6n")
    expect(calls.written).toEqual([])
  })
  it("a query that arrived while attached, answered by the webview, is not answered again after a detach", async () => {
    const { session, calls, emit } = makeSession()
    session.onOutput(() => {})
    emit("ab\x1b[6n")
    session.detach()
    await session.snapshot()
    expect(calls.written).toEqual([])
  })
})

describe("EscapeTracker", () => {
  const pending = (...chunks: string[]) => {
    const t = new EscapeTracker()
    for (const c of chunks) t.feed(c)
    return t.pending()
  }
  it("holds the sequence the stream is in the middle of, and nothing in plain text", () => {
    expect(pending("ab\x1b[6")).toBe("\x1b[6")
    expect(pending("ab\x1b[6", "n")).toBe("")
    expect(pending("x\x1b")).toBe("\x1b")
    expect(pending("\x1b]11;?")).toBe("\x1b]11;?")
    expect(pending("\x1b]11;?\x07")).toBe("")
    expect(pending("\x1b]0;t\x1b", "\\")).toBe("")
    expect(pending("\x1b(")).toBe("\x1b(")
    expect(pending("\x1b(B")).toBe("")
    expect(pending("plain text")).toBe("")
  })
  it("CAN/SUB abort a sequence; a C0 control inside one is executed, not replayed", () => {
    expect(pending("\x1b[31\x18hello")).toBe("")
    expect(pending("\x1b[31\x1ahello")).toBe("")
    expect(pending("\x1b[6\n")).toBe("\x1b[6")
    expect(pending("\x1b]0;a\x1b[1")).toBe("\x1b[1")
    // ESC ends a string on the spot (the parser handles it then): only the ESC is pending.
    expect(pending("\x1bP$qm\x1b")).toBe("\x1b")
    // …but an OSC is kept whole until its ST completes: its effect (OSC 52) is the client's.
    expect(pending("\x1b]52;c;aGk=\x1b")).toBe("\x1b]52;c;aGk=\x1b")
    expect(pending("\x1b]52;c;aGk=\x1b", "\\")).toBe("")
  })
})

describe("Session attach — what the client ends up showing and answering", () => {
  async function attachAndReplay(detached: string, attached: string) {
    const { Terminal } = await import("@xterm/headless")
    const { session, calls, emit } = makeSession()
    emit(detached)
    const client = new Terminal({ cols: 80, rows: 24, allowProposedApi: true })
    const answers: string[] = []
    client.onData((d) => answers.push(d))
    const writes: Promise<void>[] = []
    const write = (s: string) => writes.push(new Promise<void>((r) => client.write(s, r)))
    await session.attach(write, (c) => write(new TextDecoder().decode(c)))
    emit(attached)
    await session.snapshot()
    await Promise.all(writes)
    const screen = [0, 1, 2].map((y) => client.buffer.active.getLine(y)!.translateToString(true))
    client.dispose()
    return { screen, answers, mirrorAnswers: calls.written }
  }
  it("a CSI aborted by CAN before the attach does not replay the text after it", async () => {
    const r = await attachAndReplay("\x1b[31\x18hello", "")
    expect(r.screen[0]).toBe("hello")
  })
  it("a query with a newline inside, split across the attach, is answered once, at the right place", async () => {
    const r = await attachAndReplay("ab\x1b[6\n", "n")
    expect(r.screen.slice(0, 2)).toEqual(["ab", ""])
    expect([...r.answers, ...r.mirrorAnswers]).toEqual(["\x1b[2;3R"])
  })
  it("every split point around the attach: the same screen and the same answers as one terminal fed it whole", async () => {
    const { Terminal } = await import("@xterm/headless")
    const cases = [
      "ab\x1b[6nc",
      "x\x1b[31\x18hello",
      "ab\x1b[6\nn",
      "\x1bP$qm\x1b\\z",
      "\x1b]11;?\x07t",
      // Answered by the client alone (headless xterm 5.5 does not answer OSC 10/11): if a later
      // xterm makes the mirror answer too, a split at the ESC of its ST would answer twice.
      "\x1b]11;?\x1b\\u",
      "\x1b]0;title\x1b\\q",
      "\x1b[?1;2c\x1b[5n",
      "\x1b(Bk\x1b[c",
    ]
    for (const whole of cases) {
      const ref = new Terminal({ cols: 80, rows: 24, allowProposedApi: true })
      const refAnswers: string[] = []
      ref.onData((d) => refAnswers.push(d))
      await new Promise<void>((r) => ref.write(whole, r))
      const refScreen = [0, 1, 2].map((y) => ref.buffer.active.getLine(y)!.translateToString(true))
      ref.dispose()
      for (let i = 1; i < whole.length; i++) {
        const r = await attachAndReplay(whole.slice(0, i), whole.slice(i))
        expect({ at: `${JSON.stringify(whole)}@${i}`, screen: r.screen, answers: [...r.mirrorAnswers, ...r.answers].sort() }).toEqual({
          at: `${JSON.stringify(whole)}@${i}`,
          screen: refScreen,
          answers: [...refAnswers].sort(),
        })
      }
    }
  })
  it("a DCS query cut between the ESC and the \\ of its terminator is answered once", async () => {
    const r = await attachAndReplay("\x1bP$qm\x1b", "\\")
    expect([...r.answers, ...r.mirrorAnswers]).toEqual(["\x1bP1$r0m\x1b\\"])
  })
  it("a query split across the attach: shown once, answered once", async () => {
    const r = await attachAndReplay("ab\x1b[6", "n")
    expect(r.screen[0]).toBe("ab")
    expect([...r.answers, ...r.mirrorAnswers]).toEqual(["\x1b[1;3R"])
  })
})

describe("Session snapshot — OSC 8 links anywhere in the scrollback, wrapped too", () => {
  it("a link far up the scrollback and one wrapped over two rows are both restored whole", async () => {
    const { createSnapshotLinks } = await import("../src/webview/links.js")
    const { Terminal } = await import("@xterm/headless")
    const { session, emit } = makeSession()
    const long = "L".repeat(100)
    emit(`\x1b]8;;https://top\x07top\x1b]8;;\x07\r\n` + "filler\r\n".repeat(60) + `\x1b]8;;https://wrap\x07${long}\x1b]8;;\x07\r\n`)
    let snapshot = ""
    await session.attach((s) => (snapshot = s), () => {})
    const replay = new Terminal({ cols: 80, rows: 24, allowProposedApi: true, scrollback: 5000 })
    const links = createSnapshotLinks(replay as never, () => {}, () => {}, () => {})
    links.begin()
    await new Promise<void>((r) => replay.write(snapshot, r))
    links.end()
    const buf = replay.buffer.active
    const found: string[] = []
    for (let y = 1; y <= buf.length; y++) {
      await new Promise<void>((r) => links.provider.provideLinks(y, (l) => (found.push(...(l ?? []).map((x) => `${x.text}@${y}:${x.range.start.x}-${x.range.end.x}`)), r())))
    }
    const wrapRow = found.find((f) => f.startsWith("https://wrap"))!
    expect(found.filter((f) => f.startsWith("https://top"))).toHaveLength(1)
    // 100 cells over an 80-column screen: one run of 80 on its first row, 20 on the next.
    expect(found.filter((f) => f.startsWith("https://wrap")).map((f) => f.slice(f.lastIndexOf(":") + 1))).toEqual(["1-80", "1-20"])
    expect(wrapRow).toBeDefined()
    replay.dispose()
  })
})

describe("Session snapshot — links moved by a scroll inside a region", () => {
  const linksIn = (snap: string) => /\x1b\]9998;([^\x07]*)\x07/.exec(snap)?.[1] ?? ""
  it("a link a TUI scrolled up inside its DECSTBM region is still in the snapshot, on its new row", async () => {
    const { session, emit } = makeSession()
    emit("\x1b[5;20r\x1b[10;1H\x1b]8;;https://a\x07LINK\x1b]8;;\x07\x1b[20;1H\n\n")
    const runs = JSON.parse(linksIn(await session.snapshot())) as [number, number, number, string][]
    // Row 10 (index 9) moved up two, to index 7; the cursor sits on index 19.
    expect(runs).toEqual([[7 - 19, 0, 4, "https://a"]])
  })
  it("a region-scrolled link that later scrolls into the scrollback is still in the snapshot", async () => {
    const { session, emit } = makeSession()
    const link = "\x1b]8;;https://a\x07LINK\x1b]8;;\x07"
    emit(`\x1b[10;1H${link}\x1b[5;15r\x1b[15;1H\n\n\x1b[r\x1b[24;1H` + "\r\nmore".repeat(30))
    const snap = await session.snapshot()
    expect(linksIn(snap)).toContain("https://a")
  })
  it("the same on the alternate screen, and for a reverse scroll (RI at the region's top)", async () => {
    const link = "\x1b]8;;https://a\x07LINK\x1b]8;;\x07"
    const runsOf = async (text: string) => {
      const { session, emit } = makeSession()
      emit(text)
      return JSON.parse(linksIn(await session.snapshot())) as [number, number, number, string][]
    }
    // Region rows 5..15; the link printed on row 10, the region scrolled up two; cursor on row 15.
    expect(await runsOf(`\x1b[?1049h\x1b[5;15r\x1b[10;1H${link}\x1b[15;1H\n\n`)).toEqual([[7 - 14, 0, 4, "https://a"]])
    // Reverse index at the region's top twice: the link moves down to row 12; cursor on row 5.
    expect(await runsOf(`\x1b[5;15r\x1b[10;1H${link}\x1b[5;1H\x1bM\x1bM`)).toEqual([[11 - 4, 0, 4, "https://a"]])
  })
})
