import { describe, expect, it } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { binaryOnPath, extractBinary } from "../src/lib/detect.js"

describe("extractBinary", () => {
  it("extracts the first token as the binary for plain commands", () => {
    expect(extractBinary("claude --dangerously-skip-permissions")).toBe("claude")
    expect(extractBinary("codex --dangerously-bypass-approvals-and-sandbox")).toBe("codex")
    expect(extractBinary("droid")).toBe("droid")
  })

  it("skips env-var prefixes like GOOSE_MODE=auto", () => {
    expect(extractBinary("GOOSE_MODE=auto goose")).toBe("goose")
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

describe("binaryOnPath", () => {
  it("finds an executable in a PATH dir without spawning anything", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-code-path-"))
    fs.writeFileSync(path.join(dir, "fakecli"), "#!/bin/sh\n", { mode: 0o755 })
    fs.writeFileSync(path.join(dir, "notexec"), "")
    expect(binaryOnPath("fakecli", `${dir}:/nonexistent`)).toBe(true)
    expect(binaryOnPath("notexec", dir)).toBe(false)
    expect(binaryOnPath("missing", dir)).toBe(false)
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
