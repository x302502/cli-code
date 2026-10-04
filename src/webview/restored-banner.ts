/** Top chip saying a reopened tab's CLI was started again (Orca's "session restored" line); the
 * first key or click in the page dismisses it. */
export function createRestoredBanner(): { show(resumed: boolean): void } {
  const el = document.createElement("div")
  el.id = "restored-banner"
  el.hidden = true
  document.body.append(el)
  const hide = () => (el.hidden = true)
  window.addEventListener("keydown", hide, true)
  window.addEventListener("pointerdown", hide, true)
  return {
    show(resumed) {
      el.textContent = resumed ? "Session restored" : "Previous session unavailable, started fresh"
      el.hidden = false
    },
  }
}
