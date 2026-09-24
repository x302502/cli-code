import { describe, expect, it, mock } from "bun:test"
import { vscode } from "./vscode-mock.js"

// Detection is slow in real life (it asks the shell); here it waits until the test releases it.
// bun's module mocks are process-wide, so keep every other export real (other test files use them).
let releaseDetection: (m: Map<string, boolean>) => void = () => {}
const actualDetect = { ...(await import("../src/lib/detect.js")) }
mock.module("../src/lib/detect.js", () => ({
  ...actualDetect,
  detectInstalled: () => new Promise<Map<string, boolean>>((r) => (releaseDetection = r)),
}))
const { pickTool } = await import("../src/lib/terminal.js")

describe("pickTool", () => {
  it("Esc while 'Detecting installed CLIs…' ends the command instead of hanging on a picker nobody sees", async () => {
    let hide: () => void = () => {}
    let disposed = 0
    vscode.window.createQuickPick.mockImplementation(
      () =>
        ({
          placeholder: "",
          busy: false,
          items: [],
          selectedItems: [],
          onDidAccept: () => {},
          onDidHide: (cb: () => void) => (hide = cb),
          show: () => {},
          hide: () => hide(),
          dispose: () => disposed++,
        }) as never,
    )
    const context = { asAbsolutePath: (p: string) => p } as never
    const result = pickTool(context)
    hide() // the user pressed Esc during detection
    releaseDetection(new Map())
    const outcome = await Promise.race([result, new Promise((r) => setTimeout(() => r("hung"), 500))])
    expect(outcome).toBeUndefined()
    expect(disposed).toBe(1)
  })
})
