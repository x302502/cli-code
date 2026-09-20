/**
 * Floating "⋯" button in the bottom-right corner with a popup of tab-level actions
 * (new session, rename, restart, …). The right-click menu is left to VS Code for
 * content-aware actions on the text under the pointer.
 */
export function createActionMenu(items: { id: string; label: string }[], onPick: (id: string) => void): void {
  const button = document.createElement("button")
  button.id = "action-button"
  button.title = "Thao tác với tab"
  button.textContent = "⋯"

  const menu = document.createElement("div")
  menu.id = "action-menu"
  menu.hidden = true
  for (const item of items) {
    const entry = document.createElement("button")
    entry.textContent = item.label
    entry.addEventListener("click", () => {
      hide()
      onPick(item.id)
    })
    menu.append(entry)
  }
  document.body.append(menu, button)

  button.addEventListener("click", (e) => {
    e.stopPropagation()
    if (menu.hidden) show()
    else hide()
  })
  document.addEventListener("mousedown", (e) => {
    if (!menu.hidden && !menu.contains(e.target as Node) && e.target !== button) hide()
  })
  // Capture phase: xterm's own keydown handler would otherwise swallow Escape first.
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" && !menu.hidden) hide()
    },
    true,
  )

  function show() {
    menu.hidden = false
  }
  function hide() {
    menu.hidden = true
  }
}
