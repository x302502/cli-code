import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { modelFromText, detectModel } from "../src/lib/history/model.js"

describe("modelFromText — last model the CLI wrote into its transcript", () => {
  it("reads the common field spellings and takes the latest", () => {
    expect(modelFromText('{"message":{"model":"claude-haiku-4-5"}}\n{"message":{"model":"claude-fable-5"}}\n')).toBe("claude-fable-5")
    expect(modelFromText('{"type":"model_change","provider":"openai-codex","modelId":"gpt-5.5"}')).toBe("gpt-5.5")
    expect(modelFromText('{"model_id":"grok-4.6","model_fingerprint":"fp_x"}')).toBe("grok-4.6")
    expect(modelFromText('{"modelID":"mimo-v2.5-free","providerID":"opencode"}')).toBe("mimo-v2.5-free")
    expect(modelFromText('{"type":"model_change","model":"github-copilot/gpt-5.6-luna"}')).toBe("github-copilot/gpt-5.6-luna")
  })
  it("ignores placeholders and returns undefined when nothing is there", () => {
    expect(modelFromText('{"model":"<synthetic>"}')).toBeUndefined()
    expect(modelFromText('{"model":""}\n{"role":"user"}')).toBeUndefined()
    expect(modelFromText("no json here")).toBeUndefined()
  })
})

describe("detectModel — per-CLI session stores", () => {
  let home: string
  const cwd = "/w/proj"
  beforeEach(() => (home = fs.mkdtempSync(path.join(os.tmpdir(), "cli-code-model-"))))
  afterEach(() => fs.rmSync(home, { recursive: true, force: true }))
  const T0 = Date.now() - 60_000
  function write(rel: string, text: string, mtimeMs = T0 + 1000) {
    const p = path.join(home, rel)
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, text)
    fs.utimesSync(p, mtimeMs / 1000, mtimeMs / 1000)
  }

  it("claude: the transcript of the known session id", () => {
    const dir = ".claude/projects/-w-proj"
    write(`${dir}/abc.jsonl`, '{"type":"user","sessionId":"abc","cwd":"/w/proj"}\n{"type":"assistant","message":{"model":"claude-opus-5"}}\n')
    write(`${dir}/other.jsonl`, '{"type":"assistant","message":{"model":"claude-haiku-4-5"}}\n', T0 + 5000)
    expect(detectModel("claude", cwd, T0, home, "abc")).toBe("claude-opus-5")
  })
  it("pi/omp: newest session for the cwd, last model_change wins", () => {
    write(".pi/agent/sessions/--w-proj--/a.jsonl", '{"type":"session","id":"s1","cwd":"/w/proj"}\n{"type":"model_change","modelId":"gpt-5.5"}\n{"type":"model_change","modelId":"claude-sonnet-5"}\n')
    expect(detectModel("pi", cwd, T0, home)).toBe("claude-sonnet-5")
  })
  it("cline: session json", () => {
    write(".cline/data/sessions/c1/c1.json", '{"session_id":"c1","cwd":"/w/proj","provider":"cline-pass","model":"cline-pass/deepseek-v4-pro"}')
    expect(detectModel("cline", cwd, T0, home)).toBe("cline-pass/deepseek-v4-pro")
  })
  it("opencode family: latest assistant message of the session", () => {
    const { Database } = require("bun:sqlite") as { Database: new (p: string) => { exec(s: string): void; close(): void } }
    fs.mkdirSync(path.join(home, ".local/share/opencode"), { recursive: true })
    const db = new Database(path.join(home, ".local/share/opencode/opencode.db"))
    db.exec("CREATE TABLE session (id text, project_id text, directory text, time_updated integer)")
    db.exec("CREATE TABLE message (id text, session_id text, time_created integer, time_updated integer, data text)")
    db.exec(`INSERT INTO session VALUES ('ses_1','p','/w/proj',${T0 + 1})`)
    db.exec(`INSERT INTO message VALUES ('m1','ses_1',1,1,'{"role":"assistant","modelID":"old-model","providerID":"x"}'), ('m2','ses_1',2,2,'{"role":"assistant","modelID":"mimo-v2.5-free","providerID":"opencode"}')`)
    db.close()
    expect(detectModel("opencode", cwd, T0, home)).toBe("mimo-v2.5-free")
  })
  it("unknown CLI or no store → undefined", () => {
    expect(detectModel("copilot", cwd, T0, home)).toBeUndefined()
    expect(detectModel("pi", cwd, T0, home)).toBeUndefined()
  })
})
