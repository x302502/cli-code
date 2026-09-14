import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { encodeClaudeProjectDir, parseClaudeSession } from "../src/lib/history/claude.js"
import { parseCodexRollout } from "../src/lib/history/codex.js"
import { parseGrokSession } from "../src/lib/history/grok.js"
import { claudeSessionsInDir } from "../src/lib/history/scan.js"

const fx = (n: string) => readFileSync(new URL(`./fixtures/history/${n}`, import.meta.url), "utf8")
const fb = { sessionId: "fb", mtimeMs: 5, source: "s" }

describe("claude", () => {
  it("custom-title thắng, bỏ isMeta, lấy cwd và sessionId từ bản ghi", () => {
    const s = parseClaudeSession(fx("claude-session.jsonl"), fb)!
    expect(s.title).toBe("Login fix")
    expect(s.cwd).toBe("/w")
    expect(s.sessionId).toBe("11111111-1111-1111-1111-111111111111")
    expect(s.updatedAt).toBe(5)
  })
  it("không có title record thì dùng prompt đầu (đã format)", () => {
    const lines = fx("claude-session.jsonl").split("\n").filter((l) => !l.includes("custom-title")).join("\n")
    expect(parseClaudeSession(lines, fb)!.title).toBe("sửa bug đăng nhập")
  })
  it("mã hoá thư mục project không gộp dấu gạch", () => {
    expect(encodeClaudeProjectDir("/Volumes/Data/.x y")).toBe("-Volumes-Data--x-y")
  })
  it("file không có user message → undefined", () => {
    expect(parseClaudeSession('{"type":"summary"}\n', fb)).toBeUndefined()
  })
  it("bản ghi isSidechain (sub-agent) → undefined", () => {
    expect(parseClaudeSession(fx("claude-project/22222222-2222-2222-2222-222222222222/subagents/agent-x.jsonl"), fb)).toBeUndefined()
  })
  it("quét thư mục project chỉ lấy *.jsonl cấp đầu, bỏ subagents/", () => {
    const dir = fileURLToPath(new URL("./fixtures/history/claude-project", import.meta.url))
    const sessions = claudeSessionsInDir(dir, 50)
    expect(sessions.map((s) => s.sessionId)).toEqual(["11111111-1111-1111-1111-111111111111"])
  })
})

describe("codex", () => {
  it("lấy id/cwd từ session_meta và input_text đầu", () => {
    const s = parseCodexRollout(fx("codex-rollout.jsonl"), fb)!
    expect(s).toMatchObject({ toolId: "codex", sessionId: "c0dex-1", cwd: "/w", title: "refactor auth" })
  })
})

describe("grok", () => {
  it("summary.title thắng; thiếu thì lột <user_query>", () => {
    expect(parseGrokSession(fx("grok-summary.json"), fx("grok-chat.jsonl"), fb)!.title).toBe("Grok việc A")
    expect(parseGrokSession(undefined, fx("grok-chat.jsonl"), fb)!.title).toBe("hỏi grok")
  })
})
