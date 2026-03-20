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
  const { apiKey, model, workLocation, flagKeywords, requireKeywords } = preferences;

  if (!apiKey) throw new Error("No API key set. Open the extension popup to configure.");

  const systemInstruction = `You are a job ad analyst. Return ONLY raw JSON, no markdown or explanation.
User: location=${workLocation || "unspecified"}, must-have=${requireKeywords || "none"}, red-flags=${flagKeywords || "none"}.
JSON shape:
{"verdict":"suitable"|"check"|"unsuitable","verdictReason":"one sentence","locationAnalysis":{"advertised":"...","actualRequirement":"...","eligibleFromUserLocation":true|false|null,"notes":"..."},"flags":["..."],"positives":["..."],"keyFacts":{"seniority":"...","stack":["..."],"contractType":"...","salary":"..."}}
Rules: suitable=user can work there and meets criteria; unsuitable=explicitly excludes user or missing must-haves; check=ambiguous. "Remote" jobs that require UK residency/right-to-work are unsuitable for non-UK users — flag this.`;

  const userPrompt = `Analyze this job ad:\n\n${jobText.slice(0, 8000)}`;

  // Gemini AI Studio endpoint (free tier key from aistudio.google.com)
  const selectedModel = model || "gemini-2.5-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }]
        }
      ],
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

  // Gemini response shape: data.candidates[0].content.parts[0].text
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  if (!raw) {
    // Check for safety blocks or other finish reasons
    const finishReason = data?.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== "STOP") {
      throw new Error(`Gemini stopped with reason: ${finishReason}`);
    }
    throw new Error("Empty response from Gemini API");
  }

  // Strip any accidental markdown fences Gemini might add despite instructions
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // If JSON parse fails, return a graceful fallback
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
