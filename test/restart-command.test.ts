import { describe, expect, it } from "bun:test"
import { continueLatestCommand, restartCommand } from "../src/lib/restart-command.js"
import type { CliTool } from "../src/lib/config.js"
import type { SessionSummary } from "../src/lib/history/types.js"

const claude: CliTool = { id: "claude", label: "Claude", icon: "", themeIcon: "", command: "claude --x", hasHttpApi: false, resumeCommand: "claude --resume {sessionId} --x" }
const copilot: CliTool = { id: "copilot", label: "Copilot", icon: "", themeIcon: "", command: "copilot", hasHttpApi: false, continueCommand: "copilot --continue" }
const plain: CliTool = { id: "pi", label: "Pi", icon: "", themeIcon: "", command: "pi", hasHttpApi: false }
const s = (toolId: string, sessionId: string, updatedAt: number): SessionSummary => ({ toolId, sessionId, title: "", updatedAt, source: "" })

describe("restartCommand", () => {
  it("prefers the session id the CLI's hook reported", () => {
    expect(restartCommand({ tool: claude, baseCommand: "claude --x", cliSessionId: "abc-1", sessions: [], spawnedAt: 1000 })).toBe("claude --resume abc-1 --x")
  })
  it("falls back to the newest transcript of that tool written since the tab was spawned", () => {
    const sessions = [s("claude", "new", 5000), s("codex", "other", 6000), s("claude", "old", 500)]
    expect(restartCommand({ tool: claude, baseCommand: "claude --x", sessions, spawnedAt: 1000 })).toBe("claude --resume new --x")
  })
  it("a transcript older than the spawn belongs to another tab: start fresh", () => {
    expect(restartCommand({ tool: claude, baseCommand: "claude --x", sessions: [s("claude", "old", 500)], spawnedAt: 1000 })).toBe("claude --x")
  })
  it("keeps a command that already resumes or continues", () => {
    expect(restartCommand({ tool: claude, baseCommand: "claude --resume zzz --x", sessions: [s("claude", "new", 5000)], spawnedAt: 1000 })).toBe("claude --resume zzz --x")
    expect(restartCommand({ tool: copilot, baseCommand: "copilot --continue", sessions: [], spawnedAt: 1000 })).toBe("copilot --continue")
  })
  it("continue-only CLIs use their continue command; CLIs with neither restart as-is", () => {
    expect(restartCommand({ tool: copilot, baseCommand: "copilot", sessions: [], spawnedAt: 1000 })).toBe("copilot --continue")
    expect(restartCommand({ tool: plain, baseCommand: "pi", sessions: [s("pi", "x", 5000)], spawnedAt: 1000 })).toBe("pi")
  })
  it("rejects session ids that are not safe to splice into a shell command", () => {
    expect(restartCommand({ tool: claude, baseCommand: "claude --x", cliSessionId: "a b; rm", sessions: [], spawnedAt: 1000 })).toBe("claude --x")
  })

  it("a variant sharing another CLI's transcripts (Claude Agent Teams) resumes through historyToolId", () => {
    const teams: CliTool = { ...claude, id: "claude-agent-teams", historyToolId: "claude", resumeCommand: "X=1 claude --resume {sessionId}" }
    expect(restartCommand({ tool: teams, baseCommand: "X=1 claude", sessions: [s("claude", "t1", 5000)], spawnedAt: 1000 })).toBe("X=1 claude --resume t1")
  })
})

describe("continueLatestCommand", () => {
  const base: CliTool = { id: "x", label: "X", icon: "", themeIcon: "", command: "x", hasHttpApi: false }
  const cline: CliTool = { ...base, id: "cline", resumeCommand: "cline --id {sessionId}", continueCommand: undefined }
  const amp: CliTool = { ...base, id: "amp", resumeCommand: "amp threads continue {sessionId}", continueCommand: "amp threads continue --last" }
  it("resumes the folder's newest session by id when the CLI's store names one", () => {
    expect(continueLatestCommand(cline, "abc-123")).toBe("cline --id abc-123")
    expect(continueLatestCommand(amp, "T-1")).toBe("amp threads continue T-1")
  })
  it("falls back to the CLI's own --continue, or nothing for CLIs without one", () => {
    expect(continueLatestCommand(amp, undefined)).toBe("amp threads continue --last")
    expect(continueLatestCommand(cline, undefined)).toBeUndefined()
  })
  it("never splices an unsafe id into a shell line", () => {
    expect(continueLatestCommand(amp, "x; rm -rf /")).toBe("amp threads continue --last")
  })
})
