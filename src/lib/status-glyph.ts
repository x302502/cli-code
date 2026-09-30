import type { AgentState } from "./protocol.js"

/** Tab-title prefix: VS Code webview tabs have no badge API, so the state rides on the title. */
export function decorateTitle(title: string, status: AgentState | undefined, unread: boolean): string {
  if (status === "working") return `⟳ ${title}`
  if (status === "waiting" || status === "blocked") return `? ${title}`
  if (unread) return `● ${title}`
  return title
}
