/**
 * Quiet bar above the terminal, in the spirit of Claude's own header: same background as
 * the terminal, no border, nothing on the left unless the agent needs the user, and a few
 * thin-outline icons flush right. Rare actions live behind "…".
 */
import type { UpdateNotice } from "../lib/cli-update.js"

type Action = { id: string; label: string; svg: string }

// 20×20 outline glyphs, stroke 1.25 — drawn to match Claude's header icons.
const NEW_SESSION =
  '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h7A2.5 2.5 0 0 1 16 5.5v5a2.5 2.5 0 0 1-2.5 2.5H8.8L5.5 16v-3A2.5 2.5 0 0 1 4 10.5z"/><path d="M10 6.2v4.6M7.7 8.5h4.6"/>'
const HISTORY = '<circle cx="10" cy="10" r="7"/><path d="M10 6.2V10l2.4 1.6"/>'
const RESTART = '<path d="M15.5 10a5.5 5.5 0 1 1-1.6-3.9"/><path d="M15.5 4.5v2.6h-2.6"/>'
const FIND = '<circle cx="9" cy="9" r="5"/><path d="m12.7 12.7 3.6 3.6"/>'
const MORE =
  '<circle cx="5" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="10" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1" fill="currentColor" stroke="none"/>'

export function createActionBar(handlers: {
  onCommand(id: string): void
  onFind(): void
  /** The tab's new name, from a double-click on its name (Orca's inline rename). */
  onRename(title: string): void
  /** Where focus goes when an inline rename ends. */
  onRenameEnd(): void
  onUpdate(): void
}): { setStatus(text: string): void; setModel(model: string): void; setNotice(text: string): void; setTitle(text: string): void; setUpdate(notice: UpdateNotice): void } {
  const bar = document.createElement("div")
  bar.id = "action-bar"
  const left = document.createElement("div")
  left.id = "action-left"
  const title = document.createElement("span")
  title.id = "action-title"
  title.title = "Double-click to rename"
  title.addEventListener("dblclick", () => startRename())
  const model = document.createElement("span")
  model.id = "action-model"
  model.hidden = true
  const status = document.createElement("div")
  status.id = "action-status"
  const notice = document.createElement("div")
  notice.id = "action-notice"
  notice.hidden = true
  left.append(title, model, status, notice)
  const update = document.createElement("div")
  update.id = "action-update"
  update.hidden = true
  const updateText = document.createElement("span")
  updateText.setAttribute("role", "status")
  const updateButton = document.createElement("button")
  updateButton.addEventListener("click", () => {
    if (updateButton.disabled) return
    // Lock immediately: a second click must not beat the host's Updating response.
    updateButton.disabled = true
    handlers.onUpdate()
  })
  update.append(updateText, updateButton)
  const right = document.createElement("div")
  right.id = "action-icons"
  bar.append(left, right, update)

  const icon = (a: Action, onClick: (e: MouseEvent) => void) => {
    const b = document.createElement("button")
    b.title = a.label
    b.setAttribute("aria-label", a.label)
    b.innerHTML = `<svg viewBox="0 0 20 20" aria-hidden="true">${a.svg}</svg>`
    b.addEventListener("click", onClick)
    right.append(b)
    return b
  }
  icon({ id: "openNew", label: "New session — pick a CLI", svg: NEW_SESSION }, () => handlers.onCommand("openNew"))
  icon({ id: "resume", label: "Resume a previous session", svg: HISTORY }, () => handlers.onCommand("resume"))
  icon({ id: "restart", label: "Restart session — back into this conversation", svg: RESTART }, () => handlers.onCommand("restart"))
  icon({ id: "find", label: "Find in terminal (⌘F)", svg: FIND }, () => handlers.onFind())

  const menu = document.createElement("div")
  menu.id = "action-menu"
  menu.hidden = true
  for (const item of [
    { id: "renameTab", label: "Rename tab", key: "F2" },
    { id: "copyContext", label: "Copy context", key: "" },
    { id: "quickCommand", label: "Quick command", key: "" },
  ]) {
    const entry = document.createElement("button")
    entry.innerHTML = `<span>${item.label}</span><span class="key">${item.key}</span>`
    entry.addEventListener("click", () => {
      hide()
      handlers.onCommand(item.id)
    })
    menu.append(entry)
  }
  const more = icon({ id: "more", label: "More", svg: MORE }, (e) => {
    e.stopPropagation()
    if (menu.hidden) show()
    else hide()
  })
  more.setAttribute("aria-haspopup", "menu")
  bar.append(menu)
  // The bar precedes the terminal in the flex column.
  document.body.prepend(bar)

  document.addEventListener("mousedown", (e) => {
    // `contains`, not `===`: the click lands on the button's SVG, and treating that as "outside"
    // closed the menu on mousedown only for the button's click handler to reopen it.
    if (!menu.hidden && !menu.contains(e.target as Node) && !more.contains(e.target as Node)) hide()
  })
  // Capture phase: xterm's own keydown handler would otherwise swallow Escape first.
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" && !menu.hidden) hide()
    },
    true,
  )
  // Double-click the name to edit it in place: Enter or leaving the field saves, Escape cancels.
  function startRename() {
    const input = document.createElement("input")
    input.id = "action-title-input"
    input.value = title.textContent ?? ""
    let done = false
    const finish = (save: boolean) => {
      if (done) return
      done = true
      if (save) handlers.onRename(input.value)
      input.replaceWith(title)
      handlers.onRenameEnd()
    }
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") finish(true)
      else if (e.key === "Escape") finish(false)
      else return
      e.preventDefault()
    })
    input.addEventListener("blur", () => finish(true))
    title.replaceWith(input)
    input.focus()
    input.select()
  }
  function show() {
    menu.hidden = false
    more.setAttribute("aria-expanded", "true")
  }
  function hide() {
    menu.hidden = true
    more.setAttribute("aria-expanded", "false")
  }

  return {
    setUpdate(state) {
      update.hidden = state.kind === "current"
      update.dataset.state = state.kind
      const version = state.version ? ` · v${state.version}` : ""
      updateText.textContent = state.kind === "installed" ? `✓ Update installed${version}`
        : state.kind === "updating" ? "Updating CLI…"
          : state.kind === "error" ? "Update failed" : `Update available${version}`
      update.title = state.error ?? updateText.textContent
      updateButton.textContent = state.kind === "installed" ? "Restart to update"
        : state.kind === "error" ? "Retry update"
          : state.canUpdate === false ? "Configure update" : "Update & Restart"
      updateButton.hidden = state.kind === "updating"
      updateButton.disabled = state.kind === "updating" || state.kind === "current"
    },
    setStatus(text) {
      status.textContent = text
      status.hidden = !text
    },
    setNotice(text) {
      notice.textContent = text
      notice.hidden = !text
    },
    setTitle(text) {
      title.textContent = text
    },
    setModel(id) {
      model.textContent = id
      model.title = id ? `Model in use: ${id}` : ""
      model.hidden = !id
    },
  }
}
