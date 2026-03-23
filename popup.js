// popup.js

const fields = ["apiKey", "model", "workLocation", "requireKeywords", "flagKeywords", "provider", "localModel", "localEndpoint"];

function updateProviderUI(provider) {
  const isLocal = provider === "local";
  document.getElementById("gemini-section").style.display = isLocal ? "none" : "block";
  document.getElementById("local-section").style.display = isLocal ? "block" : "none";
  document.getElementById("header-provider-label").textContent = isLocal
    ? "powered by local model (Ollama)"
    : "powered by Google Gemini";
}

async function fetchLocalModels(savedModel) {
  const endpoint = (document.getElementById("localEndpoint").value.trim() || "http://localhost:11434").replace(/\/$/, "");
  const select = document.getElementById("localModel");
  const status = document.getElementById("modelStatus");

  status.textContent = "connecting…";
  status.style.color = "#555";

  try {
    const res = await fetch(`${endpoint}/v1/models`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const models = (data.data || []).map(m => m.id).sort();
    if (models.length === 0) throw new Error("no models found");

    select.innerHTML = "";
    models.forEach(id => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = id;
      select.appendChild(opt);
    });

    if (savedModel && models.includes(savedModel)) {
      select.value = savedModel;
    }

    status.textContent = `✓ ${models.length} model${models.length !== 1 ? "s" : ""} available`;
    status.style.color = "#22c55e";
  } catch (err) {
    select.innerHTML = '<option value="">— could not connect —</option>';
    status.textContent = `✗ ${err.message} — is Ollama running with OLLAMA_ORIGINS="*"?`;
    status.style.color = "#f87171";
  }
}

// ── Save ────────────────────────────────────────────────────────────────────

function saveSettings() {
  const data = {};
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) data[id] = el.value.trim();
  });
  chrome.storage.sync.set(data, () => {
    const feedback = document.getElementById("feedback");
    feedback.classList.remove("hidden");
    setTimeout(() => feedback.classList.add("hidden"), 2000);
  });
}

let debounceTimer;
function saveDebounced() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(saveSettings, 600);
}

// ── Load saved settings ──────────────────────────────────────────────────────

chrome.storage.sync.get(fields, (data) => {
  fields.forEach(id => {
    if (id === "localModel") return; // restored after model fetch
    const el = document.getElementById(id);
    if (!el) return;
    if (id === "model") {
      el.value = data[id] || "gemini-2.5-flash-lite";
    } else if (id === "provider") {
      el.value = data[id] || "gemini";
    } else if (id === "localEndpoint") {
      el.value = data[id] || "http://localhost:11434";
    } else if (data[id]) {
      el.value = data[id];
    }
  });

  const provider = data.provider || "gemini";
  updateProviderUI(provider);

  if (provider === "local") {
    fetchLocalModels(data.localModel || "");
  }
});

// ── Auto-save listeners ──────────────────────────────────────────────────────

// Selects and checkboxes: save immediately on change
["provider", "model", "localModel"].forEach(id => {
  document.getElementById(id)?.addEventListener("change", saveSettings);
});

// Text inputs / textareas: debounce to avoid saving on every keystroke
["apiKey", "workLocation", "requireKeywords", "flagKeywords", "localEndpoint"].forEach(id => {
  document.getElementById(id)?.addEventListener("input", saveDebounced);
});

// ── Provider toggle ──────────────────────────────────────────────────────────

document.getElementById("provider").addEventListener("change", (e) => {
  updateProviderUI(e.target.value);
  if (e.target.value === "local") fetchLocalModels("");
});

// Refresh models when endpoint loses focus
document.getElementById("localEndpoint").addEventListener("blur", () => {
  if (document.getElementById("provider").value === "local") {
    fetchLocalModels(document.getElementById("localModel").value);
  }
});

// Refresh button
document.getElementById("refreshModels").addEventListener("click", () => {
  fetchLocalModels(document.getElementById("localModel").value);
});

// ── API key visibility toggle ────────────────────────────────────────────────

const apiKeyInput = document.getElementById("apiKey");
const showKeyBtn = document.getElementById("showKey");
showKeyBtn.addEventListener("click", () => {
  const isHidden = apiKeyInput.type === "password";
  apiKeyInput.type = isHidden ? "text" : "password";
  showKeyBtn.textContent = isHidden ? "hide" : "show";
});

// ── Manual save button ───────────────────────────────────────────────────────

document.getElementById("saveBtn").addEventListener("click", saveSettings);
