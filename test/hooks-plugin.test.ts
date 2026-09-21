import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { isManagedPlugin, pluginSource } from "../src/lib/hooks/plugin-template.js"

// The generated file is loaded for real (bun compiles the TS) with CLI_CODE_HOOK pointing at a
// script that stores each payload it receives on stdin as its own file. Reports are
// fire-and-forget and run concurrently, so tests compare them as a set.
let dir: string
let capture: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-code-plugin-"))
  capture = path.join(dir, "captured")
  fs.mkdirSync(capture)
  process.env.CLI_CODE_HOOK = `cat > "${capture}/$$-$RANDOM.json"`
})
afterEach(() => {
  delete process.env.CLI_CODE_HOOK
  fs.rmSync(dir, { recursive: true, force: true })
})

async function load(flavour: "opencode" | "pi" | "omp") {
  const file = path.join(dir, `${flavour}-${Date.now()}.ts`)
  fs.writeFileSync(file, pluginSource(flavour))
  return (await import(file)).default as (...args: unknown[]) => unknown
}
async function captured(expected: number): Promise<Record<string, unknown>[]> {
  for (let i = 0; i < 100; i++) {
    const texts = fs.readdirSync(capture).map((f) => fs.readFileSync(path.join(capture, f), "utf8")).filter((t) => t.endsWith("}"))
    if (texts.length >= expected) {
      // Settle time for a straggler that would make the set larger than expected.
      await new Promise((r) => setTimeout(r, 100))
      return fs
        .readdirSync(capture)
        .map((f) => JSON.parse(fs.readFileSync(path.join(capture, f), "utf8")) as Record<string, unknown>)
        .sort((a, b) => String(a.hook_event_name).localeCompare(String(b.hook_event_name)))
    }
    await new Promise((r) => setTimeout(r, 20))
  }
  throw new Error("hook never received the payloads")
}

describe("generated status plugin", () => {
  it("is marked as managed", () => {
    expect(isManagedPlugin(pluginSource("opencode"))).toBe(true)
    expect(isManagedPlugin("export default {}")).toBe(false)
  })
  it("opencode: prompt, idle and permission reach the hook as Claude-shaped payloads", async () => {
    const plugin = await load("opencode")
    const hooks = (await plugin({ directory: "/w/proj" })) as Record<string, (...a: unknown[]) => Promise<void>>
    await hooks["chat.message"]!({ sessionID: "ses_1" }, { parts: [{ type: "text", text: "fix the bug" }] })
    await hooks["permission.ask"]!({ sessionID: "ses_1" })
    await hooks.event!({ event: { type: "session.idle", properties: { sessionID: "ses_1" } } })
    await hooks.event!({ event: { type: "message.updated", properties: {} } })
    const got = await captured(3)
    expect(got).toEqual([
      { hook_event_name: "PermissionRequest", session_id: "ses_1", cwd: "/w/proj" },
      { hook_event_name: "Stop", session_id: "ses_1", cwd: "/w/proj" },
      { hook_event_name: "UserPromptSubmit", session_id: "ses_1", cwd: "/w/proj", prompt: "fix the bug" },
    ])
  })
  it("pi: before_agent_start / agent_settled / ui_prompt_start", async () => {
    const ext = await load("pi")
    const handlers: Record<string, (e: unknown, c: unknown) => Promise<void>> = {}
    ext({ on: (name: string, fn: (e: unknown, c: unknown) => Promise<void>) => (handlers[name] = fn) })
    const ctx = { cwd: "/w/proj", sessionManager: { getSessionId: () => "pi-1" } }
    await handlers.before_agent_start!({ prompt: "hello" }, ctx)
    await handlers.ui_prompt_start!({}, ctx)
    await handlers.agent_settled!({}, ctx)
    expect(await captured(3)).toEqual([
      { hook_event_name: "PermissionRequest", session_id: "pi-1", cwd: "/w/proj" },
      { hook_event_name: "Stop", session_id: "pi-1", cwd: "/w/proj" },
      { hook_event_name: "UserPromptSubmit", session_id: "pi-1", cwd: "/w/proj", prompt: "hello" },
    ])
  })
  it("omp: agent_end with willContinue is not a turn end; tool_approval_requested waits", async () => {
    const ext = await load("omp")
    const handlers: Record<string, (e: unknown, c: unknown) => Promise<void>> = {}
    ext({ on: (name: string, fn: (e: unknown, c: unknown) => Promise<void>) => (handlers[name] = fn) })
    const ctx = { cwd: "/w/proj", sessionManager: { getSessionId: () => "omp-1" } }
    await handlers.agent_end!({ willContinue: true }, ctx)
    await handlers.tool_approval_requested!({}, ctx)
    await handlers.agent_end!({ willContinue: false }, ctx)
    expect(await captured(2)).toEqual([
      { hook_event_name: "PermissionRequest", session_id: "omp-1", cwd: "/w/proj" },
      { hook_event_name: "Stop", session_id: "omp-1", cwd: "/w/proj" },
    ])
  })
  it("registers nothing when CLI_CODE_HOOK is absent (CLI running outside CLI Code)", async () => {
    delete process.env.CLI_CODE_HOOK
    const plugin = await load("opencode")
    expect(await plugin({ directory: "/w" })).toEqual({})
    const handlers: Record<string, unknown> = {}
    const ext = await load("pi")
    ext({ on: (name: string, fn: unknown) => (handlers[name] = fn) })
    expect(Object.keys(handlers)).toEqual([])
  })
})
