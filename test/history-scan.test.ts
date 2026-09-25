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

function rollout(name: string, cwd: string, mtimeMs: number, day = new Date(mtimeMs)) {
  const pad = (n: number) => String(n).padStart(2, "0")
  const dir = path.join(home, "sessions", String(day.getFullYear()), pad(day.getMonth() + 1), pad(day.getDate()))
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
    // A trailing separator on either side still names the same workspace.
    expect(codexSessions("/w/mine/", 3).map((s) => s.sessionId)).toEqual(["mine"])
    const found = codexSessions("/w/mine", 3)
    expect(found.map((s) => s.sessionId)).toEqual(["mine"])
  })
})

describe("codexSessions with a spawn time (model pill, restart)", () => {
  it("only walks the day folders since the spawn: a tab's rollout cannot live in an older one", () => {
    const now = Date.now()
    rollout("today", "/w/mine", now - 10_000)
    // Same workspace and a recent mtime, but filed under an old day: out of scope for the tab.
    rollout("old-day", "/w/mine", now - 5_000, new Date(2020, 0, 1))
    expect(codexSessions("/w/mine", 5, now - 60_000).map((s) => s.sessionId)).toEqual(["today"])
    expect(codexSessions("/w/mine", 5).map((s) => s.sessionId).sort()).toEqual(["old-day", "today"])
  })
})

describe("codexSessions — the history picker (no sinceMs)", () => {
  it("a session resumed today but filed under the day it began still counts among the newest", () => {
    const now = Date.now()
    for (let i = 0; i < 3; i++) rollout(`yesterday-${i}`, "/w/mine", now - 86_400_000 - i * 1000)
    rollout("resumed", "/w/mine", now - 1000, new Date(now - 30 * 86_400_000))
    expect(codexSessions("/w/mine", 2).map((s) => s.sessionId)).toEqual(["resumed", "yesterday-0"])
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
  it("with sinceMs (a restarting tab's spawn time) transcripts older than it are not offered", () => {
    const dir = path.join(home, "-work-since")
    fs.mkdirSync(dir, { recursive: true })
    const now = Date.now()
    transcript(dir, "new", "/work/since", now - 1_000)
    transcript(dir, "old", "/work/since", now - 600_000)
    expect(claudeSessionsInDir(dir, 5, "/work/since", now - 60_000).map((s) => s.sessionId)).toEqual(["new"])
    expect(claudeSessionsInDir(dir, 5, "/work/since").map((s) => s.sessionId)).toEqual(["new", "old"])
  })
})
