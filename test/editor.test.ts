import { beforeEach, describe, expect, it } from "bun:test"
import { resetVscodeMock, state } from "./vscode-mock.js"
import { getActiveFileReference } from "../src/lib/editor.js"

/** Builds a fake active editor with an optional selection range (0-based lines). */
function setEditor(opts: {
  relativePath: string
  inWorkspace?: boolean
  selection?: { startLine: number; endLine: number } | null
}) {
  const selection = opts.selection
  state.relativePath = opts.relativePath
  state.workspaceFolder = opts.inWorkspace === false ? undefined : { name: "ws" }
  state.activeTextEditor = {
    document: { uri: { fsPath: opts.relativePath } },
    selection: {
      isEmpty: !selection,
      start: { line: selection?.startLine ?? 0 },
      end: { line: selection?.endLine ?? 0 },
    },
  }
}

describe("getActiveFileReference", () => {
  beforeEach(() => resetVscodeMock())

  it("returns undefined when there is no active editor", () => {
    expect(getActiveFileReference()).toBeUndefined()
  })

  it("returns undefined when the file is outside the workspace", () => {
    setEditor({ relativePath: "foo.ts", inWorkspace: false })
    expect(getActiveFileReference()).toBeUndefined()
  })

  it("returns a bare at-mention when nothing is selected", () => {
    setEditor({ relativePath: "src/foo.ts", selection: null })
    expect(getActiveFileReference()).toBe("@src/foo.ts")
  })

  it("appends a single 1-based line for a single-line selection", () => {
    setEditor({ relativePath: "src/foo.ts", selection: { startLine: 9, endLine: 9 } })
    expect(getActiveFileReference()).toBe("@src/foo.ts#L10")
  })

  it("appends a 1-based range for a multi-line selection", () => {
    setEditor({ relativePath: "src/foo.ts", selection: { startLine: 9, endLine: 19 } })
    expect(getActiveFileReference()).toBe("@src/foo.ts#L10-20")
  })
})
