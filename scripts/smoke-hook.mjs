// Manual run: node scripts/smoke-hook.mjs
// (or: CLI_CODE_NODE="/Applications/Visual Studio Code.app/Contents/MacOS/Code" node scripts/smoke-hook.mjs)
// Starts a real daemon (like smoke-daemon), spawns a session via Hello, then runs the
// real dist/hook.js bundle against it and confirms a Status frame reaches the session
// socket within 2s and the hook process exits 0.
import * as net from "node:net"
import * as os from "node:os"
import * as path from "node:path"
import * as fs from "node:fs"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

const runtime = process.env.CLI_CODE_NODE ?? "node"
const daemonPath = fileURLToPath(new URL("../dist/daemon.js", import.meta.url))
const hookPath = fileURLToPath(new URL("../dist/hook.js", import.meta.url))
const socketPath = path.join(os.tmpdir(), `cli-code-smoke-hook-${Date.now()}.sock`)
const DEADLINE_MS = 5000
const started = Date.now()

const daemon = spawn(runtime, [daemonPath, socketPath], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  stdio: "inherit",
})

let done = false
let statusSeen = false
let hookExited = false
const watchdog = setTimeout(() => fail("timed out waiting for Status frame"), DEADLINE_MS)

function cleanup() {
  clearTimeout(watchdog)
  daemon.kill()
  fs.rmSync(socketPath, { force: true })
}

function pass() {
  if (done) return
  done = true
  console.log("PASS: dist/hook.js reports Status to the daemon over the session socket")
  cleanup()
  process.exit(0)
}

function fail(reason) {
  if (done) return
  done = true
  console.error(`FAIL: ${reason}`)
  cleanup()
  process.exit(1)
}

daemon.on("error", (err) => fail(`daemon spawn error: ${err.message}`))

function tryConnect() {
  const socket = net.createConnection(socketPath)
  socket.once("connect", () => {
    socket.removeAllListeners("error")
    socket.on("error", (err) => fail(`socket error: ${err.message}`))

    const hello = { op: "spawn", toolId: "shell", command: "sleep 5", cwd: process.cwd(), env: {}, cols: 80, rows: 24 }
    const payload = Buffer.from(JSON.stringify(hello))
    const frame = Buffer.alloc(5 + payload.length)
    frame[0] = 1 // MSG.Hello
    frame.writeUInt32BE(payload.length, 1)
    payload.copy(frame, 5)
    socket.write(frame)

    let buf = Buffer.alloc(0)
    socket.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk])
      while (buf.length >= 5) {
        const type = buf[0]
        const len = buf.readUInt32BE(1)
        if (buf.length - 5 < len) break
        const payload = buf.subarray(5, 5 + len)
        buf = buf.subarray(5 + len)
        if (type === 16) {
          // MSG.HelloOk — now run the real hook against this session.
          const { sessionId } = JSON.parse(payload.toString("utf8"))
          const hook = spawn(runtime, [hookPath], {
            env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", CLI_CODE_DAEMON_SOCK: socketPath, CLI_CODE_SESSION_ID: sessionId },
            stdio: ["pipe", "pipe", "inherit"],
          })
          let hookStdout = ""
          hook.stdout.on("data", (c) => (hookStdout += c.toString()))
          hook.on("exit", (code) => {
            if (code !== 0) fail(`hook exited ${code}`)
            else if (hookStdout.length > 0) fail(`hook printed to stdout: ${JSON.stringify(hookStdout)}`)
            else {
              hookExited = true
              if (statusSeen) pass()
            }
          })
          hook.stdin.end(JSON.stringify({ hook_event_name: "Stop" }))
        } else if (type === 23) {
          // MSG.Status
          const status = JSON.parse(payload.toString("utf8"))
          if (status.state !== "done") fail(`unexpected status: ${JSON.stringify(status)}`)
          // Wait for the hook to exit so the empty-stdout assertion above actually runs.
          statusSeen = true
          if (hookExited) pass()
        }
      }
    })
  })
  socket.once("error", () => {
    socket.destroy()
    if (Date.now() - started >= DEADLINE_MS) fail("could not connect to daemon socket within 5s")
    else setTimeout(tryConnect, 100)
  })
}

tryConnect()
