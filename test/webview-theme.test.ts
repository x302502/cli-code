import { describe, expect, it } from "bun:test"
import { buildXtermTheme } from "../src/lib/webview-theme.js"

describe("buildXtermTheme", () => {
  it("maps VS Code CSS variables to xterm theme keys", () => {
    const theme = buildXtermTheme(
      (name) =>
        ({
          "--vscode-terminal-background": "#111111",
          "--vscode-terminal-foreground": "#eeeeee",
          "--vscode-terminal-ansiRed": "#ff0000",
        })[name] ?? "",
    )
    expect(theme.background).toBe("#111111")
    expect(theme.foreground).toBe("#eeeeee")
    expect(theme.red).toBe("#ff0000")
  })

  it("skips keys with no value instead of setting an empty string as a color", () => {
    const theme = buildXtermTheme(() => "")
    expect(Object.keys(theme).length).toBe(0)
  })
})
