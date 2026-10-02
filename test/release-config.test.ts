import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"

const read = (p: string) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), "utf8"))
const config = read("release-please-config.json")

// The version policy (docs/releasing.md): in 0.x every feat/fix/perf is a patch and only a
// breaking change is a minor. Flipping either flag silently changes what the next release is.
describe("release-please config", () => {
  it("keeps the 0.x version policy", () => {
    expect(config["bump-patch-for-minor-pre-major"]).toBe(true)
    expect(config["bump-minor-pre-major"]).toBe(true)
    expect(config["release-as"]).toBeUndefined()
    expect(config.packages["."]["release-as"]).toBeUndefined()
  })
  it("tags as vX.Y.Z for the root package", () => {
    expect(config["include-v-in-tag"]).toBe(true)
    expect(config["include-component-in-tag"]).toBe(false)
    expect(config["release-type"]).toBe("node")
  })
  it("starts from the version package.json has", () => {
    expect(read(".release-please-manifest.json")["."]).toBe(read("package.json").version)
  })
  it("lists feat, fix, perf and docs in the notes", () => {
    const shown = config["changelog-sections"].filter((s: { hidden?: boolean }) => !s.hidden).map((s: { type: string }) => s.type)
    expect(shown).toEqual(expect.arrayContaining(["feat", "fix", "perf", "docs"]))
  })
})
