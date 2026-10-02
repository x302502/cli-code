// scripts/release-notes.mjs
// Usage: node scripts/release-notes.mjs 0.2.1   — prints that version's section of CHANGELOG.md
// (the same text release-please puts in the GitHub Release), or nothing if there is none.
import { readFileSync, realpathSync } from "node:fs"
import { fileURLToPath } from "node:url"

/** The body of the "## <version>" or "## [<version>](…)" section, without its heading. */
export function releaseNotes(changelog, version) {
  const lines = changelog.split("\n")
  const isHeading = (l) => /^## /.test(l)
  const own = (l) => l === `## ${version}` || l.startsWith(`## ${version} `) || l.startsWith(`## [${version}]`)
  const start = lines.findIndex((l) => isHeading(l) && own(l))
  if (start < 0) return ""
  const end = lines.findIndex((l, i) => i > start && isHeading(l))
  return lines.slice(start + 1, end < 0 ? undefined : end).join("\n").trim()
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const version = process.argv[2]
  if (!version) { console.error("usage: release-notes <version>"); process.exit(2) }
  const notes = releaseNotes(readFileSync("CHANGELOG.md", "utf8"), version)
  if (notes) console.log(notes)
}
