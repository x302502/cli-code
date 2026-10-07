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
let shutdown: (() => void)[] = []
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-code-plugin-"))
  capture = path.join(dir, "captured")
  fs.mkdirSync(capture)
  process.env.CLI_CODE_HOOK = `cat > "${capture}/$$-$RANDOM.json"`
})
afterEach(() => {
  for (const stop of shutdown) stop()
  shutdown = []
  delete process.env.CLI_CODE_HOOK
  fs.rmSync(dir, { recursive: true, force: true })
})

async function load(flavour: "opencode" | "pi" | "omp") {
  const file = path.join(dir, `${flavour}-${Date.now()}.ts`)
  fs.writeFileSync(file, pluginSource(flavour))
  const plugin = (await import(file)).default as (...args: unknown[]) => unknown
  return (...args: unknown[]) => {
    if (flavour === "opencode") return plugin(...args)
    const api = args[0] as { on(name: string, fn: (...args: unknown[]) => unknown): unknown }
    return plugin({ ...api, on: (name: string, fn: (...args: unknown[]) => unknown) => {
      if (name === "session_shutdown") shutdown.push(() => { void fn({}, {}) })
      return api.on(name, fn)
    } })
  }
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
  it("Pi keeps rapid model selections in order when the older hook is slow", async () => {
    const ordered = path.join(dir, "pi-models.jsonl")
    const slow = path.join(dir, "pi-slow.cjs")
    fs.writeFileSync(slow, `let input = ""; process.stdin.on("data", c => input += c); process.stdin.on("end", () => {
      const p = JSON.parse(input); setTimeout(() => require("node:fs").appendFileSync(${JSON.stringify(ordered)}, input + "\\n"), p.model === "old-model" ? 250 : 0)
    })`)
    process.env.CLI_CODE_HOOK = `node "${slow}"`
    const ext = await load("pi")
    const handlers: Record<string, (e: unknown, c: unknown) => Promise<void>> = {}
    ext({ on: (name: string, fn: (e: unknown, c: unknown) => Promise<void>) => (handlers[name] = fn) })
    const ctx = { sessionManager: { getSessionId: () => "selected" } }
    await handlers.model_select!({ model: { id: "old-model" } }, ctx)
    await handlers.model_select!({ model: { id: "new-model" } }, ctx)
    for (let i = 0; i < 100; i++) {
      if (fs.existsSync(ordered) && fs.readFileSync(ordered, "utf8").trim().split("\n").length === 2) break
      await new Promise((r) => setTimeout(r, 20))
    }
    expect(fs.readFileSync(ordered, "utf8").trim().split("\n").map((line) => JSON.parse(line).model))
      .toEqual(["old-model", "new-model"])
  })
  it("OMP reports a menu model change without a prompt, transcript write or repeated reports", async () => {
    const ext = await load("omp")
    const handlers: Record<string, (e: unknown, c: unknown) => Promise<void>> = {}
    ext({ on: (name: string, fn: (e: unknown, c: unknown) => Promise<void>) => (handlers[name] = fn) })
    let current = { id: "old-model" }
    const ctx = { sessionManager: { getSessionId: () => "selected" }, get model() { return current } }
    await handlers.session_start!({}, ctx)
    await captured(2)
    current = { id: "new-model" }
    const reports = await captured(3)
    expect(reports.filter((p) => p.hook_event_name === "ModelChange").map((p) => p.model).sort()).toEqual(["new-model", "old-model"])
    await new Promise((r) => setTimeout(r, 350))
    expect(fs.readdirSync(capture)).toHaveLength(3)
    await handlers.session_shutdown!({}, ctx)
    current = { id: "after-shutdown" }
    await new Promise((r) => setTimeout(r, 350))
    expect(fs.readdirSync(capture)).toHaveLength(3)
  })
  it("Pi reports model_select immediately, without changing activity", async () => {
    const ext = await load("pi")
    const handlers: Record<string, (e: unknown, c: unknown) => Promise<void>> = {}
    ext({ on: (name: string, fn: (e: unknown, c: unknown) => Promise<void>) => (handlers[name] = fn) })
    expect(typeof handlers.model_select).toBe("function")
    await handlers.model_select!({ model: { id: "new-model" } }, { sessionManager: { getSessionId: () => "selected" } })
    const reports = await captured(1)
    expect(reports[0]).toMatchObject({ hook_event_name: "ModelChange", model: "new-model", session_id: "selected" })
  })
  it("omp delivers startup, switch and status in order even when the first hook is slow", async () => {
    const ordered = path.join(dir, "ordered.jsonl")
    const slow = path.join(dir, "slow.cjs")
    fs.writeFileSync(slow, `let input = ""; process.stdin.on("data", c => input += c); process.stdin.on("end", () => {
      const p = JSON.parse(input); setTimeout(() => require("node:fs").appendFileSync(${JSON.stringify(ordered)}, input + "\\n"), p.session_id === "original" ? 250 : 0)
    })`)
    process.env.CLI_CODE_HOOK = `node "${slow}"`
    const ext = await load("omp")
    const handlers: Record<string, (e: unknown, c: unknown) => Promise<void>> = {}
    ext({ on: (name: string, fn: (e: unknown, c: unknown) => Promise<void>) => (handlers[name] = fn) })
    const ctx = (id: string) => ({ sessionManager: { getSessionId: () => id } })
    await handlers.session_start!({}, ctx("original"))
    await handlers.session_switch!({}, ctx("selected"))
    await handlers.before_agent_start!({ prompt: "hello" }, ctx("selected"))
    for (let i = 0; i < 100; i++) {
      if (fs.existsSync(ordered) && fs.readFileSync(ordered, "utf8").trim().split("\n").length === 3) break
      await new Promise((r) => setTimeout(r, 20))
    }
    const reports = fs.readFileSync(ordered, "utf8").trim().split("\n").map((line) => JSON.parse(line))
    expect(reports.map((p) => p.session_id)).toEqual(["original", "selected", "selected"])
    expect(reports.at(-1).hook_event_name).toBe("UserPromptSubmit")
  })
  it("omp reports the current session immediately on start and switch, before any prompt", async () => {
    const ext = await load("omp")
    const handlers: Record<string, (e: unknown, c: unknown) => Promise<void>> = {}
    ext({ on: (name: string, fn: (e: unknown, c: unknown) => Promise<void>) => (handlers[name] = fn) })
    const ctx = (id: string) => ({ cwd: "/w/proj", sessionManager: { getSessionId: () => id, getSessionFile: () => `/custom/${id}.jsonl` } })
    expect(typeof handlers.session_start).toBe("function")
    expect(typeof handlers.session_switch).toBe("function")
    await handlers.session_start!({}, ctx("original"))
    await handlers.session_switch!({ reason: "resume" }, ctx("selected"))
    const ids = (await captured(2)).map((p) => p.session_id).sort()
    expect(ids).toEqual(["original", "selected"])
    for (const payload of await captured(2)) {
      expect(payload.identityOnly).toBe(true)
      expect(payload.session_file).toBe(`/custom/${payload.session_id}.jsonl`)
    }
  })
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
  it("opencode: a subagent (child session) never ends the tab's turn or takes over its session id", async () => {
    const plugin = await load("opencode")
    const client = { session: { get: async ({ path: { id } }: { path: { id: string } }) => ({ data: { id, parentID: id === "ses_child" ? "ses_parent" : undefined } }) } }
    const hooks = (await plugin({ directory: "/w/proj", client })) as Record<string, (...a: unknown[]) => Promise<void>>
    await hooks["chat.message"]!({ sessionID: "ses_parent" }, { parts: [{ type: "text", text: "go" }] })
    await hooks["chat.message"]!({ sessionID: "ses_child" }, { parts: [{ type: "text", text: "subtask" }] })
    await hooks.event!({ event: { type: "session.idle", properties: { sessionID: "ses_child" } } })
    await hooks["permission.ask"]!({ sessionID: "ses_child" })
    await hooks.event!({ event: { type: "session.idle", properties: { sessionID: "ses_parent" } } })
    expect(await captured(3)).toEqual([
      // A subagent asking for permission still means the user is needed — without its id.
      { hook_event_name: "PermissionRequest", cwd: "/w/proj" },
      { hook_event_name: "Stop", session_id: "ses_parent", cwd: "/w/proj" },
      { hook_event_name: "UserPromptSubmit", session_id: "ses_parent", cwd: "/w/proj", prompt: "go" },
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
