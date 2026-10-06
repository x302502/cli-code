import type { Terminal } from "@xterm/xterm"
import { createDraftMirror, decodeImage, keptImages, placeDraftPreview, showsDraft, type DraftSnapshot, type DraftView } from "../lib/draft-mirror.js"

const CHEVRON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4l4 4-4 4"/></svg>'
const CLOSE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>'

// Image bytes kept in the webview state across a reload; past this, an image shows as unavailable.
const KEPT_IMAGE_BYTES = 5 * 1024 * 1024

/** What the preview keeps in the webview state, so a reload shows the same draft again. */
export type SavedDraft = { draft?: DraftSnapshot; expanded?: boolean; images?: Record<number, string> }

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

/**
 * Read-only view of the CLI's input with every paste spelled out, floating right above it.
 * Shown while the draft holds a paste or an image (the CLI itself may show only "[Pasted text #1
 * +8 lines]"), or runs long (see showsDraft).
 */
export function createDraftPreview(
  term: Terminal,
  opts: {
    collapsesPastes: boolean
    saved?: SavedDraft
    onSave(saved: SavedDraft): void
    onCopy(text: string): void
    onOpenImage(bytes: Uint8Array): void
    onImageKey(id: number): void
  },
): { feed(data: string): void; reset(): void; setImage(id: number, bytes: Uint8Array | undefined): void } {
  const mirror = createDraftMirror({ collapsesPastes: opts.collapsesPastes, restore: opts.saved?.draft })

  const root = document.createElement("div")
  root.id = "draft-preview"
  root.hidden = true
  const header = document.createElement("div")
  header.id = "draft-header"
  const toggle = document.createElement("button")
  toggle.id = "draft-toggle"
  const summary = document.createElement("span")
  toggle.innerHTML = CHEVRON
  toggle.append("Full prompt", summary)
  const copy = document.createElement("button")
  copy.id = "draft-copy"
  copy.textContent = "Copy all"
  const close = document.createElement("button")
  close.id = "draft-close"
  close.title = "Hide until the next paste or the next prompt"
  close.setAttribute("aria-label", "Hide")
  close.innerHTML = CLOSE
  const actions = document.createElement("div")
  actions.append(copy, close)
  header.append(toggle, actions)
  const note = document.createElement("div")
  note.id = "draft-note"
  note.textContent = "May not match the input: a key was used that this preview cannot follow (history, Tab, …)."
  const body = document.createElement("div")
  body.id = "draft-body"
  root.append(header, note, body)
  document.body.append(root)

  let expanded = opts.saved?.expanded ?? true
  // ✕ hides the preview until the draft is cleared or gains (or loses) a paste or an image.
  let dismissedAt: number | undefined
  let frame = 0
  // The draft changed (not just where the caret row is): rebuild and save, not only re-place.
  let dirty = true
  let current: DraftView = mirror.view()
  // Ctrl+V image id → the clipboard image the CLI took, and its object URL.
  const images = new Map<number, { bytes: Uint8Array; url: string }>()
  // Images whose clipboard read is still on its way.
  const pending = new Set<number>()
  const addImage = (id: number, bytes: Uint8Array) =>
    images.set(id, { bytes, url: URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "image/png" })) })
  for (const [id, base64] of Object.entries(opts.saved?.images ?? {})) {
    try {
      addImage(Number(id), decodeImage(base64))
    } catch {
      // A damaged entry: the image shows as unavailable.
    }
  }
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  // Debounced: the images are re-encoded on every save.
  const save = () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      const bytes = new Map([...images].map(([id, image]) => [id, image.bytes]))
      opts.onSave({ draft: mirror.snapshot(), expanded, images: keptImages(bytes, KEPT_IMAGE_BYTES) })
    }, 300)
  }

  toggle.addEventListener("click", () => {
    expanded = !expanded
    schedule(true)
  })
  close.addEventListener("click", () => {
    dismissedAt = current.pastes + current.images
    schedule(true)
    term.focus()
  })
  copy.addEventListener("click", () => {
    opts.onCopy(current.segments.map((s) => (s.kind === "image" ? `[Image #${s.n}]` : s.text)).join(""))
    copy.textContent = "Copied"
    setTimeout(() => (copy.textContent = "Copy all"), 1200)
  })
  // Clicks on the preview must not leave the terminal without focus.
  root.addEventListener("mousedown", (e) => {
    if (!(e.target as HTMLElement).closest("button")) e.preventDefault()
  })

  function render() {
    frame = 0
    if (!dirty) {
      if (!root.hidden) place()
      return
    }
    dirty = false
    current = mirror.view()
    const attachments = current.pastes + current.images
    if (dismissedAt !== undefined && (attachments !== dismissedAt || current.segments.length === 0)) dismissedAt = undefined
    // Images erased from the draft (or sent) are not shown again.
    const live = new Set(current.segments.map((s) => (s.kind === "image" ? s.id : -1)))
    images.forEach((image, id) => {
      if (live.has(id)) return
      URL.revokeObjectURL(image.url)
      images.delete(id)
    })
    save()
    root.hidden = !showsDraft(current) || dismissedAt !== undefined
    if (root.hidden) return
    const lines = current.segments.reduce((n, s) => n + (s.kind === "image" ? 0 : s.text.split("\n").length - 1), 1)
    const parts = [plural(lines, "line")]
    if (current.pastes) parts.push(plural(current.pastes, "paste"))
    if (current.images) parts.push(plural(current.images, "image"))
    summary.textContent = ` · ${parts.join(" · ")}`
    toggle.setAttribute("aria-expanded", String(expanded))
    note.hidden = !current.uncertain || !expanded
    body.hidden = !expanded
    if (expanded) fill()
    place()
  }

  function fill() {
    body.replaceChildren()
    let caretEl: HTMLElement | undefined
    current.segments.forEach((s, index) => {
      const at = current.caret.segment === index ? current.caret.offset : -1
      if (s.kind === "image") {
        const block = document.createElement("div")
        block.className = "draft-paste"
        const label = document.createElement("div")
        label.className = "draft-paste-label"
        label.textContent = `Image #${s.n}`
        block.append(label)
        const image = images.get(s.id)
        if (image) {
          const img = document.createElement("img")
          img.className = "draft-image"
          img.src = image.url
          img.alt = `Image #${s.n}`
          img.title = "Open in an editor tab"
          img.addEventListener("click", () => opts.onOpenImage(image.bytes))
          block.append(img)
        } else {
          const waiting = document.createElement("div")
          waiting.className = "draft-text"
          waiting.textContent = pending.has(s.id) ? "Reading the clipboard…" : "Not available after reload"
          block.append(waiting)
        }
        body.append(block)
        // The caret right after an image: typing goes after it.
        if (at >= 0) {
          caretEl = document.createElement("span")
          caretEl.className = "draft-caret"
          body.append(caretEl)
        }
        return
      }
      const text = document.createElement("div")
      text.className = "draft-text"
      if (at >= 0) {
        caretEl = document.createElement("span")
        caretEl.className = "draft-caret"
        text.append(s.text.slice(0, at), caretEl, s.text.slice(at))
      } else text.textContent = s.text
      if (s.kind === "paste") {
        const block = document.createElement("div")
        block.className = "draft-paste"
        const label = document.createElement("div")
        label.className = "draft-paste-label"
        label.textContent = `Paste #${s.n} · ${plural(s.text.split("\n").length, "line")}`
        block.append(label, text)
        body.append(block)
      } else {
        text.classList.add("draft-typed")
        body.append(text)
      }
    })
    // An empty draft past its last paste still shows where typing goes.
    if (!caretEl) {
      caretEl = document.createElement("span")
      caretEl.className = "draft-caret"
      body.append(caretEl)
    }
    caretEl.scrollIntoView({ block: "nearest" })
  }

  function place() {
    const screen = term.element?.querySelector(".xterm-screen")
    if (!screen) return
    const rect = screen.getBoundingClientRect()
    const buffer = term.buffer.active
    // Viewport row of the caret; scrolled back it is off screen, which docks the preview like row 0.
    const row = buffer.baseY + buffer.cursorY - buffer.viewportY
    const { bottom, maxHeight } = placeDraftPreview({
      viewportHeight: window.innerHeight,
      screenTop: rect.top,
      cellHeight: rect.height / term.rows,
      rows: term.rows,
      cursorRow: row >= 0 && row < term.rows ? row : 0,
      topReserve: document.getElementById("action-bar")?.getBoundingClientRect().bottom ?? 0,
    })
    root.style.bottom = `${bottom}px`
    body.style.maxHeight = `${Math.max(60, maxHeight - header.offsetHeight - note.offsetHeight)}px`
  }

  /** Next frame: rebuild the preview if the draft changed, else only follow the caret row. */
  function schedule(changed = false) {
    dirty ||= changed
    if (!frame) frame = requestAnimationFrame(render)
  }
  term.onCursorMove(() => {
    if (!root.hidden) schedule()
  })
  term.onResize(() => schedule())
  term.onScroll(() => schedule())

  // A draft kept from before a reload shows at once.
  schedule()

  return {
    feed(data) {
      for (const id of mirror.feed(data)) {
        pending.add(id)
        opts.onImageKey(id)
      }
      schedule(true)
    },
    reset() {
      mirror.reset()
      schedule(true)
    },
    setImage(id, bytes) {
      pending.delete(id)
      if (bytes?.length) addImage(id, bytes)
      // No image on the clipboard: Ctrl+V added nothing to the CLI's input either.
      else mirror.dropImage(id)
      schedule(true)
    },
  }
}
