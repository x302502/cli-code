import * as pty from "node-pty"
import { startDaemon } from "./server.js"
import type { PtyLike } from "./session.js"

const socketPath = process.argv[2]
if (!socketPath) {
  process.exit(1)
}

void startDaemon({
  socketPath,
  spawnPty: (opts): PtyLike => {
    // Run through the user's login shell so PATH and aliases match a normal terminal.
    const posixFallback = process.platform === "darwin" ? "/bin/zsh" : "/bin/bash"
    const shell = process.env.SHELL ?? (process.platform === "win32" ? "powershell.exe" : posixFallback)
    const args = process.platform === "win32" ? ["-NoLogo", "-Command", opts.command] : ["-lc", opts.command]
    return pty.spawn(shell, args, {
      name: "xterm-256color",
      cwd: opts.cwd,
      cols: opts.cols,
      rows: opts.rows,
      env: { ...process.env, ...opts.env, TERM: "xterm-256color" } as Record<string, string>,
    })
  },
  onIdleExit: () => process.exit(0),
})
