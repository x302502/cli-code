import type { UsageSnapshot } from "../lib/usage/types.js"
import { chipView, popoverView } from "../lib/usage/view.js"

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)

/** The plan-usage chip of the action bar and its click-open popover (see the spec's UI section). */
export function createUsageChip(onRefresh: () => void): { element: HTMLElement; set(snapshot: UsageSnapshot | null): void } {
  const wrap = document.createElement("span")
  wrap.id = "action-usage"
  wrap.hidden = true
  const chip = document.createElement("button")
  chip.type = "button"
  chip.className = "usage-chip"
  chip.setAttribute("aria-haspopup", "dialog")
  chip.setAttribute("aria-expanded", "false")
  const pop = document.createElement("div")
  pop.className = "usage-pop"
  pop.setAttribute("role", "dialog")
  pop.hidden = true
  wrap.append(chip, pop)
  let snapshot: UsageSnapshot | null = null

  const renderChip = () => {
    const v = snapshot && chipView(snapshot, Date.now())
    wrap.hidden = !v
    if (!v) return close()
    chip.dataset.level = v.level
    chip.toggleAttribute("data-stale", v.stale)
    chip.title = v.tooltip
    const used = Number.parseInt(v.pct, 10) / 100
    chip.innerHTML = `<span class="usage-pie" style="--p:${used}"></span>${v.pct}${v.countdown ? `<span class="usage-reset">· ${v.countdown}</span>` : ""}${v.alarm ? `<span class="usage-alarm" aria-label="${esc(v.alarm)}"></span>` : ""}`
  }
  const renderPop = () => {
    if (!snapshot) return
    const v = popoverView(snapshot, Date.now())
    pop.innerHTML = v.groups.map((g) => `
      <div class="usage-group">
        <div class="usage-group-h">${esc(g.provider)}${g.active ? '<span class="usage-inuse">in use</span>' : ""}${g.meta ? `<span class="usage-meta">${esc(g.meta)}</span>` : ""}</div>
        ${g.accounts.map((a) => `
          ${g.accounts.length > 1 && a.id ? `<div class="usage-acct">${esc(a.id)}</div>` : ""}
          ${a.rows.map((r) => `
            <div class="usage-row" data-level="${r.level}">
              <span class="usage-lbl">${esc(r.label)}${r.detail ? ` <span class="usage-detail">· ${esc(r.detail)}</span>` : ""}</span>
              <span class="usage-meter"><i style="--p:${r.used}"></i></span>
              <span class="usage-pct">${r.pct}</span>
              <span class="usage-when">${esc(r.reset)}</span>
            </div>`).join("")}`).join("")}
      </div>`).join("") + `
      <div class="usage-foot"><span>updated ${v.updated}${v.stale ? " (stale)" : ""}</span>${v.refreshable ? '<button type="button" class="usage-refresh">↻ Refresh</button>' : ""}</div>`
    pop.querySelector(".usage-refresh")?.addEventListener("click", () => onRefresh())
  }
  const close = () => {
    pop.hidden = true
    chip.setAttribute("aria-expanded", "false")
  }
  chip.addEventListener("click", (e) => {
    e.stopPropagation()
    if (!pop.hidden) return close()
    renderPop()
    pop.hidden = false
    // Keep the popover inside the webview when the chip sits far right.
    pop.style.left = ""
    const over = pop.getBoundingClientRect().right - (document.documentElement.clientWidth - 8)
    if (over > 0) pop.style.left = `${-8 - Math.min(over, wrap.getBoundingClientRect().left - 8 + 8)}px`
    chip.setAttribute("aria-expanded", "true")
  })
  pop.addEventListener("click", (e) => e.stopPropagation())
  document.addEventListener("click", close)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !pop.hidden) close()
  })
  // The countdown moves without new data.
  setInterval(() => {
    renderChip()
    if (!pop.hidden) renderPop()
  }, 60_000)

  return {
    element: wrap,
    set(next) {
      snapshot = next
      renderChip()
      if (!pop.hidden) renderPop()
    },
  }
}
