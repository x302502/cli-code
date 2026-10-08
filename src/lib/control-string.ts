/** After ESC: OSC `]`, DCS `P`, SOS `X`, PM `^`, APC `_`. The terminal answers queries (colours,
 * capabilities) with these; they are never something the user typed. */
export const isControlStringIntroducer = (ch: string | undefined): boolean => ch !== undefined && "]PX^_".includes(ch)

/** Index just past the BEL or ESC \ that ends the control string starting at `start` (its ESC),
 * or -1 when the chunk ends before that. */
export function controlStringEnd(input: string, start: number): number {
  for (let j = start + 2; j < input.length; j++) {
    if (input[j] === "\x07") return j + 1
    if (input[j] === "\x1b" && j + 1 < input.length && input[j + 1] === "\\") return j + 2
  }
  return -1
}

/** A CSI the terminal sends back on its own — cursor position, device attributes, mode and status
 * reports, window size, keyboard flags — rather than a key the user pressed. */
export function isCsiReply(params: string, final: string): boolean {
  switch (final) {
    case "R":
      return /^\d+;\d+$/.test(params)
    case "c":
      return /^[?>]/.test(params)
    case "y":
      return params.endsWith("$")
    case "t":
      return /^\d+;/.test(params)
    case "u":
      return params.startsWith("?")
    case "n":
      return /^\??\d+$/.test(params)
    default:
      return false
  }
}
