# CLAUDE.md

## Project overview

Chrome extension (Manifest V3) that auto-analyzes LinkedIn job listings using AI. Injects a panel into the LinkedIn jobs page with a verdict, location analysis, flags, and key facts.

## Architecture

- `content.js` — injected into LinkedIn, reads the job detail DOM, sends a message to the service worker, renders the result panel
- `background.js` — service worker, handles all AI API calls (Gemini or local Ollama)
- `popup.html` / `popup.js` — settings UI, reads/writes to `chrome.storage.sync`

## AI providers

Two providers are supported, selected via the popup:

- **Gemini** (default) — calls `generativelanguage.googleapis.com` with the AI Studio API key
- **Local** — calls any OpenAI-compatible `/v1/chat/completions` endpoint (default: Ollama at `http://localhost:11434`)

The branch is in `analyzeJob()` in `background.js`. Both paths use the same system prompt and return the same JSON shape.

## Storage keys

| Key | Type | Default |
|---|---|---|
| `provider` | `"gemini"` \| `"local"` | `"gemini"` |
| `apiKey` | string | — |
| `model` | string | `"gemini-2.5-flash-lite"` |
| `localModel` | string | — |
| `localEndpoint` | string | `"http://localhost:11434"` |
| `workLocation` | string | — |
| `requireKeywords` | string | — |
| `flagKeywords` | string | — |

## Expected JSON response shape

```json
{
  "verdict": "suitable" | "check" | "unsuitable",
  "verdictReason": "one sentence",
  "locationAnalysis": {
    "advertised": "...",
    "actualRequirement": "...",
    "eligibleFromUserLocation": true | false | null,
    "notes": "..."
  },
  "flags": ["..."],
  "positives": ["..."],
  "keyFacts": {
    "seniority": "...",
    "stack": ["..."],
    "contractType": "...",
    "salary": "..."
  }
}
```

## Local development

Load unpacked from `chrome://extensions` with Developer mode on. After any JS change, click the reload button on the extension card. After a `content.js` change, also refresh the LinkedIn tab.

## Known fragility

LinkedIn DOM selectors are in the `SELECTORS` object at the top of `content.js` and break when LinkedIn updates their markup.
