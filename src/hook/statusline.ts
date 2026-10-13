// Claude's statusLine in CLI Code's Claude tabs: reports the plan limits Claude passes on stdin to
// this window's daemon, then runs the user's own statusLine with the same stdin and passes its
// output through. Never fails and never holds Claude up for long: Claude shows our stdout.
import { spawn } from "node:child_process"
import * as fs from "node:fs"
import * as net from "node:net"
import * as os from "node:os"
import * as path from "node:path"
import { MSG, encodeJsonFrame } from "../lib/protocol.js"

const REPORT_EVERY_MS = 15_000
const ORIGINAL_TIMEOUT_MS = 5_000
const sock = process.env.CLI_CODE_DAEMON_SOCK
const sessionId = process.env.CLI_CODE_SESSION_ID
const from = process.env.CLI_CODE_FROM
const family = process.env.CLI_CODE_FAMILY
const original = process.env.CLI_CODE_STATUSLINE_ORIGINAL ? Buffer.from(process.env.CLI_CODE_STATUSLINE_ORIGINAL, "base64").toString("utf8") : ""

// stdin may never end if Claude passes none: this deadline guarantees an exit.
setTimeout(() => process.exit(0), ORIGINAL_TIMEOUT_MS + 2_000)

/** At most one report per tab every 15 s: Claude redraws its statusLine often. */
function dueForReport(): boolean {
  const stamp = path.join(process.env.CLI_CODE_STATUSLINE_STAMP_DIR ?? os.tmpdir(), `cli-code-statusline-${sessionId}`)
  try {
    if (Date.now() - fs.statSync(stamp).mtimeMs < REPORT_EVERY_MS) return false
  } catch {
    // no stamp yet
  }
  try {
    fs.writeFileSync(stamp, "")
  } catch {
    // unwritable tmpdir: report anyway
  }
  return true
}

function report(raw: string): Promise<void> {
  if (!sock || !sessionId || (from && family && from !== family) || !raw.includes('"rate_limits"')) return Promise.resolve()
  let rateLimits: unknown
  try {
    rateLimits = (JSON.parse(raw) as { rate_limits?: unknown }).rate_limits
  } catch {
    return Promise.resolve()
  }
  if (!rateLimits || !dueForReport()) return Promise.resolve()
  return new Promise((resolve) => {
    const socket = net.createConnection(sock)
    socket.on("error", () => resolve())
    socket.on("connect", () => socket.end(encodeJsonFrame(MSG.UsageReport, { sessionId, rateLimits }), () => resolve()))
    setTimeout(resolve, 1_000)
  })
}

function forward(raw: string): Promise<void> {
  if (!original) return Promise.resolve()
  return new Promise((resolve) => {
    const child = spawn("/bin/sh", ["-c", original], { stdio: ["pipe", "inherit", "ignore"], detached: true })
    const timer = setTimeout(() => {
      // Kill the whole group: a grandchild would keep our inherited stdout open and hold Claude up.
      try {
        process.kill(-child.pid!, "SIGKILL")
      } catch {
        // already gone
      }
    }, ORIGINAL_TIMEOUT_MS)
    child.on("error", () => resolve())
    child.on("close", () => {
      clearTimeout(timer)
      resolve()
    })
    child.stdin.on("error", () => {})
    child.stdin.end(raw)
  })
}

let raw = ""
process.stdin.setEncoding("utf8")
process.stdin.on("data", (c) => (raw += c))
process.stdin.on("end", () => {
  void Promise.all([report(raw), forward(raw)]).finally(() => process.exit(0))
})
