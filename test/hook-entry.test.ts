import { afterEach, describe, expect, it } from "bun:test"
import { spawnSync } from "node:child_process"
import * as net from "node:net"
import * as os from "node:os"
import * as path from "node:path"
import { hookCommand } from "../src/lib/claude-hooks.js"
import { createFrameDecoder, decodeJsonPayload } from "../src/lib/protocol.js"

let server: net.Server | undefined
afterEach(() => server?.close())

/** Runs our hook command the way a CLI would (sh -c), with the tab's env; resolves to the number of reports the daemon socket got. */
async function reportsFrom(from: string, family: string): Promise<{ cliPid?: number }[]> {
  const sock = path.join(os.tmpdir(), `cli-code-hook-${Math.random().toString(16).slice(2, 10)}.sock`)
  const reports: { cliPid?: number }[] = []
  server = net.createServer((s) => {
    const decode = createFrameDecoder()
    s.on("data", (c) => reports.push(...decode(new Uint8Array(c)).map((f) => decodeJsonPayload<{ cliPid?: number }>(f.payload))))
  })
  await new Promise<void>((r) => server!.listen(sock, r))
  const hook = `"${process.execPath}" "${path.join(import.meta.dir, "../src/hook/entry.ts")}"`
  const r = spawnSync("/bin/sh", ["-c", hookCommand(from)], {
    input: JSON.stringify({ hook_event_name: "Stop", session_id: "x" }),
    env: { ...process.env, CLI_CODE_HOOK: hook, CLI_CODE_DAEMON_SOCK: sock, CLI_CODE_SESSION_ID: "s1", CLI_CODE_FAMILY: family },
  })
  expect(r.status).toBe(0)
  await new Promise((res) => setTimeout(res, 50))
  return reports
}

describe("hook entry — only the tab's own CLI reports", () => {
  it("a CLI started inside another (codex in a Claude tab) is ignored; the tab's CLI gets through", async () => {
    expect(await reportsFrom("codex", "claude")).toHaveLength(0)
    server!.close()
    expect(await reportsFrom("claude", "claude")).toHaveLength(1)
  })
  it("names the process that ran the hook command (the CLI), so the daemon can tell a nested same-kind CLI apart", async () => {
    // Here the "CLI" is this test process: it runs `sh -c <hook command>` like a CLI does.
    expect((await reportsFrom("claude", "claude"))[0]!.cliPid).toBe(process.pid)
  })
})
