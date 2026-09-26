// Runs as a Claude Code hook: reads the hook JSON from stdin, reports the mapped
// state to this window's daemon, and exits 0 no matter what — a hook must never
// block or fail the CLI, and must never print to stdout (Claude reads it).
import { execFile } from "node:child_process"
import * as net from "node:net"
import { mapHookEvent } from "../lib/hook-map.js"
import { MSG, encodeJsonFrame } from "../lib/protocol.js"

const sock = process.env.CLI_CODE_DAEMON_SOCK
const sessionId = process.env.CLI_CODE_SESSION_ID
// Not unref'd: process.stdin may never emit "end" if Claude passes no stdin, so this
// deadline must be able to fire on its own to guarantee the hook exits.
const deadline = setTimeout(() => process.exit(0), 1000)

if (!sock || !sessionId) process.exit(0)
// Everything a CLI starts inherits the tab's env, so a CLI run from inside another (a
// `codex exec` in Claude's Bash tool) reaches this hook too: only the tab's own CLI may report.
// A hook without CLI_CODE_FROM was installed by an older build and is let through.
const from = process.env.CLI_CODE_FROM
const family = process.env.CLI_CODE_FAMILY
if (from && family && from !== family) process.exit(0)

/**
 * The process that ran this hook — our parent's parent, since the CLI runs the hook command
 * through a shell (`sh -c` → this). The daemon keeps the first one it hears from per tab: a CLI
 * of the same kind started inside the tab's (`claude -p` from Claude's Bash tool) is another
 * process, and its reports are dropped. Undefined when ps cannot say; the report still counts.
 * Asked right away, while stdin is still being read: a synchronous hook (UserPromptSubmit, Stop)
 * holds the CLI up for as long as this process runs.
 */
const reporterPid = new Promise<number | undefined>((resolve) => {
  execFile("ps", ["-o", "ppid=", "-p", String(process.ppid)], { encoding: "utf8", timeout: 500 }, (err, out) => {
    const pid = err ? NaN : Number(out.trim())
    resolve(Number.isInteger(pid) && pid > 1 ? pid : undefined)
  })
})

let raw = ""
process.stdin.setEncoding("utf8")
process.stdin.on("data", (c) => (raw += c))
process.stdin.on("end", () => {
  let mapped: ReturnType<typeof mapHookEvent>
  try {
    mapped = mapHookEvent(JSON.parse(raw), from)
  } catch {
    process.exit(0)
  }
  if (!mapped) process.exit(0)
  void reporterPid.then((cliPid) => {
    const socket = net.createConnection(sock!)
    socket.on("error", () => process.exit(0))
    socket.on("connect", () => {
      socket.end(encodeJsonFrame(MSG.StatusReport, { sessionId, ...mapped!, cliPid }), () => process.exit(0))
    })
  })
})
