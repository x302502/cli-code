import { describe, expect, it } from "bun:test"
import { HIGH_WATER } from "../src/lib/flow-control.js"
import { createSession, type PtyLike } from "../src/daemon/session.js"

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
    const { session, calls, emit } = makeSession()
    const chunk = "x".repeat(1024 * 1024)
    for (let i = 0; i < 9; i++) emit(chunk)
    expect(calls.paused).toBe(1)
    const deadline = Date.now() + 20_000
    while (calls.resumed === 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20))
    expect(calls.resumed).toBe(1)
    session.dispose()
  }, 30_000)
})
