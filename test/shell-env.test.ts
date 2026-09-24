import { describe, expect, it } from "bun:test"
import { parseEnvBlock, resetShellEnvCache, resolveShellEnv, shellEnv } from "../src/lib/shell-env.js"

const block = (entries: string[]) => `noise from .zshrc\n__CLI_CODE_ENV_START__${entries.join("\0")}__CLI_CODE_ENV_END__`

describe("parseEnvBlock", () => {
  it("reads NUL-separated KEY=VALUE pairs between the markers, ignoring rc-file noise around them", () => {
    expect(parseEnvBlock(block(["PATH=/a:/b", "NVM_DIR=/h/.nvm", "MULTI=x=y"]))).toEqual({ PATH: "/a:/b", NVM_DIR: "/h/.nvm", MULTI: "x=y" })
  })
  it("drops shell bookkeeping and ELECTRON_RUN_AS_NODE, and returns undefined without markers", () => {
    expect(parseEnvBlock(block(["PWD=/x", "SHLVL=3", "_=/usr/bin/env", "ELECTRON_RUN_AS_NODE=1", "HOME=/h"]))).toEqual({ HOME: "/h" })
    expect(parseEnvBlock("no markers here")).toBeUndefined()
  })
})

describe("resolveShellEnv", () => {
  it("asks an interactive login shell and parses its output; a failing probe yields undefined", async () => {
    const calls: { file: string; args: string[] }[] = []
    const env = await resolveShellEnv("/bin/zsh", async (file, args) => {
      calls.push({ file, args })
      return block(["PATH=/from/zshrc"])
    })
    expect(env).toEqual({ PATH: "/from/zshrc" })
    expect(calls[0]!.file).toBe("/bin/zsh")
    expect(calls[0]!.args[0]).toBe("-ilc")
    expect(await resolveShellEnv("/bin/zsh", async () => { throw new Error("timeout") })).toBeUndefined()
  })
  it("really works against this machine's shell (PATH comes back non-empty)", async () => {
    const env = await resolveShellEnv()
    expect(env?.PATH ?? "").not.toBe("")
  })
})

describe("shellEnv cache", () => {
  it("a failed probe is remembered too: a slow .zshrc costs its timeout once per minute, not on every call", async () => {
    resetShellEnvCache()
    let calls = 0
    const failing = async () => {
      calls++
      return undefined
    }
    expect(await shellEnv(failing)).toBeUndefined()
    expect(await shellEnv(failing)).toBeUndefined()
    expect(calls).toBe(1)
  })
})
