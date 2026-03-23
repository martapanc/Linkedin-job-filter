// background.js — service worker
// Handles calls to the Google Gemini API (free tier via AI Studio key).

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ANALYZE_JOB") {
    analyzeJob(message.payload)
      .then(result => sendResponse({ ok: true, result }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true; // keep channel open for async response
  }
});

async function analyzeJob({ jobText, preferences }) {
  const { apiKey, model, workLocation, flagKeywords, requireKeywords, provider, localModel, localEndpoint } = preferences;

  const userContext = [
    `User location: ${workLocation || "unspecified"}`,
    `Must-have keywords: ${requireKeywords || "none"}`,
    `Flag keywords: ${flagKeywords || "none"}`,
  ].join("\n");

  const rules = await fetch(chrome.runtime.getURL("prompt.md")).then(r => r.text());
  const systemInstruction = `${userContext}\n\n${rules.trim()}`;

  const userPrompt = `Analyze this job ad:\n\n${jobText.slice(0, 8000)}`;

  let raw;

  if (provider === "local") {
    if (!localModel) throw new Error("No local model set. Open the extension popup to configure.");

    const endpoint = (localEndpoint || "http://localhost:11434").replace(/\/$/, "");
    const url = `${endpoint}/v1/chat/completions`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: localModel,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err?.error?.message || `Local model API error ${response.status}`;
      throw new Error(msg);
    }

    const data = await response.json();
    raw = data?.choices?.[0]?.message?.content || "";

    if (!raw) throw new Error("Empty response from local model");

  } else {
    // Gemini (default)
    if (!apiKey) throw new Error("No API key set. Open the extension popup to configure.");

    const selectedModel = model || "gemini-2.5-flash-lite";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 512,
          thinkingConfig: { thinkingBudget: 0 }
        }
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err?.error?.message || `Gemini API error ${response.status}`;
      throw new Error(msg);
    }

    const data = await response.json();
    raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!raw) {
      const finishReason = data?.candidates?.[0]?.finishReason;
      if (finishReason && finishReason !== "STOP") {
        throw new Error(`Gemini stopped with reason: ${finishReason}`);
      }
      throw new Error("Empty response from Gemini API");
    }
  }

  // Strip any accidental markdown fences
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    return {
      verdict: "check",
      verdictReason: "Could not parse AI response. Check the job manually.",
      locationAnalysis: {
        advertised: "Unknown",
        actualRequirement: "Unknown",
        eligibleFromUserLocation: null,
        notes: cleaned.slice(0, 300)
      },
      flags: [],
      positives: [],
      keyFacts: { seniority: null, stack: [], contractType: null, salary: null }
    };
  }
}
