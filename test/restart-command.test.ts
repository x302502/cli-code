import { describe, expect, it } from "bun:test"
import { continueLatestCommand, restartCommand, resumesConversation, sessionIdFromCommand } from "../src/lib/restart-command.js"
import type { CliTool } from "../src/lib/config.js"
import type { SessionSummary } from "../src/lib/history/types.js"

const claude: CliTool = { id: "claude", label: "Claude", icon: "", command: "claude --x", resumeCommand: "claude --resume {sessionId} --x" }
const copilot: CliTool = { id: "copilot", label: "Copilot", icon: "", command: "copilot", continueCommand: "copilot --continue" }
const plain: CliTool = { id: "pi", label: "Pi", icon: "", command: "pi" }
const s = (toolId: string, sessionId: string, updatedAt: number): SessionSummary => ({ toolId, sessionId, title: "", updatedAt, source: "" })

describe("restartCommand", () => {
  it("prefers the session id the CLI's hook reported, even over a pinned --resume (the user may have switched conversations)", () => {
    expect(restartCommand({ tool: claude, baseCommand: "claude --x", reportedSessionId: "abc-1", sessions: [], spawnedAt: 1000 })).toBe("claude --resume abc-1 --x")
    expect(restartCommand({ tool: claude, baseCommand: "claude --resume old --x", reportedSessionId: "new", sessions: [], spawnedAt: 1000 })).toBe("claude --resume new --x")
  })
  it("a session id located in the CLI's store is only a guess: it never overrides a pinned --resume", () => {
    expect(restartCommand({ tool: claude, baseCommand: "claude --x", locatedSessionId: "abc-1", sessions: [], spawnedAt: 1000 })).toBe("claude --resume abc-1 --x")
    expect(restartCommand({ tool: claude, baseCommand: "claude --resume old --x", locatedSessionId: "other", sessions: [], spawnedAt: 1000 })).toBe("claude --resume old --x")
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
    expect(restartCommand({ tool: claude, baseCommand: "claude --x", reportedSessionId: "a b; rm", sessions: [], spawnedAt: 1000 })).toBe("claude --x")
    expect(restartCommand({ tool: claude, baseCommand: "claude --x", locatedSessionId: "a b; rm", sessions: [], spawnedAt: 1000 })).toBe("claude --x")
  })

  it("a variant sharing another CLI's transcripts (Claude Agent Teams) resumes through historyToolId", () => {
    const teams: CliTool = { ...claude, id: "claude-agent-teams", historyToolId: "claude", resumeCommand: "X=1 claude --resume {sessionId}" }
    expect(restartCommand({ tool: teams, baseCommand: "X=1 claude", sessions: [s("claude", "t1", 5000)], spawnedAt: 1000 })).toBe("X=1 claude --resume t1")
  })
})

describe("continueLatestCommand", () => {
  const base: CliTool = { id: "x", label: "X", icon: "", command: "x" }
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

describe("restartCommand — several tabs of one CLI in one folder", () => {
  const cc: CliTool = { id: "command-code", label: "Command Code", icon: "", command: "command-code --yolo", resumeCommand: "command-code --yolo --resume {sessionId}", continueCommand: "command-code --yolo --continue" }
  it("never guesses while a sibling tab's conversation is unknown: the newest session may be the sibling's", () => {
    const args = { tool: cc, baseCommand: "command-code --yolo", locatedSessionId: "session-b", sessions: [], spawnedAt: 1000 }
    expect(restartCommand({ ...args, siblings: [{}] })).toBe("command-code --yolo")
    // --continue is the same guess ("latest"): not used either.
    expect(restartCommand({ ...args, locatedSessionId: undefined, siblings: [{}] })).toBe("command-code --yolo")
  })
  it("a candidate another tab already owns is not this tab's", () => {
    expect(restartCommand({ tool: cc, baseCommand: "command-code --yolo", locatedSessionId: "session-b", sessions: [], spawnedAt: 1000, siblings: [{ sessionId: "session-b" }] })).toBe("command-code --yolo")
  })
  it("with every sibling's conversation known and different, the located session is this tab's", () => {
    expect(restartCommand({ tool: cc, baseCommand: "command-code --yolo", locatedSessionId: "session-a", sessions: [], spawnedAt: 1000, siblings: [{ sessionId: "session-b" }] })).toBe("command-code --yolo --resume session-a")
  })
  it("from a history list, the newest session no sibling owns", () => {
    const sessions = [s("claude", "b", 6000), s("claude", "a", 5000)]
    expect(restartCommand({ tool: claude, baseCommand: "claude --x", sessions, spawnedAt: 1000, siblings: [{ sessionId: "b" }] })).toBe("claude --resume a --x")
  })
  it("a tab opened with --continue is not pinned: it goes through the same ownership checks", () => {
    const args = { tool: cc, baseCommand: "command-code --yolo --continue", sessions: [], spawnedAt: 1000 }
    expect(restartCommand({ ...args, locatedSessionId: "session-b", siblings: [{ sessionId: "session-b" }] })).toBe("command-code --yolo")
    expect(restartCommand({ ...args, siblings: [{}] })).toBe("command-code --yolo")
    expect(restartCommand({ ...args, locatedSessionId: "session-a", siblings: [{ sessionId: "session-b" }] })).toBe("command-code --yolo --resume session-a")
    expect(restartCommand({ ...args, siblings: [] })).toBe("command-code --yolo --continue")
  })
  it("reported and pinned identities are unaffected by siblings", () => {
    expect(restartCommand({ tool: cc, baseCommand: "command-code --yolo", reportedSessionId: "mine", sessions: [], spawnedAt: 1000, siblings: [{}] })).toBe("command-code --yolo --resume mine")
    expect(restartCommand({ tool: cc, baseCommand: "command-code --yolo --resume pinned", sessions: [], spawnedAt: 1000, siblings: [{}] })).toBe("command-code --yolo --resume pinned")
  })
})

describe("sessionIdFromCommand", () => {
  it("reads the id back out of a filled-in resume command", () => {
    expect(sessionIdFromCommand("claude --resume abc --x", "claude --resume {sessionId} --x")).toBe("abc")
    expect(sessionIdFromCommand("claude --x", "claude --resume {sessionId} --x")).toBeUndefined()
  })
})

describe("resumesConversation", () => {
  const cc: CliTool = { id: "command-code", label: "", icon: "", command: "command-code --yolo", resumeCommand: "command-code --yolo --resume {sessionId}", continueCommand: "command-code --yolo --continue" }
  it("resume by id and --continue carry the conversation on; the bare command starts a new one", () => {
    expect(resumesConversation(cc, "command-code --yolo --resume abc")).toBe(true)
    expect(resumesConversation(cc, "command-code --yolo --continue")).toBe(true)
    expect(resumesConversation(cc, "command-code --yolo")).toBe(false)
  })
})
