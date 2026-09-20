import type { Terminal } from "@xterm/xterm"
import { composerHint, composerKeyAction, prepareSubmission } from "../lib/composer.js"

/**
 * Chat-style input under the terminal: a box that grows to show everything typed or
 * pasted, a hint line and a send button. Text goes to the CLI exactly like a quick
 * command — one bracketed paste followed by Enter — so multi-line prompts arrive whole.
 */
export function createComposer(term: Terminal): void {
  const root = document.createElement("div")
  root.id = "composer"
  const box = document.createElement("div")
  box.id = "composer-box"
  const input = document.createElement("textarea")
  input.id = "composer-input"
  input.rows = 1
  input.placeholder = "Nhập cho CLI…"
  input.spellcheck = false
  const row = document.createElement("div")
  row.id = "composer-row"
  const hint = document.createElement("span")
  hint.id = "composer-hint"
  const send = document.createElement("button")
  send.id = "composer-send"
  send.title = "Gửi (Enter)"
  send.setAttribute("aria-label", "Gửi")
  send.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 15V5M5.5 9.5 10 5l4.5 4.5"/></svg>'
  row.append(hint, send)
  box.append(input, row)
  root.append(box)
  document.body.append(root)

  function refresh() {
    // No cap: the box shows everything; the terminal above yields the space.
    input.style.height = "auto"
    input.style.height = `${input.scrollHeight}px`
    input.classList.toggle("multiline", input.value.includes("\n"))
    hint.textContent = composerHint(input.value)
    send.disabled = prepareSubmission(input.value) === undefined
  }
  function submit() {
    const text = prepareSubmission(input.value)
    if (text === undefined) return
    term.paste(text)
    term.input("\r")
    input.value = ""
    refresh()
    input.focus()
  }

  input.addEventListener("input", refresh)
  input.addEventListener("keydown", (e) => {
    const action = composerKeyAction(e)
    if (action === "submit") {
      e.preventDefault()
      submit()
    } else if (action === "blur") {
      e.preventDefault()
      term.focus()
    }
    // "newline" is the textarea's default behaviour.
  })
  send.addEventListener("click", submit)
  refresh()
}
