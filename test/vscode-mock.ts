import { mock } from "bun:test"

/**
 * Minimal in-memory stand-in for the `vscode` module, which only exists at
 * runtime inside VS Code. Tests mutate `state` to drive behaviour, then read
 * back the spies to assert what the code under test did.
 */

export const state = {
  quickPickResult: undefined as { id: string } | undefined,
  activeTextEditor: undefined as unknown,
  workspaceFolder: undefined as unknown,
  relativePath: "",
}

export function resetVscodeMock() {
  state.quickPickResult = undefined
  state.activeTextEditor = undefined
  state.workspaceFolder = undefined
  state.relativePath = ""
}

const ViewColumn = { Beside: -2 }

const QuickPickItemKind = { Separator: 2, Default: 0 }

function createQuickPick<T extends { id?: string }>(): {
  placeholder: string
  busy: boolean
  items: T[]
  selectedItems: T[]
  onDidAccept: (cb: () => void) => void
  onDidHide: (cb: () => void) => void
  show: () => void
  hide: () => void
  dispose: () => void
} {
  return {
    placeholder: "",
    busy: false,
    items: [],
    selectedItems: [],
    onDidAccept: () => {},
    onDidHide: () => {},
    show: () => {},
    hide: () => {},
    dispose: () => {},
  }
}

class ThemeIcon {
  constructor(public id: string) {}
}

const vscode = {
  ViewColumn,
  QuickPickItemKind,
  ThemeIcon,
  Uri: {
    file: (p: string) => ({ fsPath: p, toString: () => p }),
  },
  window: {
    get activeTextEditor() {
      return state.activeTextEditor
    },
    showQuickPick: mock(async () => state.quickPickResult),
    createQuickPick: mock(() => createQuickPick()),
    showWarningMessage: mock(async () => undefined),
  },
  workspace: {
    getWorkspaceFolder: mock(() => state.workspaceFolder),
    asRelativePath: mock(() => state.relativePath),
  },
}

mock.module("vscode", () => vscode)

export { vscode }
