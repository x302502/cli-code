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
const { CLI_TOOLS } = await import("../src/lib/config.js")
const { extractBinary } = actualDetect

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

  describe("default CLI star", () => {
    type Item = { id?: string; label: string }
    async function open(installed: string[], configured: string, update: () => Promise<void>) {
      let click: (e: { item: Item }) => Promise<void> = async () => {}
      const qp = {
        placeholder: "",
        busy: false,
        items: [] as Item[],
        selectedItems: [],
        onDidAccept: () => {},
        onDidHide: () => {},
        onDidTriggerItemButton: (cb: typeof click) => (click = cb),
        show: () => {},
        hide: () => {},
        dispose: () => {},
      }
      vscode.window.createQuickPick.mockImplementation(() => qp as never)
      vscode.workspace.getConfiguration.mockImplementation(() => ({ get: () => configured, update }) as never)
      void pickTool({ asAbsolutePath: (p: string) => p } as never)
      releaseDetection(new Map(CLI_TOOLS.map((t) => [extractBinary(t.command), installed.includes(t.id)])))
      await new Promise((r) => setTimeout(r, 0))
      return { qp, click }
    }
    it("does not move a default that is not installed to the top", async () => {
      const last = CLI_TOOLS[CLI_TOOLS.length - 1]!
      const { qp } = await open([CLI_TOOLS[0]!.id, CLI_TOOLS[1]!.id], last.id, async () => {})
      const rest = qp.items.slice(qp.items.findIndex((i) => i.label === "Not installed") + 1)
      expect(rest[0]!.id).not.toBe(last.id)
    })
    it("shows an error and redraws when the setting cannot be saved", async () => {
      const { qp, click } = await open([CLI_TOOLS[0]!.id], "", async () => {
        throw new Error("read-only settings")
      })
      const before = qp.items
      await click({ item: { id: CLI_TOOLS[0]!.id, label: "x" } })
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining("read-only settings"))
      expect(qp.items).not.toBe(before)
    })
  })
})
