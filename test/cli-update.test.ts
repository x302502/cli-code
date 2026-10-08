import { describe, expect, it } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { CliUpdates, installationProfile, parseVersion, isNewerVersion, withSelfUpdate } from "../src/lib/cli-update.js"
import type { CliTool } from "../src/lib/config.js"

const tool: CliTool = { id: "test", label: "Test", icon: "test.svg", command: "TEST_MODE=1 test-cli --yolo" }
const profile = {
  latestUrl: "https://registry.npmjs.org/test-cli/latest",
  updateCommand: "npm install -g test-cli@latest",
}

describe("CLI versions", () => {
  it("reads CLI output, strips ANSI, and keeps prerelease identifiers", () => {
    expect(parseVersion("\x1b[32mcodex-cli 0.100.0\x1b[0m\n")).toBe("0.100.0")
    expect(parseVersion("v2.0.0-beta.10+abc")).toBe("2.0.0-beta.10+abc")
    expect(parseVersion("cursor-agent 2026.10.07-abcd")).toBe("2026.10.07-abcd")
    expect(parseVersion("failed to connect")).toBeUndefined()
  })
  it("orders numerically and does not advertise a downgrade or a prerelease over stable", () => {
    expect(isNewerVersion("0.100.0", "0.99.9")).toBe(true)
    expect(isNewerVersion("2.0.0", "2.0.0-beta.10")).toBe(true)
    expect(isNewerVersion("2.0.0-beta.10", "2.0.0-beta.2")).toBe(true)
    expect(isNewerVersion("2.0.0-beta.1", "2.0.0")).toBe(false)
    expect(isNewerVersion("1.9.0", "2.0.0")).toBe(false)
    expect(isNewerVersion("2.0.0+new", "2.0.0+old")).toBe(false)
  })
})

describe("CLI update lifecycle", () => {
  function fixture() {
    let version = "1.0.0"
    let installs = 0
    let latestReads = 0
    let failure = false
    let noChange = false
    const updates = new CliUpdates({
      run: async (command) => {
        if (command === "test-cli --version") return version
        if (command === profile.updateCommand) {
          installs++
          if (failure) throw new Error("permission denied")
          if (!noChange) version = "1.1.0"
          return "done"
        }
        throw new Error(`Unexpected command: ${command}`)
      },
      profile: async () => profile,
      json: async () => {
        latestReads++
        return { version: "1.1.0" }
      },
    })
    return {
      updates,
      setVersion: (v: string) => {
        version = v
      },
      fail: () => {
        failure = true
      },
      noChange: () => {
        noChange = true
      },
      counts: () => ({ installs, latestReads }),
    }
  }
  it("advertises an update and verifies the installed version before allowing restart", async () => {
    const f = fixture()
    expect(await f.updates.check(tool, "1.0.0")).toEqual({ kind: "available", version: "1.1.0", canUpdate: true })
    expect(await f.updates.install(tool, "1.1.0")).toBe("1.1.0")
    expect(await f.updates.check(tool, "1.0.0")).toEqual({ kind: "installed", version: "1.1.0", canUpdate: true })
  })
  it("detects an external update without needing a network request", async () => {
    const f = fixture()
    f.setVersion("1.1.0")
    expect(await f.updates.check(tool, "1.0.0")).toEqual({ kind: "installed", version: "1.1.0", canUpdate: true })
    expect(f.counts().latestReads).toBe(0)
  })
  it("refreshes the installed version on click even when a periodic check was cached", async () => {
    const f = fixture()
    await f.updates.check(tool, "1.0.0")
    f.setVersion("1.1.0")
    expect((await f.updates.check(tool, "1.0.0", {}, true)).kind).toBe("installed")
  })
  it("does not treat an unknown running version as an installed update", async () => {
    const f = fixture()
    expect((await f.updates.check(tool, undefined)).kind).toBe("available")
  })
  it("preserves a failed update and rejects a successful command that did not install the target", async () => {
    const f = fixture()
    f.fail()
    await expect(f.updates.install(tool, "1.1.0")).rejects.toThrow("permission denied")
    expect((await f.updates.check(tool, "1.0.0")).kind).toBe("available")
    const g = fixture()
    g.noChange()
    await expect(g.updates.install(tool, "1.1.0")).rejects.toThrow("still reports")
  })
  it("shares checks and serializes updates across variants of one binary", async () => {
    const f = fixture()
    const variant = { ...tool, id: "test-team" }
    await Promise.all([f.updates.check(tool, "1.0.0"), f.updates.check(variant, "1.0.0")])
    expect(f.counts().latestReads).toBe(1)
    await Promise.all([f.updates.install(tool, "1.1.0"), f.updates.install(variant, "1.1.0")])
    expect(f.counts().installs).toBe(1)
  })
  it("ignores a failed latest-version lookup while keeping installed-update detection", async () => {
    const updates = new CliUpdates({
      run: async () => "1.1.0",
      profile: async () => profile,
      json: async () => {
        throw new Error("offline")
      },
    })
    expect((await updates.check(tool, "1.1.0")).kind).toBe("current")
    expect((await updates.check(tool, "1.0.0")).kind).toBe("installed")
  })
  it("detects a replaced build on the same release date", async () => {
    const updates = new CliUpdates({
      run: async () => "2026.10.07-aaaa",
      profile: async () => undefined,
      json: async () => ({}),
    })
    expect((await updates.check(tool, "2026.10.07-zzzz")).kind).toBe("installed")
  })
  it("uses explicit version/check/update commands for a custom installation", async () => {
    const updates = new CliUpdates({
      run: async (command) => ({ "custom version": "1.0.0", "custom latest": "1.2.0" })[command] ?? "",
      profile: async () => undefined,
      json: async () => {
        throw new Error("unexpected network request")
      },
    })
    expect(
      await updates.check(tool, "1.0.0", {
        versionCommand: "custom version",
        latestVersionCommand: "custom latest",
        updateCommand: "custom update",
      }),
    ).toEqual({ kind: "available", version: "1.2.0", canUpdate: true })
  })
  it("reads Cursor's advertised version from its official installer without executing it", async () => {
    const updates = new CliUpdates({
      run: async () => "2026.09.30-abcdef",
      profile: async () => ({ latestUrl: "https://cursor.com/install", updateCommand: "cursor-agent update" }),
      json: async () =>
        'TEMP=".tmp-2026.10.01-e373342-$(date +%s)"\nDOWNLOAD_URL="https://downloads.cursor.com/lab/2026.10.01-e373342/${OS}/${ARCH}/agent-cli-package.tar.gz"',
    })
    expect(await updates.check(tool, "2026.09.30-abcdef")).toEqual({
      kind: "available",
      version: "2026.10.01-e373342",
      canUpdate: true,
    })
  })
  it("advertises a published build on the same date even when its hash sorts lower", async () => {
    const updates = new CliUpdates({
      run: async () => "2026.10.07-zzzz",
      profile: async () => profile,
      json: async () => ({ version: "2026.10.07-aaaa" }),
    })
    expect((await updates.check(tool, "2026.10.07-zzzz")).kind).toBe("available")
  })
  it("does not mistake an unchanged date/build version for a verified installation", async () => {
    const updates = new CliUpdates({
      run: async () => "2026.10.07-zzzz",
      profile: async () => profile,
      json: async () => ({ version: "2026.10.07-aaaa" }),
    })
    await expect(updates.install(tool, "2026.10.07-aaaa")).rejects.toThrow("still reports")
  })
  it("accepts the advertised SemVer release when the executable adds build metadata", async () => {
    const updates = new CliUpdates({
      run: async () => "1.1.0+native",
      profile: async () => profile,
      json: async () => ({ version: "1.1.0" }),
    })
    expect(await updates.install(tool, "1.1.0")).toBe("1.1.0+native")
  })
})

describe("installation detection", () => {
  it("updates the actual global npm prefix and never promotes a project dependency to a global install", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cli-update-"))
    try {
      const pkg = path.join(root, "lib/node_modules/@vendor/test-cli")
      fs.mkdirSync(path.join(pkg, "bin"), { recursive: true })
      fs.writeFileSync(
        path.join(pkg, "package.json"),
        JSON.stringify({ name: "@vendor/test-cli", bin: { "test-cli": "bin/run.js" } }),
      )
      const command = path.join(pkg, "bin/run.js")
      fs.writeFileSync(command, "")
      const detected = installationProfile("test-cli", command)!
      expect(detected.latestUrl).toBe("https://registry.npmjs.org/%40vendor%2Ftest-cli/latest")
      expect(detected.updateCommand).toContain(`--prefix '${root}'`)
      expect(detected.updateCommand).toContain("'@vendor/test-cli@latest'")
      const local = path.join(root, "project/node_modules/test-cli")
      fs.mkdirSync(local, { recursive: true })
      fs.writeFileSync(
        path.join(local, "package.json"),
        JSON.stringify({ name: "test-cli", bin: { "test-cli": "run.js" } }),
      )
      fs.writeFileSync(path.join(local, "run.js"), "")
      expect(installationProfile("test-cli", path.join(local, "run.js"))?.updateCommand).toBeUndefined()
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
  it("keeps a Homebrew installation on its own update channel", () => {
    expect(installationProfile("claude", "/opt/homebrew/Caskroom/claude-code/2.1.0/claude")).toEqual({
      latestUrl: "https://formulae.brew.sh/api/cask/claude-code.json",
      updateCommand: "brew upgrade --cask 'claude-code'",
    })
  })
  it("resolves npm's Windows launcher to the package it actually launches", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cli-update-shim-"))
    try {
      const pkg = path.join(root, "node_modules/@vendor/test-cli")
      fs.mkdirSync(path.join(pkg, "bin"), { recursive: true })
      fs.writeFileSync(
        path.join(pkg, "package.json"),
        JSON.stringify({ name: "@vendor/test-cli", bin: { "test-cli": "bin/run.js" } }),
      )
      fs.writeFileSync(path.join(pkg, "bin/run.js"), "")
      const shim = path.join(root, "test-cli.cmd")
      fs.writeFileSync(shim, '"%dp0%\\node_modules\\@vendor\\test-cli\\bin\\run.js" %*')
      expect(installationProfile("test-cli", shim)?.updateCommand).toContain(`--prefix '${root}'`)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
  it("selects uv or pipx from the actual Python tool environment", () => {
    expect(installationProfile("kimi", "/Users/me/.local/share/uv/tools/kimi-cli/bin/kimi")?.updateCommand).toBe(
      "uv tool upgrade 'kimi-cli'",
    )
    expect(installationProfile("aider", "/Users/me/.local/share/pipx/venvs/aider-chat/bin/aider")?.updateCommand).toBe(
      "pipx upgrade 'aider-chat'",
    )
    expect(installationProfile("aider", "/project/.venv/bin/aider")).toBeUndefined()
  })
})

describe("latest version lookup failures", () => {
  it("retries after a failed lookup instead of caching it", async () => {
    let calls = 0
    const updates = new CliUpdates({
      run: async () => "1.0.0",
      profile: async () => profile,
      json: async () => {
        if (++calls === 1) throw new Error("offline")
        return { version: "2.0.0" }
      },
    })
    expect((await updates.check(tool, "1.0.0")).kind).toBe("current")
    expect((await updates.check(tool, "1.0.0")).kind).toBe("available")
    expect(calls).toBe(2)
  })
})

describe("CLIs update themselves", () => {
  it("prefers the CLI's own command over the one inferred from its installation", () => {
    expect(withSelfUpdate("omp", { latestUrl: "u", updateCommand: "bun add -g x@latest" })).toEqual({
      latestUrl: "u",
      updateCommand: "omp update",
    })
    expect(withSelfUpdate("claude", undefined)).toEqual({ updateCommand: "claude update" })
    expect(withSelfUpdate("pi", {})?.updateCommand).toBe("pi update --self")
  })
  it("leaves a CLI without an update command of its own as detected", () => {
    const detected = { latestUrl: "u", updateCommand: "pipx upgrade aider" }
    expect(withSelfUpdate("aider", detected)).toBe(detected)
    expect(withSelfUpdate("aider", undefined)).toBeUndefined()
  })
})
