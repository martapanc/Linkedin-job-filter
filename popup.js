// popup.js

const fields = ["apiKey", "model", "workLocation", "requireKeywords", "flagKeywords"];

// Load saved settings
chrome.storage.sync.get(fields, (data) => {
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === "model") {
      el.value = data[id] || "gemini-2.5-flash-lite";
    } else if (data[id]) {
      el.value = data[id];
    }
  });
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
