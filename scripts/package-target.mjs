// scripts/package-target.mjs
// Usage: node scripts/package-target.mjs darwin-arm64
// Builds a VSIX for one VS Code target, shipping only that platform's node-pty prebuild.
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const TARGETS = ["darwin-arm64", "darwin-x64", "win32-x64", "win32-arm64", "linux-x64", "linux-arm64"]
const target = process.argv[2]
if (!TARGETS.includes(target)) {
  console.error(`usage: node scripts/package-target.mjs <${TARGETS.join("|")}>`)
  process.exit(2)
}

// vsce's ignore/negate matching is NOT sequential like .gitignore: a file is kept if it
// matches ANY negate pattern, regardless of more specific ignore patterns added after.
// So we can't keep the base file's blanket "!prebuilds/**" negation and then re-exclude
// other platforms/pdb — that ignore would always lose to the blanket negate. Instead, swap
// the blanket negation for one scoped to just this target (still excluding *.pdb symbols).
const base = readFileSync(".vscodeignore", "utf8")
const withoutBlanketPrebuilds = base
  .split("\n")
  .filter((line) => line.trim() !== "!node_modules/node-pty/prebuilds/**")
  .join("\n")
const targetPrebuilds = `!node_modules/node-pty/prebuilds/${target}/**/!(*.pdb)`
const ignoreFile = join(mkdtempSync(join(tmpdir(), "cli-code-ignore-")), ".vscodeignore")
writeFileSync(ignoreFile, `${withoutBlanketPrebuilds}\n${targetPrebuilds}\n`)

const version = JSON.parse(readFileSync("package.json", "utf8")).version
const out = `cli-code-${version}-${target}.vsix`
// Note: --no-dependencies is NOT used here — it disables vsce's node_modules
// collection entirely, dropping node-pty and xterm's stylesheet from the VSIX
// regardless of the .vscodeignore negations above.
execFileSync("npx", ["@vscode/vsce", "package", "--target", target, "--ignoreFile", ignoreFile, "--out", out], { stdio: "inherit" })
console.log(`wrote ${out} (${statSync(out).size} bytes)`)
