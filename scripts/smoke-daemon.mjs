// Manual run: node scripts/smoke-daemon.mjs
// (or: CLI_CODE_NODE="/Applications/Visual Studio Code.app/Contents/MacOS/Code" node scripts/smoke-daemon.mjs
//  to exercise the real Electron runtime)
// This is the only place that touches real node-pty; bun test uses a fake PTY so it needs no native binding.
// Must not run under `bun scripts/smoke-daemon.mjs` — that would make process.execPath resolve to bun.
import * as net from "node:net"
import * as os from "node:os"
import * as path from "node:path"
import { spawn } from "node:child_process"

const runtime = process.env.CLI_CODE_NODE ?? "node"
const socketPath = path.join(os.tmpdir(), `cli-code-smoke-${Date.now()}.sock`)
const daemon = spawn(runtime, ["dist/daemon.js", socketPath], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  stdio: "inherit",
})

await new Promise((r) => setTimeout(r, 500))

const socket = net.createConnection(socketPath)
const hello = { op: "spawn", toolId: "shell", command: "echo SMOKE_OK", cwd: process.cwd(), env: {}, cols: 80, rows: 24 }
const payload = Buffer.from(JSON.stringify(hello))
const frame = Buffer.alloc(5 + payload.length)
frame[0] = 1
frame.writeUInt32BE(payload.length, 1)
payload.copy(frame, 5)
socket.write(frame)

let output = ""
socket.on("data", (chunk) => {
  output += chunk.toString("utf8")
  if (output.includes("SMOKE_OK")) {
    console.log("PASS: PTY thật chạy được qua daemon")
    daemon.kill()
    process.exit(0)
  }
})

setTimeout(() => {
  console.error("FAIL: không thấy SMOKE_OK sau 5 giây")
  daemon.kill()
  process.exit(1)
}, 5000)
