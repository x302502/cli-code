/** Small bottom-right chip shown when the CLI process exits, offering a restart. */
export function createExitOverlay(onRestart: () => void): { show(code: number): void; hide(): void } {
  const el = document.createElement("div")
  el.id = "exit-overlay"
  el.hidden = true
  const text = document.createElement("span")
  const button = document.createElement("button")
  button.textContent = "Restart"
  button.addEventListener("click", onRestart)
  el.append(text, button)
  document.body.append(el)
  return {
    show(code) {
      text.textContent = `Process exited (code ${code})`
      el.hidden = false
    },
    hide() {
      el.hidden = true
    },
  }
}
