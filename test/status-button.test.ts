import { describe, expect, it, mock } from "bun:test"
import { vscode } from "./vscode-mock.js"
import { addStatusBarButton } from "../src/lib/status-button.js"

describe("addStatusBarButton", () => {
  it("shows a right-aligned CLI Code item that runs cli-code.open and is disposed with the extension", () => {
    const item = { text: "", tooltip: "", command: "", show: mock(() => {}), dispose: mock(() => {}) }
    const create = mock(() => item)
    ;(vscode.window as Record<string, unknown>).createStatusBarItem = create
    const subscriptions: { dispose(): unknown }[] = []

    addStatusBarButton({ subscriptions } as never)

    expect(create).toHaveBeenCalledWith(2, expect.any(Number))
    expect(item.text).toBe("$(cli-code-logo) CLI Code")
    expect(item.tooltip).toBe("Open CLI Code")
    expect(item.command).toBe("cli-code.open")
    expect(item.show).toHaveBeenCalled()
    expect(subscriptions).toContain(item)
  })
})
