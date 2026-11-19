/**
 * xterm's WebGL addon (0.18) builds a regular glyph's canvas font as `${italic} ${weight} ...`,
 * leaving a leading space when the glyph is not italic. The Chromium in VS Code 1.147
 * (Electron 43) rejects a font string that starts with whitespace and keeps `10px sans-serif`,
 * so every regular glyph came out tiny in a full-size cell. Trim before the setter sees it.
 */
export function trimCanvasFont(proto: object | undefined): void {
  if (!proto) return
  const desc = Object.getOwnPropertyDescriptor(proto, "font")
  if (!desc?.set || !desc.get) return
  const set = desc.set
  Object.defineProperty(proto, "font", {
    ...desc,
    set(this: unknown, value: string) {
      set.call(this, typeof value === "string" ? value.trim() : value)
    },
  })
}
