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

// Load saved settings
chrome.storage.sync.get(fields, (data) => {
  fields.forEach(id => {
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
  updateProviderUI(data.provider || "gemini");
});

// Toggle provider sections
document.getElementById("provider").addEventListener("change", (e) => {
  updateProviderUI(e.target.value);
});

// Toggle API key visibility
const apiKeyInput = document.getElementById("apiKey");
const showKeyBtn = document.getElementById("showKey");
showKeyBtn.addEventListener("click", () => {
  const isHidden = apiKeyInput.type === "password";
  apiKeyInput.type = isHidden ? "text" : "password";
  showKeyBtn.textContent = isHidden ? "hide" : "show";
});

// Save
document.getElementById("saveBtn").addEventListener("click", () => {
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
});
