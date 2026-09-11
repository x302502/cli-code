import { describe, expect, it } from "bun:test"
import { extractBinary } from "../src/lib/detect.js"

describe("extractBinary", () => {
  it("extracts the first token as the binary for plain commands", () => {
    expect(extractBinary("claude --dangerously-skip-permissions")).toBe("claude")
    expect(extractBinary("codex --dangerously-bypass-approvals-and-sandbox")).toBe("codex")
    expect(extractBinary("droid")).toBe("droid")
  })

  it("skips env-var prefixes like GOOSE_MODE=auto", () => {
    expect(extractBinary("GOOSE_MODE=auto goose")).toBe("goose")
  })

  it("skips the {port} placeholder", () => {
    expect(extractBinary("opencode --port {port} --auto")).toBe("opencode")
  })

  it("handles commands with quoted arguments", () => {
    expect(extractBinary('cn --allow "*"')).toBe("cn")
  })

  it("handles the orca subcommand prefix", () => {
    expect(extractBinary("orca claude-teams --dangerously-skip-permissions")).toBe("orca")
  })

  it("returns the first token when no env vars are present", () => {
    expect(extractBinary("grok --permission-mode bypassPermissions")).toBe("grok")
    expect(extractBinary("command-code --yolo")).toBe("command-code")
    expect(extractBinary("kiro-cli --trust-all-tools")).toBe("kiro-cli")
  })
})
