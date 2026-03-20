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
  const { apiKey, workLocation, flagKeywords, requireKeywords } = preferences;

  if (!apiKey) throw new Error("No API key set. Open the extension popup to configure.");

  const systemInstruction = `You are a job ad analyst helping a developer find roles they can actually work from their location.
The user's work situation:
- Physical location: ${workLocation || "not specified"}
- Must include (tech/keywords): ${requireKeywords || "not specified"}
- Red flag phrases (if found, flag them): ${flagKeywords || "not specified"}

Your job is to read a LinkedIn job ad and return a structured JSON object.
CRITICAL: Return ONLY raw JSON. No markdown, no backticks, no explanation — just the JSON object.

Use this exact shape:
{
  "verdict": "suitable" | "check" | "unsuitable",
  "verdictReason": "one sentence summary",
  "locationAnalysis": {
    "advertised": "what the ad claims (e.g. Remote, Hybrid, On-site)",
    "actualRequirement": "what is actually required after reading carefully (e.g. Must be UK-based, EU timezone only, etc.)",
    "eligibleFromUserLocation": true | false | null,
    "notes": "any caveats or ambiguities"
  },
  "flags": ["list of red flags found, e.g. 'UK residency required', 'sponsorship not available'"],
  "positives": ["list of things that match the user's criteria"],
  "keyFacts": {
    "seniority": "e.g. Senior, Staff, Mid-level",
    "stack": ["key technologies mentioned"],
    "contractType": "Full-time / Contract / Part-time",
    "salary": "if mentioned, else null"
  }
}

Verdict logic:
- "suitable": the user can likely work this from their location, meets their criteria
- "check": unclear location requirements or some flags worth reviewing manually
- "unsuitable": explicitly excludes the user's location, or missing required keywords

Be a careful reader. A job that says "Remote" but then says "must be eligible to work in the UK" or "UK-based candidates only" is NOT truly remote-friendly for someone outside the UK. Flag this clearly.`;

  const userPrompt = `Analyze this job ad:\n\n${jobText.slice(0, 8000)}`;

  // Gemini AI Studio endpoint (free tier key from aistudio.google.com)
  const model = "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

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
        temperature: 0.1,      // low temperature = more consistent/structured output
        maxOutputTokens: 1024
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
