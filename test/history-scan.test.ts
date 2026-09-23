import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { codexSessions } from "../src/lib/history/scan.js"

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
