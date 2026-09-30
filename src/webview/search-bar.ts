import type { Terminal } from "@xterm/xterm"
import type { SearchAddon } from "@xterm/addon-search"

/** In-terminal search bar: highlights matches in the scrollback via SearchAddon's decorations. */
export function createSearchBar(term: Terminal, search: SearchAddon): { show(query?: string): void; hide(): void } {
  const bar = document.createElement("div")
  bar.id = "search-bar"
  bar.hidden = true
  const input = document.createElement("input")
  input.placeholder = "Find"
  const count = document.createElement("span")
  const caseBtn = toggle("Aa", "Match case")
  const regexBtn = toggle(".*", "Use regular expression")
  const prev = button("↑", () => find(false))
  const next = button("↓", () => find(true))
  const close = button("✕", hide)
  bar.append(input, count, caseBtn.el, regexBtn.el, prev, next, close)
  document.body.append(bar)

  search.onDidChangeResults((r) => {
    count.textContent = r.resultCount ? `${r.resultIndex + 1}/${r.resultCount}` : "0"
  })

  function options() {
    return {
      caseSensitive: caseBtn.on,
      regex: regexBtn.on,
      decorations: {
        matchBackground: "#7a5c0088",
        activeMatchBackground: "#ffcc0088",
        matchOverviewRuler: "#ffcc00",
        activeMatchColorOverviewRuler: "#ffcc00",
      },
    }
  }
  function find(forward: boolean) {
    if (!input.value) {
      search.clearDecorations()
      count.textContent = ""
      return
    }
    // An in-progress regex such as "(" throws inside the addon; ignore it until it is valid.
    try {
      if (forward) search.findNext(input.value, options())
      else search.findPrevious(input.value, options())
    } catch {
      // ignore
    }
  }
  input.addEventListener("input", () => find(true))
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") find(!e.shiftKey)
    // Escape is only handled here, on the input — a hidden bar must not intercept
    // Escape meant for the terminal itself.
    else if (e.key === "Escape") hide()
    else return
    e.preventDefault()
  })

  function show(query?: string) {
    bar.hidden = false
    if (query) {
      input.value = query
      input.dispatchEvent(new Event("input"))
    }
    input.focus()
    input.select()
  }
  function hide() {
    bar.hidden = true
    search.clearDecorations()
    term.focus()
  }
  return { show, hide }

  function toggle(label: string, title: string) {
    const el = document.createElement("button")
    el.textContent = label
    el.title = title
    const state = { el, on: false }
    el.addEventListener("click", () => {
      state.on = !state.on
      el.classList.toggle("on", state.on)
      find(true)
    })
    return state
  }
  function button(label: string, onClick: () => void) {
    const el = document.createElement("button")
    el.textContent = label
    el.addEventListener("click", onClick)
    return el
  }
}
