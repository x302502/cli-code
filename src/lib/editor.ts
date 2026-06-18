import * as vscode from "vscode"

/**
 * Builds an at-mention reference for the active editor's file, e.g. `@src/foo.ts`
 * or `@src/foo.ts#L10-L20` when text is selected. Returns undefined when there is
 * no active editor or the file is outside the workspace.
 */
export function getActiveFileReference(): string | undefined {
  const editor = vscode.window.activeTextEditor
  if (!editor) return

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri)
  if (!workspaceFolder) return

  const relativePath = vscode.workspace.asRelativePath(editor.document.uri)
  let fileRef = `@${relativePath}`

  const selection = editor.selection
  if (!selection.isEmpty) {
    // Convert to 1-based line numbers.
    const startLine = selection.start.line + 1
    const endLine = selection.end.line + 1
    fileRef += startLine === endLine ? `#L${startLine}` : `#L${startLine}-${endLine}`
  }

  return fileRef
}
