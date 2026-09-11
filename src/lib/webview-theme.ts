const MAP: Record<string, string> = {
  background: "--vscode-terminal-background",
  foreground: "--vscode-terminal-foreground",
  cursor: "--vscode-terminalCursor-foreground",
  selectionBackground: "--vscode-terminal-selectionBackground",
  black: "--vscode-terminal-ansiBlack",
  red: "--vscode-terminal-ansiRed",
  green: "--vscode-terminal-ansiGreen",
  yellow: "--vscode-terminal-ansiYellow",
  blue: "--vscode-terminal-ansiBlue",
  magenta: "--vscode-terminal-ansiMagenta",
  cyan: "--vscode-terminal-ansiCyan",
  white: "--vscode-terminal-ansiWhite",
  brightBlack: "--vscode-terminal-ansiBrightBlack",
  brightRed: "--vscode-terminal-ansiBrightRed",
  brightGreen: "--vscode-terminal-ansiBrightGreen",
  brightYellow: "--vscode-terminal-ansiBrightYellow",
  brightBlue: "--vscode-terminal-ansiBrightBlue",
  brightMagenta: "--vscode-terminal-ansiBrightMagenta",
  brightCyan: "--vscode-terminal-ansiBrightCyan",
  brightWhite: "--vscode-terminal-ansiBrightWhite",
}

/** Drops keys with no readable value: xterm treats an empty string as a broken color and renders incorrectly. */
export function buildXtermTheme(read: (name: string) => string): Record<string, string> {
  const theme: Record<string, string> = {}
  for (const [key, variable] of Object.entries(MAP)) {
    const value = read(variable).trim()
    if (value) theme[key] = value
  }
  return theme
}
