/** Popover offering "Mở"/"Sao chép" for a link, shown on a plain click on a WebLinksAddon match. */
export function createLinkPopover(): {
  show(x: number, y: number, target: string, actions: { open(): void; copy(): void }): void
  hide(): void
} {
  const el = document.createElement("div")
  el.id = "link-popover"
  el.hidden = true
  const label = document.createElement("span")
  const open = document.createElement("button")
  open.textContent = "Mở"
  const copy = document.createElement("button")
  copy.textContent = "Sao chép"
  el.append(label, open, copy)
  document.body.append(el)

  let current: { open(): void; copy(): void } | undefined
  open.addEventListener("click", () => {
    current?.open()
    hide()
  })
  copy.addEventListener("click", () => {
    current?.copy()
    hide()
  })
  // A click anywhere outside the popover dismisses it.
  document.addEventListener("mousedown", (e) => {
    if (!el.contains(e.target as Node)) hide()
  })
  // Capture phase: xterm's own keydown handler would otherwise swallow Escape first.
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" && !el.hidden) hide()
    },
    true,
  )

  function show(x: number, y: number, target: string, actions: { open(): void; copy(): void }) {
    current = actions
    label.textContent = target.length > 60 ? target.slice(0, 57) + "…" : target
    label.title = target
    el.hidden = false
    // Keep the popover inside the viewport; place it just below the pointer.
    const w = el.offsetWidth
    const h = el.offsetHeight
    el.style.left = `${Math.min(x, window.innerWidth - w - 4)}px`
    el.style.top = `${Math.min(y + 8, window.innerHeight - h - 4)}px`
  }
  function hide() {
    el.hidden = true
    current = undefined
  }
  return { show, hide }
}
