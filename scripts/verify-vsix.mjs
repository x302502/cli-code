// scripts/verify-vsix.mjs
// Usage: node scripts/verify-vsix.mjs cli-code-0.2.0-darwin-arm64.vsix
// Opens the package and checks the runtime files the extension cannot live without.
import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, statSync, rmSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const file = process.argv[2]
if (!file || !existsSync(file)) { console.error("usage: verify-vsix <file.vsix>"); process.exit(2) }
const target = /-(darwin|win32|linux)-(arm64|x64)\.vsix$/.exec(file)?.slice(1, 3).join("-")
if (!target) { console.error("file name must end with -<platform>-<arch>.vsix"); process.exit(2) }

const dir = mkdtempSync(join(tmpdir(), "vsix-verify-"))
const failures = []
try {
  try {
    execFileSync("unzip", ["-q", file, "-d", dir])
  } catch (err) {
    console.error(`FAIL: cannot extract ${file}: ${err.message}`)
    process.exit(2)
  }
  const ext = join(dir, "extension")
  const must = [
    "dist/extension.js", "dist/daemon.js", "dist/webview.js", "dist/hook.js",
    "node_modules/@xterm/xterm/css/xterm.css",
    "node_modules/node-pty/package.json", "node_modules/node-pty/lib/index.js",
    `node_modules/node-pty/prebuilds/${target}`,
  ]
  for (const m of must) if (!existsSync(join(ext, m))) failures.push(`missing ${m}`)
  const prebuilds = existsSync(join(ext, "node_modules/node-pty/prebuilds")) ? readdirSync(join(ext, "node_modules/node-pty/prebuilds")) : []
  if (prebuilds.length !== 1) failures.push(`expected exactly one prebuild dir, got ${prebuilds.join(",") || "none"}`)
  for (const bad of ["src", "test", "docs", "scripts"]) if (existsSync(join(ext, bad))) failures.push(`should not ship ${bad}/`)
  if (!target.startsWith("win32")) {
    const helper = join(ext, `node_modules/node-pty/prebuilds/${target}/spawn-helper`)
    if (!existsSync(helper)) failures.push("missing spawn-helper")
    else if (!(statSync(helper).mode & 0o111)) failures.push("spawn-helper is not executable")
  } else {
    const conpty = join(ext, `node_modules/node-pty/prebuilds/${target}/conpty.node`)
    if (!existsSync(conpty)) failures.push(`missing node_modules/node-pty/prebuilds/${target}/conpty.node`)
  }
  // Recursively reject shipped source maps and dev-only directories anywhere under extension/,
  // not just at its top level (the bad-dir check above only covers extension/<name>).
  const walk = (dirPath, relPath) => {
    for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
      const entryRel = relPath ? `${relPath}/${entry.name}` : entry.name
      const entryAbs = join(dirPath, entry.name)
      if (entry.isDirectory()) {
        if (["src", "test", "docs", "scripts"].includes(entry.name) && relPath === "") {
          continue // already reported by the top-level bad-dir check above
        }
        walk(entryAbs, entryRel)
      } else if (entry.name.endsWith(".map")) {
        failures.push(`should not ship ${entryRel}`)
      }
    }
  }
  if (existsSync(ext)) walk(ext, "")
} finally {
  rmSync(dir, { recursive: true, force: true })
}
if (failures.length) { console.error("FAIL\n" + failures.map((f) => "  - " + f).join("\n")); process.exit(1) }
console.log(`PASS ${file}`)
