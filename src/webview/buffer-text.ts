export type LineSource = {
  length: number
  getLine(i: number): { translateToString(trimRight: boolean): string } | undefined
}

/** Plain text of the last `maxLines` buffer rows, trailing blank rows dropped. */
export function tailText(buffer: LineSource, maxLines: number): { text: string; lines: number } {
  const start = Math.max(0, buffer.length - maxLines)
  const rows: string[] = []
  for (let i = start; i < buffer.length; i++) rows.push(buffer.getLine(i)?.translateToString(true) ?? "")
  while (rows.length > 0 && rows[rows.length - 1]!.trim() === "") rows.pop()
  return { text: rows.join("\n"), lines: rows.length }
}
