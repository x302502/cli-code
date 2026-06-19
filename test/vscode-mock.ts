import { mock } from "bun:test"

/**
 * Minimal in-memory stand-in for the `vscode` module, which only exists at
 * runtime inside VS Code. Tests mutate `state` to drive behaviour, then read
 * back the spies (e.g. `createdTerminals`) to assert what the code under test did.
 */

export type FakeTerminal = {
  name: string
  creationOptions: Record<string, unknown>
  show: ReturnType<typeof mock>
  sendText: ReturnType<typeof mock>
}

export type FakeTabGroup = {
  viewColumn: number
  tabs: { label: string; input: unknown }[]
}

export const state = {
  quickPickResult: undefined as { id: string } | undefined,
  terminals: [] as FakeTerminal[],
  activeTerminal: undefined as FakeTerminal | undefined,
  activeTextEditor: undefined as unknown,
  workspaceFolder: undefined as unknown,
  relativePath: "",
  createdTerminals: [] as Record<string, unknown>[],
  tabGroups: [] as FakeTabGroup[],
}

export function resetVscodeMock() {
  state.quickPickResult = undefined
  state.terminals = []
  state.activeTerminal = undefined
  state.activeTextEditor = undefined
  state.workspaceFolder = undefined
  state.relativePath = ""
  state.createdTerminals = []
  state.tabGroups = []
}

/** A class so production code can use `input instanceof vscode.TabInputTerminal`. */
class TabInputTerminal {}

/** Builds a fake terminal tab whose `input` passes the `TabInputTerminal` check. */
export function makeTerminalTab(label: string): { label: string; input: unknown } {
  return { label, input: new TabInputTerminal() }
}

export function makeTerminal(name: string, env?: Record<string, string>): FakeTerminal {
  return {
    name,
    creationOptions: env ? { env } : {},
    show: mock(() => {}),
    sendText: mock(() => {}),
  }
}

const ViewColumn = { Beside: -2 }

const vscode = {
  ViewColumn,
  TabInputTerminal,
  Uri: {
    file: (p: string) => ({ fsPath: p, toString: () => p }),
  },
  window: {
    get terminals() {
      return state.terminals
    },
    get activeTerminal() {
      return state.activeTerminal
    },
    get activeTextEditor() {
      return state.activeTextEditor
    },
    get tabGroups() {
      return { all: state.tabGroups }
    },
    showQuickPick: mock(async () => state.quickPickResult),
    createTerminal: mock((options: Record<string, unknown>) => {
      state.createdTerminals.push(options)
      return makeTerminal(options.name as string, options.env as Record<string, string>)
    }),
  },
  workspace: {
    getWorkspaceFolder: mock(() => state.workspaceFolder),
    asRelativePath: mock(() => state.relativePath),
  },
}

mock.module("vscode", () => vscode)

export { vscode }
