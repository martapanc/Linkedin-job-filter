// contents/linkedin.ts — injected into linkedin.com/jobs/*
// Watches for job detail panel changes and injects the analysis overlay.

import type { PlasmoCSConfig } from "plasmo"
import cssText from "data-text:~assets/content.css"

export const config: PlasmoCSConfig = {
  matches: ["https://www.linkedin.com/jobs/*"],
  run_at: "document_idle"
}

// Inject content CSS into the page (no Shadow DOM — we need direct DOM access)
const style = document.createElement("style")
style.textContent = cssText
document.head.appendChild(style)

// ─── State ──────────────────────────────────────────────────────────────────
let currentJobId: string | null = null
let panel: HTMLElement | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// ─── LinkedIn DOM selectors (with fallbacks — LinkedIn changes these often) ──
const SELECTORS = {
  jobDetailContainer: [
    ".jobs-details",
    ".job-view-layout",
    ".jobs-search__job-details",
    "[data-job-id]",
    ".scaffold-layout__detail"
  ],
  title: [
    ".jobs-unified-top-card__job-title",
    ".job-details-jobs-unified-top-card__job-title",
    "h1.t-24",
    "h1"
  ],
  company: [
    ".jobs-unified-top-card__company-name",
    ".job-details-jobs-unified-top-card__company-name",
    ".jobs-unified-top-card__subtitle-primary-grouping a"
  ],
  location: [
    ".jobs-unified-top-card__workplace-type",
    ".jobs-unified-top-card__bullet",
    ".job-details-jobs-unified-top-card__workplace-type",
    ".tvm__text"
  ],
  description: [
    "[data-testid='expandable-text-box']",
    ".jobs-description-content__text",
    ".jobs-description__content",
    "#job-details",
    ".jobs-box__html-content",
    ".jobs-description",
    ".show-more-less-html__markup",
    "article.jobs-description__container",
    ".core-section-container__content"
  ]
}

function queryFirst(selectors: string[]): Element | null {
  for (const sel of selectors) {
    const el = document.querySelector(sel)
    if (el) return el
  }
  return null
}

function queryAll(selectors: string[]): NodeListOf<Element> | Element[] {
  for (const sel of selectors) {
    const els = document.querySelectorAll(sel)
    if (els.length > 0) return els
  }
  return []
}

// ─── Extract job text from the detail panel ──────────────────────────────────
function extractJobText(): string {
  const parts: string[] = []

  const titleEl = queryFirst(SELECTORS.title)
  if (titleEl) parts.push("JOB TITLE: " + (titleEl as HTMLElement).innerText.trim())

  const companyEl = queryFirst(SELECTORS.company)
  if (companyEl) parts.push("COMPANY: " + (companyEl as HTMLElement).innerText.trim())

  const locationEls = queryAll(SELECTORS.location)
  const locationTexts = Array.from(locationEls).map(el => (el as HTMLElement).innerText.trim()).filter(Boolean)
  if (locationTexts.length) parts.push("LOCATION/TYPE: " + locationTexts.join(" · "))

  const descEl = queryFirst(SELECTORS.description)
  if (descEl) parts.push("\nJOB DESCRIPTION:\n" + (descEl as HTMLElement).innerText.trim())

  return parts.join("\n")
}

// ─── Get or generate a stable job ID from the URL ───────────────────────────
function getJobIdFromURL(): string | null {
  const match = window.location.href.match(/currentJobId=(\d+)|\/jobs\/view\/(\d+)/)
  return match ? (match[1] || match[2]) : null
}

// ─── Panel creation ──────────────────────────────────────────────────────────
function createPanel(): HTMLElement {
  const el = document.createElement("div")
  el.id = "ljf-panel"
  el.innerHTML = `
    <div id="ljf-header">
      <span id="ljf-logo">🔍 Job Filter</span>
      <span>
          <button id="ljf-refresh" title="Re-analyze" style="display:none">↺</button>
          <button id="ljf-toggle" title="Collapse">−</button>
      </span>
    </div>
    <div id="ljf-body">
      <div id="ljf-status" class="ljf-loading">
        <span class="ljf-spinner"></span>
        <span>Analyzing…</span>
      </div>
      <div id="ljf-result" style="display:none"></div>
    </div>
  `
  document.body.appendChild(el)

  let collapsed = false
  document.getElementById("ljf-toggle")!.addEventListener("click", () => {
    collapsed = !collapsed
    document.getElementById("ljf-body")!.style.display = collapsed ? "none" : "block"
    document.getElementById("ljf-toggle")!.textContent = collapsed ? "+" : "−"
  })

  document.getElementById("ljf-refresh")!.addEventListener("click", () => {
    triggerAnalysis()
  })

  return el
}

function ensurePanel(): HTMLElement {
  if (!document.getElementById("ljf-panel")) {
    panel = createPanel()
  }
  return document.getElementById("ljf-panel")!
}

function showLoading() {
  const p = ensurePanel()
  p.className = ""
  document.getElementById("ljf-status")!.style.display = "flex"
  document.getElementById("ljf-result")!.style.display = "none"
  document.getElementById("ljf-refresh")!.style.display = "none"
  document.getElementById("ljf-body")!.style.display = "block"
}

function showError(message: string) {
  const p = ensurePanel()
  p.className = "ljf-check"
  document.getElementById("ljf-status")!.style.display = "none"
  document.getElementById("ljf-refresh")!.style.display = "inline-block"
  const result = document.getElementById("ljf-result")!
  result.style.display = "block"
  result.innerHTML = `<div class="ljf-error">⚠️ ${escapeHtml(message)}</div>`
}

function showResult(data: any) {
  const p = ensurePanel()
  const verdict = data.verdict || "check"
  p.className = "ljf-" + verdict

  document.getElementById("ljf-status")!.style.display = "none"
  document.getElementById("ljf-refresh")!.style.display = "inline-block"
  const result = document.getElementById("ljf-result")!
  result.style.display = "block"

  const verdictIcon: Record<string, string> = { suitable: "✅", check: "⚠️", unsuitable: "❌" }
  const verdictLabel: Record<string, string> = { suitable: "Looks Good", check: "Review Needed", unsuitable: "Not Suitable" }

  const la = data.locationAnalysis || {}
  const flags: string[] = data.flags || []
  const positives: string[] = data.positives || []
  const kf = data.keyFacts || {}

  result.innerHTML = `
    <div class="ljf-verdict-row">
      <span class="ljf-verdict-icon">${verdictIcon[verdict] || "⚠️"}</span>
      <div>
        <div class="ljf-verdict-label">${verdictLabel[verdict] || "Review"}</div>
        <div class="ljf-verdict-reason">${escapeHtml(data.verdictReason || "")}</div>
      </div>
    </div>

    <div class="ljf-section">
      <div class="ljf-section-title">📍 Location Reality Check</div>
      <div class="ljf-loc-row">
        <span class="ljf-loc-badge">${escapeHtml(la.advertised || "?")}</span>
        <span class="ljf-arrow">→</span>
      </div>
      <div class="ljf-loc-actual">${escapeHtml(la.actualRequirement || "Not specified")}</div>
      ${la.notes ? `<div class="ljf-notes">${escapeHtml(la.notes)}</div>` : ""}
    </div>

    ${flags.length ? `
      <div class="ljf-section">
        <div class="ljf-section-title">🚩 Flags</div>
        <ul class="ljf-list ljf-flags">
          ${flags.map(f => `<li>${escapeHtml(f)}</li>`).join("")}
        </ul>
      </div>` : ""}

    ${positives.length ? `
      <div class="ljf-section">
        <div class="ljf-section-title">✓ Positives</div>
        <ul class="ljf-list ljf-positives">
          ${positives.map(p => `<li>${escapeHtml(p)}</li>`).join("")}
        </ul>
      </div>` : ""}

    <div class="ljf-keyfacts">
      ${kf.seniority ? `<span class="ljf-tag">${escapeHtml(kf.seniority)}</span>` : ""}
      ${kf.contractType ? `<span class="ljf-tag">${escapeHtml(kf.contractType)}</span>` : ""}
      ${kf.salary ? `<span class="ljf-tag ljf-salary">${escapeHtml(kf.salary)}</span>` : ""}
      ${(kf.stack || []).slice(0, 5).map((t: string) => `<span class="ljf-tag ljf-tech">${escapeHtml(t)}</span>`).join("")}
    </div>

    ${data._model ? `<div class="ljf-model">${escapeHtml(data._model)}</div>` : ""}
  `
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

// ─── Main analysis trigger ────────────────────────────────────────────────────
async function triggerAnalysis() {
  const jobText = extractJobText()
  console.log("[LJF] triggerAnalysis — jobText length:", jobText.length, "preview:", jobText.slice(0, 80))
  if (!jobText || jobText.length < 50) {
    showError("Could not read job details — LinkedIn may have updated their page layout. Try refreshing.")
    return
  }

  showLoading()

  const preferences = await new Promise<Record<string, string>>(resolve => {
    chrome.storage.sync.get(
      ["apiKey", "model", "workLocation", "timezoneRange", "flagKeywords", "requireKeywords", "provider", "localModel", "localEndpoint"],
      (raw) => {
        const parsed: Record<string, string> = {}
        for (const [k, v] of Object.entries(raw)) {
          try { parsed[k] = JSON.parse(v as string) } catch { parsed[k] = v as string }
        }
        resolve(parsed)
      }
    )
  })

  console.log("[LJF] sending to background, provider:", preferences.provider)
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out after 60s")), 60_000)
    )
    const response = await Promise.race([
      chrome.runtime.sendMessage({ name: "analyzeJob", body: { jobText, preferences } }),
      timeout
    ])
    console.log("[LJF] response from background:", response)
    if (!response.ok) {
      showError(response.error || "Unknown error")
      return
    }
    showResult(response.result)
  } catch (err: any) {
    showError("Extension error: " + err.message)
  }
}

// ─── MutationObserver — watch for job details loading ───────────────────────
function onJobDetailChanged() {
  clearTimeout(debounceTimer!)
  debounceTimer = setTimeout(() => {
    expandDescription()
    const newId = getJobIdFromURL()
    const jobText = extractJobText()

    if (jobText.length > 100 && newId !== currentJobId) {
      currentJobId = newId
      triggerAnalysis()
    }
  }, 300)
}

function startObserver() {
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        onJobDetailChanged()
        break
      }
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })

  let lastUrl = location.href
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href
      currentJobId = null
    }
  }).observe(document, { subtree: true, childList: true })
}

// ─── Expand truncated description ("…more" button) ──────────────────────────
function expandDescription() {
  const btn = document.querySelector(
    "[data-testid='expandable-text-button'], " +
    ".jobs-description__footer-button, " +
    "[data-tracking-control-name='public_jobs_show-more-html-btn'], " +
    ".jobs-description-content__text button"
  ) as HTMLElement | null
  if (btn) { btn.click(); return }

  const spans = document.querySelectorAll(
    ".jobs-description span, .jobs-description-content__text span, #job-details span"
  )
  for (const span of spans) {
    if (span.children.length === 0 && span.textContent?.trim() === "more") {
      (span.parentElement as HTMLElement).click()
      return
    }
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
startObserver()

const directJobId = getJobIdFromURL()
console.log("[LJF] boot — directJobId:", directJobId, "url:", window.location.href)
if (directJobId) {
  currentJobId = directJobId
  showLoading()

  let initAttempts = 0
  const initTimer = setInterval(() => {
    initAttempts++
    const jobText = extractJobText()
    console.log(`[LJF] initTimer attempt ${initAttempts} — jobText length: ${jobText.length}`)
    expandDescription()
    if (jobText.length > 50 || initAttempts >= 10) {
      clearInterval(initTimer)
      triggerAnalysis()
    }
  }, 500)
}

export {}
