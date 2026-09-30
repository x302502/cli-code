const esbuild = require("esbuild")

const production = process.argv.includes("--production")
const watch = process.argv.includes("--watch")
// `--tests` builds only the integration-test bundle: it must stay out of the
// production build (and the VSIX) and needs `mocha` left external so the
// extension host resolves it from node_modules.
const tests = process.argv.includes("--tests")

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
const entries = tests
  ? [{ entryPoints: ["test/integration/suite/index.ts"], outfile: "dist-test/suite/index.js", external: ["vscode", "mocha"] }]
  : [
      { entryPoints: ["src/extension.ts"], outfile: "dist/extension.js", external: ["vscode", "node-pty"] },
      { entryPoints: ["src/daemon/entry.ts"], outfile: "dist/daemon.js", external: ["node-pty"] },
      { entryPoints: ["src/hook/entry.ts"], outfile: "dist/hook.js", external: [] },
      { entryPoints: ["src/webview/main.ts"], outfile: "dist/webview.js", platform: "browser", format: "iife" },
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
