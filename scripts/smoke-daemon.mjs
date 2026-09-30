// Manual run: node scripts/smoke-daemon.mjs
// (or: CLI_CODE_NODE="/Applications/Visual Studio Code.app/Contents/MacOS/Code" node scripts/smoke-daemon.mjs
//  to exercise the real Electron runtime)
// This is the only place that touches real node-pty; bun test uses a fake PTY so it needs no native binding.
// The daemon must run under node or the editor's own Electron binary (ELECTRON_RUN_AS_NODE=1) — the runtime is
// chosen via CLI_CODE_NODE, falling back to node on PATH.
import * as net from "node:net"
import * as os from "node:os"
import * as path from "node:path"
import * as fs from "node:fs"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

const runtime = process.env.CLI_CODE_NODE ?? "node"
const daemonPath = fileURLToPath(new URL("../dist/daemon.js", import.meta.url))
const socketPath = path.join(os.tmpdir(), `cli-code-smoke-${Date.now()}.sock`)
const DEADLINE_MS = 5000
const started = Date.now()

const daemon = spawn(runtime, [daemonPath, socketPath], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  stdio: "inherit",
})

let done = false
const watchdog = setTimeout(() => fail("no SMOKE_OK after 5s"), DEADLINE_MS)

function cleanup() {
  clearTimeout(watchdog)
  daemon.kill()
  fs.rmSync(socketPath, { force: true })
}

function pass(output) {
  if (done) return
  done = true
  console.log("PASS: real PTY round-trips through the daemon")
  console.log(`output: ${JSON.stringify(output)}`)
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
    // Past this point a socket error is a real failure, not a "daemon not up yet" retry signal.
    socket.removeAllListeners("error")
    socket.on("error", (err) => fail(`socket error: ${err.message}`))

    const hello = {
      op: "spawn",
      toolId: "shell",
      command: "echo SMOKE_OK ELECTRON=${ELECTRON_RUN_AS_NODE:-unset}",
      cwd: process.cwd(),
      env: {},
      cols: 80,
      rows: 24,
    }
    const payload = Buffer.from(JSON.stringify(hello))
    const frame = Buffer.alloc(5 + payload.length)
    frame[0] = 1
    frame.writeUInt32BE(payload.length, 1)
    payload.copy(frame, 5)
    socket.write(frame)

    let output = ""
    socket.on("data", (chunk) => {
      output += chunk.toString("utf8")
      // ELECTRON=unset proves the daemon stripped ELECTRON_RUN_AS_NODE before handing the
      // env down into the CLI's shell (see src/daemon/entry.ts).
      if (output.includes("SMOKE_OK") && output.includes("ELECTRON=unset")) pass(output)
    })
  })
  socket.once("error", () => {
    socket.destroy()
    if (Date.now() - started >= DEADLINE_MS) fail("could not connect to daemon socket within 5s")
    else setTimeout(tryConnect, 100)
  })
}

tryConnect()
