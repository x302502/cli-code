import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import * as vscode from "vscode"
import { findToolForTerminal } from "./terminal.js"

/**
 * Strips slash commands, pasted-text annotations, and limits length
 * to produce a clean, human-readable terminal tab title from a prompt.
 */
export function formatPromptTitle(prompt: string): string {
  if (!prompt) return ""

  // Strip leading slash commands like /goal, /plan, /clear
  let text = prompt.replace(/^\/[a-zA-Z0-9_-]+\s*/, "").trim()
  // Strip pasted-text annotations like [Pasted text #3 +14 lines]
  text = text.replace(/\[Pasted text[^\]]*\]/g, "").trim()
  // Take first non-empty line
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  const firstLine = lines[0] ?? ""
  if (!firstLine || firstLine.length < 2) return ""

  const MAX_LEN = 20
  if (firstLine.length <= MAX_LEN) return firstLine

  // Cut at a word boundary so tabs don't end mid-word, unless that would throw
  // away most of the title (e.g. a long path with no spaces to break on).
  const cut = firstLine.slice(0, MAX_LEN)
  const lastSpace = cut.lastIndexOf(" ")
  const kept = lastSpace >= Math.floor(MAX_LEN * 0.55) ? cut.slice(0, lastSpace) : cut
  return kept.trimEnd() + "…"
}

/**
 * Watches CLI session history (e.g. ~/.claude/history.jsonl) and dynamically updates
 * the active terminal tab's label to match the latest user prompt.
 */
export function startTitleSync(context: vscode.ExtensionContext) {
  const claudeHistoryPath = path.join(os.homedir(), ".claude", "history.jsonl")

  if (!fs.existsSync(claudeHistoryPath)) {
    return
  }

  let lastProcessedTimestamp = Date.now() - 3000 // only track fresh prompts

  const syncClaudeTitle = () => {
    try {
      if (!fs.existsSync(claudeHistoryPath)) return
      const stat = fs.statSync(claudeHistoryPath)
      const bufferSize = Math.min(stat.size, 8192)
      if (bufferSize <= 0) return

      const fd = fs.openSync(claudeHistoryPath, "r")
      const buffer = Buffer.alloc(bufferSize)
      fs.readSync(fd, buffer, 0, bufferSize, stat.size - bufferSize)
      fs.closeSync(fd)

      const lines = buffer.toString("utf8").trim().split("\n")
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i]?.trim()
        if (!line) continue
        try {
          const entry = JSON.parse(line) as {
            display?: string
            timestamp?: number
            project?: string
          }
          if (!entry.timestamp || entry.timestamp <= lastProcessedTimestamp) {
            continue
          }
          if (!entry.display) continue

          const cleanText = formatPromptTitle(entry.display)
          if (!cleanText) continue

          lastProcessedTimestamp = entry.timestamp

          const newTitle = `Claude • ${cleanText}`

          const activeTerminal = vscode.window.activeTerminal
          if (activeTerminal) {
            const tool = findToolForTerminal(activeTerminal)
            if (!tool || tool.id === "claude" || tool.id === "claude-agent-teams") {
              void vscode.commands.executeCommand("workbench.action.terminal.renameWithArg", {
                name: newTitle,
              })
            }
          }
          break
        } catch {
          // Ignore JSON parse errors on partial buffer cuts
        }
      }
    } catch {
      // Ignore file access errors
    }
  }

  try {
    const watcher = fs.watch(claudeHistoryPath, () => {
      setTimeout(syncClaudeTitle, 150)
    })
    context.subscriptions.push({ dispose: () => watcher.close() })
  } catch {
    const interval = setInterval(syncClaudeTitle, 1000)
    context.subscriptions.push({ dispose: () => clearInterval(interval) })
  }
}
