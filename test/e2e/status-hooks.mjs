// End-to-end check of the status hooks against the REAL CLIs installed on this machine.
// Not part of CI: it spends one model call per CLI with the user's own accounts and leaves one
// tiny session in each CLI's history. Run by hand:
//
//   node test/e2e/status-hooks.mjs [cli-id ...]      (default: every supported CLI on PATH)
//
// For each CLI it spawns the same command line the extension uses, in a throwaway directory,
// with CLI_CODE_HOOK pointing at a script that stores every payload the hook receives, sends
// "Reply with exactly: OK", and waits for UserPromptSubmit and Stop to arrive with a session id.
import pty from "node-pty"
import headless from "@xterm/headless"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { execFileSync } from "node:child_process"

const { spawn } = pty
const { Terminal } = headless
const SUPPORTED = ["claude", "codex", "copilot", "droid", "grok", "opencode", "kilo", "mimo", "pi", "omp"]
const PROMPT = "Reply with exactly: OK"
const READY_IDLE_MS = 3000
const TURN_TIMEOUT_MS = 120_000

// The extension's own launch commands (config.ts), evaluated through bun so this file stays plain node.
const tools = JSON.parse(
  execFileSync("bun", ["-e", 'import { CLI_TOOLS } from "./src/lib/config.ts"; console.log(JSON.stringify(CLI_TOOLS.map(t => ({ id: t.id, command: t.command, extraEnv: t.extraEnv ?? {} }))))'], {
    cwd: path.resolve(import.meta.dirname, "../.."),
    encoding: "utf8",
  }),
)

function onPath(binary) {
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    try {
      fs.accessSync(path.join(dir, binary), fs.constants.X_OK)
      return true
    } catch {}
  }
  return false
}

const ids = process.argv.slice(2).length ? process.argv.slice(2) : SUPPORTED
const root = fs.mkdtempSync(path.join(os.tmpdir(), "cli-code-e2e-"))
const results = []

for (const id of ids) {
  const tool = tools.find((t) => t.id === id)
  if (!tool) {
    results.push({ id, verdict: "unknown id" })
    continue
  }
  const binary = tool.command.split(" ")[0]
  if (!onPath(binary)) {
    results.push({ id, verdict: `skipped (${binary} not on PATH)` })
    continue
  }
  results.push(await runOne(tool))
}

console.log("\n=== status hook e2e ===")
console.log("cli       | prompt | stop | session_id | waiting | time  | verdict")
for (const r of results) {
  console.log(
    `${r.id.padEnd(9)} | ${mark(r.prompt)}      | ${mark(r.stop)}    | ${mark(r.sessionId)}          | ${mark(r.waiting, "-")}       | ${String(r.ms ?? "").padStart(5)} | ${r.verdict}`,
  )
}
console.log(`\nscreens + payloads under ${root}`)
process.exit(results.every((r) => r.verdict === "ok" || r.verdict.startsWith("skipped")) ? 0 : 1)

function mark(v, empty = "✗") {
  return v === undefined ? " " : v ? "✓" : empty
}

async function runOne(tool) {
  const t0 = Date.now()
  const dir = path.join(root, tool.id)
  const cwd = path.join(dir, "work")
  const capture = path.join(dir, "captured")
  fs.mkdirSync(cwd, { recursive: true })
  fs.mkdirSync(capture, { recursive: true })
  const port = 40000 + Math.floor(Math.random() * 20000)
  const command = tool.command.replace("{port}", String(port))
  const env = {
    ...process.env,
    ...tool.extraEnv,
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
    CLI_CODE_HOOK: `cat > "${capture}/$$-$RANDOM.json"`,
    CLI_CODE_TOOL_ID: tool.id,
  }
  const term = new Terminal({ cols: 120, rows: 40, allowProposedApi: true })
  const p = spawn("sh", ["-c", command], { name: "xterm-256color", cols: 120, rows: 40, cwd, env })
  let lastData = Date.now()
  let exited = false
  term.onData((d) => p.write(d)) // answers the terminal queries CLIs send at startup
  p.onData((d) => {
    lastData = Date.now()
    term.write(d)
  })
  p.onExit(() => (exited = true))
  const log = (msg) => console.log(`[${tool.id}] ${msg}`)
  const screen = () => {
    const b = term.buffer.active
    const lines = []
    for (let i = 0; i < b.length; i++) lines.push(b.getLine(i)?.translateToString(true) ?? "")
    return lines.join("\n").replace(/\n+$/, "")
  }
  // TUIs with spinners never go fully quiet; give up waiting for silence after 15 s.
  const idle = async (ms) => {
    const cap = Date.now() + 15_000
    while (!exited && Date.now() - lastData < ms && Date.now() < cap) await sleep(100)
  }
  const payloads = () =>
    fs
      .readdirSync(capture)
      .map((f) => {
        try {
          return JSON.parse(fs.readFileSync(path.join(capture, f), "utf8"))
        } catch {
          return undefined
        }
      })
      .filter(Boolean)
  const has = (event) => payloads().some((x) => (x.hook_event_name ?? x.hookEventName ?? "").toLowerCase() === event.toLowerCase())

  try {
    // Startup: wait for the TUI to settle, accept up to three "trust / continue" dialogs by Enter.
    await sleep(2000)
    await idle(READY_IDLE_MS)
    for (let i = 0; i < 3 && !exited; i++) {
      const s = screen().toLowerCase()
      if (/trust|yes, proceed|press enter|continue\?|\(y\/n\)|allow/.test(s)) {
        // Claude's trust dialog lists "No, exit" first: move down to "Yes, I trust" before Enter.
        const down = /no, exit[\s\S]*yes, i trust/.test(s)
        log(`dialog detected, sending ${down ? "Down + " : ""}Enter`)
        if (down) {
          p.write("\x1b[B")
          await sleep(300)
        }
        p.write("\r")
        await sleep(1000)
        await idle(READY_IDLE_MS)
      } else break
    }
    if (exited) throw new Error("CLI exited during startup")
    fs.writeFileSync(path.join(dir, "screen-ready.txt"), screen())
    log("ready, sending prompt")
    await sleep(1500)
    for (const ch of PROMPT) {
      p.write(ch)
      await sleep(15)
    }
    await sleep(600)
    p.write("\r")

    // Turn: wait for prompt + stop from the hook.
    const deadline = Date.now() + TURN_TIMEOUT_MS
    while (Date.now() < deadline && !exited) {
      if (has("UserPromptSubmit") && (has("Stop") || has("StopFailure") || has("StopCancelled"))) break
      // A permission prompt that we did not expect: approve it so the turn can end.
      if (has("PermissionRequest") || has("Notification")) {
        const s = screen().toLowerCase()
        if (/allow|approve|yes|\(y\)/.test(s)) {
          p.write("y")
          await sleep(300)
          p.write("\r")
        }
      }
      await sleep(500)
    }
  } catch (err) {
    log(String(err))
  }
  fs.writeFileSync(path.join(dir, "screen-end.txt"), screen())
  const got = payloads()
  fs.writeFileSync(path.join(dir, "payloads.json"), JSON.stringify(got, null, 2))
  // Leave: Ctrl+C twice (most TUIs), then kill.
  try {
    p.write("\x03")
    await sleep(300)
    p.write("\x03")
    await sleep(700)
    p.kill()
  } catch {}
  const sessionId = got.map((x) => x.session_id ?? x.sessionId).find((x) => typeof x === "string" && x)
  const r = {
    id: tool.id,
    prompt: has("UserPromptSubmit"),
    stop: has("Stop") || has("StopFailure") || has("StopCancelled"),
    sessionId: !!sessionId,
    waiting: has("PermissionRequest") || has("Notification"),
    ms: Date.now() - t0,
    verdict: "",
  }
  r.verdict = r.prompt && r.stop && r.sessionId ? "ok" : `missing: ${[!r.prompt && "prompt", !r.stop && "stop", !r.sessionId && "session_id"].filter(Boolean).join(", ")}`
  log(`${r.verdict} — events: ${got.map((x) => x.hook_event_name ?? x.hookEventName).join(", ") || "none"}; session_id=${sessionId ?? "-"}`)
  return r
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}
