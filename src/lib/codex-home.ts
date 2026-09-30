import * as os from "node:os"
import * as path from "node:path"

/** The folder Codex reads its config and sessions from: CODEX_HOME when set (as for Codex
 * itself; an empty one counts as unset), else ~/.codex. The one place that decides it. */
export function codexDir(home: string = os.homedir()): string {
  return process.env.CODEX_HOME || path.join(home, ".codex")
}
