import { describe, expect, it } from "bun:test"
import { loginShell, splitEnvPrefix } from "../src/lib/command-env.js"

describe("splitEnvPrefix", () => {
  it("lifts leading VAR=value words into env so a non-POSIX shell (PowerShell) can run the command", () => {
    expect(splitEnvPrefix("CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --resume abc")).toEqual({
      env: { CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1" },
      command: "claude --resume abc",
    })
    expect(splitEnvPrefix("A=1 B=two goose")).toEqual({ env: { A: "1", B: "two" }, command: "goose" })
  })
  it("leaves a command without a prefix, or with '=' later in the line, untouched", () => {
    expect(splitEnvPrefix("claude --x")).toEqual({ env: {}, command: "claude --x" })
    expect(splitEnvPrefix("codex --config a=b")).toEqual({ env: {}, command: "codex --config a=b" })
    expect(splitEnvPrefix("./run X=1")).toEqual({ env: {}, command: "./run X=1" })
  })
})

describe("loginShell", () => {
  const all = () => true
  it("keeps a POSIX-compatible $SHELL that exists", () => {
    expect(loginShell("/opt/homebrew/bin/fish", "/bin/zsh", all)).toBe("/opt/homebrew/bin/fish")
    expect(loginShell("/bin/bash", "/bin/zsh", all)).toBe("/bin/bash")
  })
  it("falls back for shells that cannot run `-ilc 'VAR=x cmd'`, a missing binary, or no $SHELL", () => {
    for (const s of ["/opt/homebrew/bin/nu", "/usr/local/bin/xonsh", "/usr/bin/elvish"]) expect(loginShell(s, "/bin/zsh", all)).toBe("/bin/zsh")
    expect(loginShell("/usr/local/bin/zsh-gone", "/bin/zsh", all)).toBe("/bin/zsh")
    expect(loginShell("/usr/local/bin/zsh", "/bin/zsh", () => false)).toBe("/bin/zsh")
    expect(loginShell(undefined, "/bin/bash", all)).toBe("/bin/bash")
  })
})
