// scripts/vsix-allowlist.mjs
// What a package may contain at the top level. Anything else (a CI artifact folder, a tool's
// config file, …) fails verification, because an ignore rule is easy to forget and the package
// otherwise ships whatever happens to sit in the build checkout.
const ROOT = ["extension", "[Content_Types].xml", "extension.vsixmanifest"]
const EXTENSION = ["dist", "docs", "images", "media", "node_modules", "package.json", "changelog.md", "license.txt", "readme.md"]
const TRANSLATED_README = /^readme\.[a-z]{2}\.md$/
const NODE_MODULES = ["@xterm", "node-pty"]

const known = (name, allowed) => allowed.includes(name.toLowerCase())

/** @param {{ root: string[], extension: string[], nodeModules: string[] }} names top-level entries of each place */
export function unexpectedEntries({ root, extension, nodeModules }) {
  const out = []
  for (const n of root) if (!known(n, ROOT.map((r) => r.toLowerCase()))) out.push(`should not ship ${n} (package root)`)
  for (const n of extension) if (!known(n, EXTENSION) && !TRANSLATED_README.test(n.toLowerCase())) out.push(`should not ship ${n}`)
  for (const n of nodeModules) if (!known(n, NODE_MODULES)) out.push(`should not ship node_modules/${n}`)
  return out
}
