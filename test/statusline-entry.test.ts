import { afterEach, describe, expect, it } from "bun:test"
import { spawnSync } from "node:child_process"
import * as fs from "node:fs"
import * as net from "node:net"
import * as os from "node:os"
import * as path from "node:path"
import { STATUSLINE_COMMAND } from "../src/lib/claude-statusline.js"
import { createFrameDecoder, decodeJsonPayload, MSG } from "../src/lib/protocol.js"

let server: net.Server | undefined
afterEach(() => server?.close())

const PAYLOAD = JSON.stringify({ model: { id: "x" }, rate_limits: { five_hour: { used_percentage: 23, resets_at: 1 } } })

/** Runs the statusLine the way Claude does (sh -c, payload on stdin). */
async function run(opts: { input?: string; original?: string; from?: string; stampDir?: string } = {}) {
  const sock = path.join(os.tmpdir(), `cli-code-sl-${Math.random().toString(16).slice(2, 10)}.sock`)
  const frames: { type: number; body: { sessionId: string; rateLimits: unknown } }[] = []
  server = net.createServer((s) => {
    const decode = createFrameDecoder()
    s.on("data", (c) => frames.push(...decode(new Uint8Array(c)).map((f) => ({ type: f.type, body: decodeJsonPayload<{ sessionId: string; rateLimits: unknown }>(f.payload) }))))
  })
  await new Promise<void>((r) => server!.listen(sock, r))
  const entry = `"${process.execPath}" "${path.join(import.meta.dir, "../src/hook/statusline.ts")}"`
  const stampDir = opts.stampDir ?? fs.mkdtempSync(path.join(os.tmpdir(), "sl-stamp-"))
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    CLI_CODE_STATUSLINE: entry, CLI_CODE_DAEMON_SOCK: sock, CLI_CODE_SESSION_ID: "s1",
    CLI_CODE_FAMILY: opts.from ?? "claude", CLI_CODE_STATUSLINE_STAMP_DIR: stampDir,
  }
  if (opts.original !== undefined) env.CLI_CODE_STATUSLINE_ORIGINAL = Buffer.from(opts.original).toString("base64")
  const started = Date.now()
  const r = spawnSync("/bin/sh", ["-c", STATUSLINE_COMMAND], { input: opts.input ?? PAYLOAD, env })
  const elapsed = Date.now() - started
  await new Promise((res) => setTimeout(res, 50))
  return { status: r.status, stdout: r.stdout.toString(), frames, elapsed, stampDir }
}

describe("statusline entry", () => {
  it("reports rate_limits and passes the user's statusLine output through untouched", async () => {
    // A tricky original: quotes, $, and it reads the same stdin we got.
    const r = await run({ original: `printf '%s|' "it's \\$HOME"; cat | head -c 12` })
    expect(r.status).toBe(0)
    expect(r.stdout).toBe(`it's $HOME|${PAYLOAD.slice(0, 12)}`)
    expect(r.frames).toHaveLength(1)
    expect(r.frames[0]!.type).toBe(MSG.UsageReport)
    expect(r.frames[0]!.body).toMatchObject({ sessionId: "s1", rateLimits: { five_hour: { used_percentage: 23, resets_at: 1 } } })
  })
  it("no original statusLine → prints nothing, still reports", async () => {
    const r = await run()
    expect(r.stdout).toBe("")
    expect(r.frames).toHaveLength(1)
  })
  it("no rate_limits → no report; another family → no report", async () => {
    expect((await run({ input: '{"model":{}}' })).frames).toHaveLength(0)
    expect((await run({ from: "codex" })).frames).toHaveLength(0)
  })
  it("throttles to one report per 15 s per tab", async () => {
    const first = await run()
    server!.close()
    const second = await run({ stampDir: first.stampDir })
    expect(second.frames).toHaveLength(0)
  })
  it("a hanging or failing original cannot hold Claude up or fail it", async () => {
    const hang = await run({ original: "printf partial; sleep 30 & wait" })
    expect(hang.status).toBe(0)
    expect(hang.stdout).toBe("partial")
    expect(hang.elapsed).toBeLessThan(8000)
    const fail = await run({ original: "exit 3" })
    expect(fail.status).toBe(0)
  }, 15_000)
})
