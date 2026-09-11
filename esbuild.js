const esbuild = require("esbuild")

const production = process.argv.includes("--production")
const watch = process.argv.includes("--watch")

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",

  setup(build) {
    build.onStart(() => {
      console.log("[watch] build started")
    })
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`)
        console.error(`    ${location.file}:${location.line}:${location.column}:`)
      })
      console.log("[watch] build finished")
    })
  },
}

// Each entry may override platform/format; the shared defaults below apply otherwise.
const entries = [
  { entryPoints: ["src/extension.ts"], outfile: "dist/extension.js", external: ["vscode", "node-pty"] },
  { entryPoints: ["src/daemon/entry.ts"], outfile: "dist/daemon.js", external: ["node-pty"] },
]

async function main() {
  const contexts = await Promise.all(
    entries.map((entry) =>
      esbuild.context({
        bundle: true,
        format: "cjs",
        minify: production,
        sourcemap: !production,
        sourcesContent: false,
        platform: "node",
        logLevel: "silent",
        plugins: [
          /* add to the end of plugins array */
          esbuildProblemMatcherPlugin,
        ],
        ...entry,
      }),
    ),
  )
  if (watch) {
    await Promise.all(contexts.map((ctx) => ctx.watch()))
  } else {
    await Promise.all(contexts.map((ctx) => ctx.rebuild()))
    await Promise.all(contexts.map((ctx) => ctx.dispose()))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
