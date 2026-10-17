import type { IBuffer, Terminal } from "@xterm/xterm"

const ARROW = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3.5 8.5 8 13l4.5-4.5"/></svg>`
/** Space between the button and the bottom of the terminal rows, or the top of the draft preview. */
const GAP = 12

/** Scrolled back into the history (an alternate screen has none, so never there). */
export function showsScrollButton(buffer: Pick<IBuffer, "viewportY" | "baseY">): boolean {
  return buffer.viewportY < buffer.baseY
}

/** The button's CSS `bottom`: over the last terminal row, or above the draft preview where the
 * two would overlap (the preview spans the terminal's width). */
export function placeScrollButton(p: {
  viewportHeight: number
  screenBottom: number
  height: number
  draft?: { top: number; bottom: number }
}): number {
  const bottom = Math.max(GAP, p.viewportHeight - p.screenBottom + GAP)
  const top = p.viewportHeight - bottom - p.height
  if (p.draft && p.draft.top < p.viewportHeight - bottom && p.draft.bottom > top) return p.viewportHeight - p.draft.top + GAP / 2
  return bottom
}

/** A "scroll to bottom" button floating over the terminal while its history is scrolled back. */
export function createScrollButton(term: Terminal): void {
  const button = document.createElement("button")
  button.id = "scroll-bottom"
  button.type = "button"
  button.title = "Scroll to bottom"
  button.setAttribute("aria-label", "Scroll to bottom")
  button.innerHTML = ARROW
  button.hidden = true
  document.body.append(button)
  button.addEventListener("click", () => {
    term.scrollToBottom()
    term.focus()
  })

  let frame = 0
  // Next frame, after the draft preview has placed itself for the same scroll.
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(sync)
  }
  function sync() {
    frame = 0
    button.hidden = !showsScrollButton(term.buffer.active)
    if (button.hidden) return
    const screen = term.element?.querySelector(".xterm-screen")
    if (!screen) return
    const draft = document.getElementById("draft-preview")
    const draftRect = draft && !draft.hidden ? draft.getBoundingClientRect() : undefined
    button.style.bottom = `${placeScrollButton({
      viewportHeight: window.innerHeight,
      screenBottom: screen.getBoundingClientRect().bottom,
      height: button.offsetHeight,
      draft: draftRect,
    })}px`
  }
  term.onScroll(schedule)
  // A wheel or scrollbar scroll does not fire onScroll (xterm 5.5 suppresses it): the viewport's own scroll event does.
  term.element?.querySelector(".xterm-viewport")?.addEventListener("scroll", schedule)
  term.onResize(schedule)
  term.onWriteParsed(schedule)
  const draft = document.getElementById("draft-preview")
  if (draft) new ResizeObserver(schedule).observe(draft)
}
