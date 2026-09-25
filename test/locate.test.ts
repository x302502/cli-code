import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { locateLatestSession } from "../src/lib/history/locate.js"

let home: string
const cwd = "/w/proj"
beforeEach(() => (home = fs.mkdtempSync(path.join(os.tmpdir(), "cli-code-locate-"))))
afterEach(() => fs.rmSync(home, { recursive: true, force: true }))

function write(rel: string, text: string, mtimeMs: number) {
  const p = path.join(home, rel)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, text)
  fs.utimesSync(p, mtimeMs / 1000, mtimeMs / 1000)
  return p
}
const T0 = Date.now() - 60_000

describe("locateLatestSession", () => {
  it("pi/omp/command-code/droid: jsonl header with id + cwd, newest since spawn, own cwd only", () => {
    write(".pi/agent/sessions/--w-proj--/a.jsonl", '{"type":"session","id":"pi-old","cwd":"/w/proj"}\n', T0 - 10_000)
    write(".pi/agent/sessions/--w-proj--/b.jsonl", '{"type":"session","id":"pi-new","cwd":"/w/proj"}\n', T0 + 5_000)
    write(".pi/agent/sessions/--w-other--/c.jsonl", '{"type":"session","id":"pi-other","cwd":"/w/other"}\n', T0 + 9_000)
    expect(locateLatestSession("pi", cwd, T0, home)).toBe("pi-new")
    // omp writes a title line before the session header
    write(".omp/agent/sessions/x/d.jsonl", '{"type":"title","title":"t"}\n{"type":"session","id":"omp-1","cwd":"/w/proj"}\n', T0 + 1)
    expect(locateLatestSession("omp", cwd, T0, home)).toBe("omp-1")
    write(".commandcode/projects/slug/e.jsonl", '{"type":"session","id":"cc-1","cwd":"/w/proj"}\n', T0 + 1)
    write(".commandcode/projects/slug/e.checkpoints.jsonl", '{"id":"ignored"}\n', T0 + 2)
    expect(locateLatestSession("command-code", cwd, T0, home)).toBe("cc-1")
    write(".factory/sessions/slug/f.jsonl", '{"type":"session_start","id":"droid-1","cwd":"/w/proj"}\n', T0 + 1)
    expect(locateLatestSession("droid", cwd, T0, home)).toBe("droid-1")
  })
  it("returns undefined when the only record predates the spawn", () => {
    write(".pi/agent/sessions/x/a.jsonl", '{"type":"session","id":"pi-old","cwd":"/w/proj"}\n', T0 - 10_000)
    expect(locateLatestSession("pi", cwd, T0, home)).toBeUndefined()
  })
  it("antigravity: last_conversations.json maps cwd → id; the conversation db must postdate the spawn", () => {
    write(".gemini/antigravity-cli/cache/last_conversations.json", JSON.stringify({ "/w/proj": "conv-1", "/w/other": "conv-2" }), T0)
    write(".gemini/antigravity-cli/conversations/conv-1.db", "", T0 + 5_000)
    write(".gemini/antigravity-cli/conversations/conv-2.db", "", T0 + 5_000)
    expect(locateLatestSession("antigravity", cwd, T0, home)).toBe("conv-1")
    expect(locateLatestSession("antigravity", "/w/nowhere", T0, home)).toBeUndefined()
    // a conversation from before this tab is not this tab's
    fs.utimesSync(path.join(home, ".gemini/antigravity-cli/conversations/conv-1.db"), (T0 - 9_000) / 1000, (T0 - 9_000) / 1000)
    expect(locateLatestSession("antigravity", cwd, T0, home)).toBeUndefined()
  })
  it("copilot: workspace.yaml id/cwd", () => {
    write(".copilot/session-state/s1/workspace.yaml", "id: s1\ncwd: /w/proj\nbranch: main\n", T0 + 1)
    write(".copilot/session-state/s2/workspace.yaml", "id: s2\ncwd: /w/other\n", T0 + 2)
    expect(locateLatestSession("copilot", cwd, T0, home)).toBe("s1")
  })
  it("cline: sessions/<id>/<id>.json", () => {
    write(".cline/data/sessions/c1/c1.json", '{"session_id":"c1","cwd":"/w/proj"}', T0 + 1)
    write(".cline/data/sessions/c1/c1.messages.json", "[]", T0 + 2)
    expect(locateLatestSession("cline", cwd, T0, home)).toBe("c1")
  })
  it("kimi and cursor: newest session directory under the cwd-derived folder", () => {
    const { createHash } = require("node:crypto") as typeof import("node:crypto")
    const h = createHash("md5").update(cwd).digest("hex")
    write(`.kimi/sessions/${h}/k-old/state.json`, "{}", T0 - 5)
    write(`.kimi/sessions/${h}/k-new/state.json`, "{}", T0 + 5)
    fs.utimesSync(path.join(home, ".kimi/sessions", h, "k-new"), (T0 + 5) / 1000, (T0 + 5) / 1000)
    fs.utimesSync(path.join(home, ".kimi/sessions", h, "k-old"), (T0 - 5) / 1000, (T0 - 5) / 1000)
    expect(locateLatestSession("kimi", cwd, T0, home)).toBe("k-new")
    write(".cursor/projects/w-proj/agent-transcripts/chat-1/chat-1.jsonl", "{}", T0 + 1)
    fs.utimesSync(path.join(home, ".cursor/projects/w-proj/agent-transcripts/chat-1"), (T0 + 1) / 1000, (T0 + 1) / 1000)
    expect(locateLatestSession("cursor", cwd, T0, home)).toBe("chat-1")
  })
  it("amp: newest thread file since spawn", () => {
    write(".local/share/amp/threads/T-aaa.json", "{}", T0 + 1)
    write(".local/share/amp/threads/T-bbb.json", "{}", T0 + 3)
    expect(locateLatestSession("amp", cwd, T0, home)).toBe("T-bbb")
  })
  it("opencode-family and goose: SQLite stores", () => {
    const { Database: DatabaseSync } = require("bun:sqlite") as { Database: new (p: string) => { exec(s: string): void; close(): void } }
    fs.mkdirSync(path.join(home, ".local/share/opencode"), { recursive: true })
    const db = new DatabaseSync(path.join(home, ".local/share/opencode/opencode.db"))
    db.exec("CREATE TABLE session (id text, project_id text, parent_id text, directory text, time_updated integer)")
    db.exec(`INSERT INTO session VALUES ('ses_old','p',NULL,'/w/proj',${T0 - 1}), ('ses_new','p',NULL,'/w/proj',${T0 + 1}), ('ses_x','p',NULL,'/w/other',${T0 + 9}), ('ses_child','p','ses_new','/w/proj',${T0 + 5})`)
    db.close()
    expect(locateLatestSession("opencode", cwd, T0, home)).toBe("ses_new")
    fs.mkdirSync(path.join(home, ".local/share/goose/sessions"), { recursive: true })
    const g = new DatabaseSync(path.join(home, ".local/share/goose/sessions/sessions.db"))
    g.exec("CREATE TABLE sessions (id text, working_dir text, updated_at text)")
    g.exec(`INSERT INTO sessions VALUES ('g1','/w/proj','${new Date(T0 + 1).toISOString()}')`)
    g.close()
    expect(locateLatestSession("goose", cwd, T0, home)).toBe("g1")
  })
  it("unknown tool or missing store → undefined", () => {
    expect(locateLatestSession("claude", cwd, T0, home)).toBeUndefined()
    expect(locateLatestSession("pi", cwd, T0, home)).toBeUndefined()
  })
})
