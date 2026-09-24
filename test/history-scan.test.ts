import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { claudeSessionsInDir, codexSessions } from "../src/lib/history/scan.js"

let home: string
beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "cli-code-codex-"))
  process.env.CODEX_HOME = home
})
afterEach(() => {
  delete process.env.CODEX_HOME
  fs.rmSync(home, { recursive: true, force: true })
})

function rollout(name: string, cwd: string, mtimeMs: number) {
  const dir = path.join(home, "sessions", "2026", "09", "23")
  fs.mkdirSync(dir, { recursive: true })
  const f = path.join(dir, `rollout-${name}.jsonl`)
  fs.writeFileSync(
    f,
    JSON.stringify({ type: "session_meta", payload: { id: name, cwd } }) +
      "\n" +
      JSON.stringify({ type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: `task ${name}` }] } }) +
      "\n",
  )
  fs.utimesSync(f, mtimeMs / 1000, mtimeMs / 1000)
}

describe("codexSessions", () => {
  it("filters by workspace before applying the limit: newer sessions of other projects do not hide this one's", () => {
    const now = Date.now()
    rollout("mine", "/w/mine", now - 60_000)
    for (let i = 0; i < 5; i++) rollout(`other-${i}`, "/w/other", now - i * 1000)
    expect(codexSessions("/w/mine", 100).map((s) => s.sessionId)).toEqual(["mine"])
    const found = codexSessions("/w/mine", 3)
    expect(found.map((s) => s.sessionId)).toEqual(["mine"])
  })
})

describe("claudeSessionsInDir", () => {
  // Claude's folder name maps every non-alphanumeric to "-": /work/foo-bar and /work/foo/bar share one.
  function transcript(dir: string, id: string, cwd: string | undefined, mtimeMs: number) {
    const rec = { type: "user", sessionId: id, ...(cwd ? { cwd } : {}), message: { role: "user", content: `task ${id}` } }
    const f = path.join(dir, `${id}.jsonl`)
    fs.writeFileSync(f, JSON.stringify(rec) + "\n")
    fs.utimesSync(f, mtimeMs / 1000, mtimeMs / 1000)
  }
  it("keeps only transcripts whose own cwd is the workspace, before applying the limit", () => {
    const dir = path.join(home, "-work-foo-bar")
    fs.mkdirSync(dir, { recursive: true })
    const now = Date.now()
    transcript(dir, "mine", "/work/foo-bar", now - 60_000)
    for (let i = 0; i < 4; i++) transcript(dir, `other-${i}`, "/work/foo/bar", now - i * 1000)
    // No cwd at all: cannot be attributed to this workspace, so it is not offered.
    transcript(dir, "unknown", undefined, now)
    expect(claudeSessionsInDir(dir, 2, "/work/foo-bar").map((s) => s.sessionId)).toEqual(["mine"])
  })
})
