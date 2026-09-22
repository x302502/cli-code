import * as fs from "node:fs"
import * as pty from "node-pty"
import { splitEnvPrefix } from "../lib/command-env.js"
import { startDaemon } from "./server.js"
import type { PtyLike } from "./session.js"

const socketPath = process.argv[2]
const build = process.argv[3]
const buildStampPath = process.argv[4]
if (!socketPath) {
  process.exit(1)
}

void startDaemon({
  socketPath,
  spawnPty: (opts): PtyLike => {
    // Run through the user's *interactive* login shell (-ilc), exactly what a terminal tab is:
    // a plain login shell (-lc) skips .zshrc/.bashrc, where nvm, pnpm, pyenv and the CLIs'
    // own ~/.x/bin dirs land on PATH — Codex's MCP servers spawned via npx then picked the
    // wrong node and failed to start, while the same CLI worked in a terminal and in Orca.
    // SHELL is ignored on win32: a POSIX SHELL (e.g. from Git Bash) must not pair with the -NoLogo/-Command args below.
    const posixFallback = process.platform === "darwin" ? "/bin/zsh" : "/bin/bash"
    const shell = process.platform === "win32" ? "powershell.exe" : (process.env.SHELL ?? posixFallback)
    // A `VAR=value cmd` prefix is POSIX shell syntax PowerShell would choke on: apply it here.
    const { env: prefixEnv, command } = splitEnvPrefix(opts.command)
    const args = process.platform === "win32" ? ["-NoLogo", "-Command", command] : ["-ilc", command]
    const env = { ...process.env, ...opts.env, ...prefixEnv, TERM: "xterm-256color" } as Record<string, string>
    // The daemon itself is spawned with ELECTRON_RUN_AS_NODE=1 (so the editor's own Electron
    // binary runs it as plain node) and would otherwise pass that down into every CLI's shell.
    // From there it would make any Electron app launched in that shell (VS Code included) also
    // run as plain node — the same reason VS Code's own integrated terminal strips this var.
    delete env.ELECTRON_RUN_AS_NODE
    return pty.spawn(shell, args, {
      name: "xterm-256color",
      cwd: opts.cwd,
      cols: opts.cols,
      rows: opts.rows,
      env,
    })
  },
  onIdleExit: () => process.exit(0),
}).then(() => {
  // Lets the extension tell a daemon from an older build apart from the current one. A failed
  // stamp only makes this daemon look outdated; it must not become an unhandled rejection that
  // exits the daemon and kills every session.
  try {
    if (build && buildStampPath) fs.writeFileSync(buildStampPath, build)
  } catch {
    // stays unstamped
  }
})
