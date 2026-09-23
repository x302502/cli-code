import { describe, expect, it } from "bun:test"
import type { StatusHookInstaller } from "../src/lib/hooks/registry.js"
import { summarize, syncStatusHooks } from "../src/lib/hooks/sync.js"

function fake(id: string, opts: { installed?: boolean; fail?: boolean } = {}): StatusHookInstaller & { calls: string[] } {
  let installed = opts.installed ?? false
  const calls: string[] = []
  return {
    id,
    label: id.toUpperCase(),
    binary: id,
    calls,
    files: () => [],
    installed: () => installed,
    install: () => {
      calls.push("install")
      if (opts.fail) throw new Error("boom")
      const changed = !installed
      installed = true
      return changed
    },
    uninstall: () => {
      calls.push("uninstall")
      const changed = installed
      installed = false
      return changed
    },
  }
}

describe("syncStatusHooks", () => {
  it("enabled: installs where the binary exists, skips the rest, reports failures without stopping", () => {
    const a = fake("a"), b = fake("b"), c = fake("c", { fail: true }), d = fake("d", { installed: true })
    const res = syncStatusHooks({ installers: [a, b, c, d], home: "/h", enabled: true, onPath: (bin) => bin !== "b" })
    expect(res.map((r) => r.action)).toEqual(["installed", "skipped", "error", "unchanged"])
    expect(res[2]!.error).toContain("boom")
    expect(b.calls).toEqual([])
    expect(summarize(res)).toBe("Installed: A · Failed: C (Error: boom)")
  })
  it("disabled: removes everywhere, even where the binary is gone", () => {
    const a = fake("a", { installed: true }), b = fake("b")
    const res = syncStatusHooks({ installers: [a, b], home: "/h", enabled: false, onPath: () => false })
    expect(res.map((r) => r.action)).toEqual(["removed", "unchanged"])
    expect(summarize(res)).toBe("Removed: A")
    expect(summarize([])).toBe("Nothing to change.")
  })
})
