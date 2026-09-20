// While a TUI tracks the mouse the webview turns every plain press into a terminal selection
// (so a drag selects and Cmd/Ctrl+C copies, as in Orca). A press that turns out to be a bare
// click is then replayed to the program, so Claude and friends still move their caret to it.

export type ReleasedPress = {
  /** Pointer travelled beyond the drag threshold between press and release. */
  moved: boolean
  button: number
  /** MouseEvent.detail: 1 single, 2 double, 3 triple. */
  detail: number
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
  ctrlKey: boolean
}

/**
 * Whether a press that just ended should reach the program as a click. Only an unmodified,
 * single, motionless left click: drags are selections, double/triple clicks are xterm's
 * word/line selection, Cmd/Ctrl opens links, Option/Shift are the native-gesture keys.
 */
export function clickReachesProgram(p: ReleasedPress): boolean {
  return !p.moved && p.button === 0 && p.detail === 1 && !p.altKey && !p.shiftKey && !p.metaKey && !p.ctrlKey
}
