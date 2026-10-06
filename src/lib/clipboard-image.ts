import { execFile } from "node:child_process"
import { createHash } from "node:crypto"

/** The PNG bytes in osascript's `«data PNGf89504E…»`, or undefined if that is not what it printed. */
export function parseAppleScriptPng(out: string): Uint8Array | undefined {
  const m = /«data PNGf([0-9A-Fa-f]+)»/.exec(out)
  return m ? Uint8Array.from(Buffer.from(m[1]!, "hex")) : undefined
}

/**
 * The image on the system clipboard, read the way Claude reads it for Ctrl+V / Cmd+V — only so the
 * draft preview can show what the CLI just attached. macOS only; elsewhere, undefined.
 */
export function readClipboardImage(): Promise<Uint8Array | undefined> {
  if (process.platform !== "darwin") return Promise.resolve(undefined)
  return new Promise((resolve) => {
    // Hex doubles the size: room for a ~25 MB screenshot.
    execFile("osascript", ["-e", "the clipboard as «class PNGf»"], { maxBuffer: 64 * 1024 * 1024, timeout: 5000 }, (err, stdout) =>
      resolve(err ? undefined : parseAppleScriptPng(stdout)),
    )
  })
}

/** Temp file a preview image is written to so VS Code's image viewer can open it: named after
 * its content, so the same image opened again reuses the file (and the editor tab). */
export function imageViewFileName(bytes: Uint8Array): string {
  return `cli-code-image-${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}.png`
}
