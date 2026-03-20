// content.js — injected into linkedin.com/jobs/*
// Watches for job detail panel changes and injects the analysis overlay.

(function () {
  "use strict";

  // ─── State ──────────────────────────────────────────────────────────────────
  let currentJobId = null;
  let panel = null;
  let debounceTimer = null;

  // ─── LinkedIn DOM selectors (with fallbacks — LinkedIn changes these often) ──
  const SELECTORS = {
    // The main job detail container
    jobDetailContainer: [
      ".jobs-details",
      ".job-view-layout",
      ".jobs-search__job-details",
      "[data-job-id]",
      ".scaffold-layout__detail"
    ],
    // Job title
    title: [
      ".jobs-unified-top-card__job-title",
      ".job-details-jobs-unified-top-card__job-title",
      "h1.t-24",
      "h1"
    ],
    // Company name
    company: [
      ".jobs-unified-top-card__company-name",
      ".job-details-jobs-unified-top-card__company-name",
      ".jobs-unified-top-card__subtitle-primary-grouping a"
    ],
    // Location / workplace type
    location: [
      ".jobs-unified-top-card__workplace-type",
      ".jobs-unified-top-card__bullet",
      ".job-details-jobs-unified-top-card__workplace-type",
      ".tvm__text"
    ],
    // Full job description
    description: [
      ".jobs-description-content__text",
      ".jobs-description__content",
      "#job-details",
      ".jobs-box__html-content"
    ]
  };

  function queryFirst(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function queryAll(selectors) {
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) return els;
    }
    return [];
  }

  // ─── Extract job text from the detail panel ──────────────────────────────────
  function extractJobText() {
    const parts = [];

    const titleEl = queryFirst(SELECTORS.title);
    if (titleEl) parts.push("JOB TITLE: " + titleEl.innerText.trim());

    const companyEl = queryFirst(SELECTORS.company);
    if (companyEl) parts.push("COMPANY: " + companyEl.innerText.trim());

    const locationEls = queryAll(SELECTORS.location);
    const locationTexts = Array.from(locationEls).map(el => el.innerText.trim()).filter(Boolean);
    if (locationTexts.length) parts.push("LOCATION/TYPE: " + locationTexts.join(" · "));

    const descEl = queryFirst(SELECTORS.description);
    if (descEl) parts.push("\nJOB DESCRIPTION:\n" + descEl.innerText.trim());

    return parts.join("\n");
  }

  // ─── Get or generate a stable job ID from the URL ───────────────────────────
  function getJobIdFromURL() {
    const match = window.location.href.match(/currentJobId=(\d+)|\/jobs\/view\/(\d+)/);
    return match ? (match[1] || match[2]) : null;
  }

  // ─── Panel creation ──────────────────────────────────────────────────────────
  function createPanel() {
    const el = document.createElement("div");
    el.id = "ljf-panel";
    el.innerHTML = `
      <div id="ljf-header">
        <span id="ljf-logo">🔍 Job Filter</span>
        <button id="ljf-toggle" title="Collapse">−</button>
      </div>
      <div id="ljf-body">
        <div id="ljf-status" class="ljf-loading">
          <span class="ljf-spinner"></span>
          <span>Analyzing…</span>
        </div>
        <div id="ljf-result" style="display:none"></div>
      </div>
    `;
    document.body.appendChild(el);

    // Collapse/expand toggle
    let collapsed = false;
    document.getElementById("ljf-toggle").addEventListener("click", () => {
      collapsed = !collapsed;
      document.getElementById("ljf-body").style.display = collapsed ? "none" : "block";
      document.getElementById("ljf-toggle").textContent = collapsed ? "+" : "−";
    });

    return el;
  }

  function ensurePanel() {
    if (!document.getElementById("ljf-panel")) {
      panel = createPanel();
    }
    return document.getElementById("ljf-panel");
  }

  function showLoading() {
    const p = ensurePanel();
    p.className = "";
    document.getElementById("ljf-status").style.display = "flex";
    document.getElementById("ljf-result").style.display = "none";
    document.getElementById("ljf-body").style.display = "block";
  }

  function showError(message) {
    const p = ensurePanel();
    p.className = "ljf-check";
    document.getElementById("ljf-status").style.display = "none";
    const result = document.getElementById("ljf-result");
    result.style.display = "block";
    result.innerHTML = `<div class="ljf-error">⚠️ ${escapeHtml(message)}</div>`;
  }

  function showResult(data) {
    const p = ensurePanel();
    const verdict = data.verdict || "check";
    p.className = "ljf-" + verdict;

    document.getElementById("ljf-status").style.display = "none";
    const result = document.getElementById("ljf-result");
    result.style.display = "block";

    const verdictIcon = { suitable: "✅", check: "⚠️", unsuitable: "❌" }[verdict] || "⚠️";
    const verdictLabel = { suitable: "Looks Good", check: "Review Needed", unsuitable: "Not Suitable" }[verdict] || "Review";

    const la = data.locationAnalysis || {};
    const flags = data.flags || [];
    const positives = data.positives || [];
    const kf = data.keyFacts || {};

    result.innerHTML = `
      <div class="ljf-verdict-row">
        <span class="ljf-verdict-icon">${verdictIcon}</span>
        <div>
          <div class="ljf-verdict-label">${verdictLabel}</div>
          <div class="ljf-verdict-reason">${escapeHtml(data.verdictReason || "")}</div>
        </div>
      </div>

      <div class="ljf-section">
        <div class="ljf-section-title">📍 Location Reality Check</div>
        <div class="ljf-loc-row">
          <span class="ljf-loc-badge">${escapeHtml(la.advertised || "?")}</span>
          <span class="ljf-arrow">→</span>
          <span class="ljf-loc-actual">${escapeHtml(la.actualRequirement || "Not specified")}</span>
        </div>
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
        ${(kf.stack || []).slice(0, 5).map(t => `<span class="ljf-tag ljf-tech">${escapeHtml(t)}</span>`).join("")}
      </div>
    `;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ─── Main analysis trigger ────────────────────────────────────────────────────
  async function triggerAnalysis() {
    const jobText = extractJobText();
    if (!jobText || jobText.length < 50) return; // not enough content yet

    showLoading();

    const preferences = await new Promise(resolve => {
      chrome.storage.sync.get(
        ["apiKey", "model", "workLocation", "flagKeywords", "requireKeywords"],
        resolve
      );
    });

    chrome.runtime.sendMessage(
      { type: "ANALYZE_JOB", payload: { jobText, preferences } },
      response => {
        if (chrome.runtime.lastError) {
          showError("Extension error: " + chrome.runtime.lastError.message);
          return;
        }
        if (!response.ok) {
          showError(response.error || "Unknown error");
          return;
        }
        showResult(response.result);
      }
    );
  }

  // ─── MutationObserver — watch for job details loading ───────────────────────
  function onJobDetailChanged() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const newId = getJobIdFromURL();
      const jobText = extractJobText();

      // Only re-analyze if we have content and the job has changed
      if (jobText.length > 100 && newId !== currentJobId) {
        currentJobId = newId;
        triggerAnalysis();
      }
    }, 300); // wait for DOM to settle
  }

  function startObserver() {
    // Watch the entire document body for subtree changes in job detail areas
    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          onJobDetailChanged();
          break;
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also watch for URL changes (LinkedIn is an SPA)
    let lastUrl = location.href;
    new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        currentJobId = null; // reset so next job triggers analysis
      }
    }).observe(document, { subtree: true, childList: true });
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────────
  startObserver();

  // Try once on initial load (if a job is already open in the URL)
  setTimeout(() => {
    const jobText = extractJobText();
    if (jobText.length > 100) {
      currentJobId = getJobIdFromURL();
      triggerAnalysis();
    }
  }, 500);
})();
