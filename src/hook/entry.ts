// Runs as a Claude Code hook: reads the hook JSON from stdin, reports the mapped
// state to this window's daemon, and exits 0 no matter what — a hook must never
// block or fail the CLI, and must never print to stdout (Claude reads it).
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

let raw = ""
process.stdin.setEncoding("utf8")
process.stdin.on("data", (c) => (raw += c))
process.stdin.on("end", () => {
  let mapped: ReturnType<typeof mapHookEvent>
  try {
    mapped = mapHookEvent(JSON.parse(raw))
  } catch {
    process.exit(0)
  }
  if (!mapped) process.exit(0)
  const socket = net.createConnection(sock!)
  socket.on("error", () => process.exit(0))
  socket.on("connect", () => {
    socket.end(encodeJsonFrame(MSG.StatusReport, { sessionId, ...mapped! }), () =>
      process.exit(0),
    )
  })
})
