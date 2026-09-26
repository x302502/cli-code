/** Small hover hint under the pointer: what a link opens and the modifier to use. */
export function createLinkTooltip(): { show(x: number, y: number, label: string, detail?: string): void; hide(): void } {
  const el = document.createElement("div")
  el.id = "link-tooltip"
  el.hidden = true
  const title = document.createElement("b")
  const path = document.createElement("span")
  el.append(title, path)
  document.body.append(el)
  return {
    show(x, y, label, detail) {
      title.textContent = label
      path.textContent = detail ?? ""
      path.hidden = !detail
      el.hidden = false
      const w = el.offsetWidth
      const h = el.offsetHeight
      el.style.left = `${Math.max(4, Math.min(x + 12, window.innerWidth - w - 4))}px`
      // Above the pointer when there is no room below.
      el.style.top = `${y + 18 + h > window.innerHeight ? y - h - 8 : y + 18}px`
    },
    hide() {
      el.hidden = true
    },
  }
}
