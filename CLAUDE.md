# CLAUDE.md

## Project overview

Chrome extension (Manifest V3) that auto-analyzes LinkedIn job listings using AI. Injects a panel into the LinkedIn jobs page with a verdict, location analysis, flags, and key facts.

Built with **Plasmo** (v0.90.5) + TypeScript + React. Build output is in `build/chrome-mv3-prod/`.

## Architecture

- `contents/linkedin.ts` — injected into LinkedIn, reads the job detail DOM, sends a message to the background handler, renders the result panel
- `background/index.ts` — background service worker; registers a `chrome.runtime.onMessage` listener, handles AI API calls (Gemini or Ollama) and timezone resolution
- `popup.tsx` / `popup.css` — settings UI React component, reads/writes to `chrome.storage.sync` via `@plasmohq/storage`
- `assets/prompt.md` — AI system prompt; defines verdict rules and JSON shape
- `assets/content.css` — styles for the injected panel (imported as `data-text:` in the content script)

## AI providers

Two providers are supported, selected via the popup:

- **Gemini** (default) — calls `generativelanguage.googleapis.com` with the AI Studio API key
- **Local** — calls any OpenAI-compatible `/v1/chat/completions` endpoint (default: Ollama at `http://localhost:11434`)

The branch is in `analyzeJob()` in `background/messages/analyzeJob.ts`. Both paths use the same system prompt and return the same JSON shape.

Ollama must be started with `OLLAMA_ORIGINS="*"` to allow requests from the extension's `chrome-extension://` origin.

## System prompt construction

The system instruction sent to the AI is built in `analyzeJob()` as:

```
[user context block — constructed from storage keys]
[assets/prompt.md contents]
```

The user context block is assembled in `background/messages/analyzeJob.ts` (not in the prompt file):
- `User location: {workLocation}`
- `Must-have keywords: {requireKeywords}`
- `Flag keywords: {flagKeywords}`
- Timezone check result (if `timezoneRange` is set — see below)

`assets/prompt.md` contains only behavior rules and the JSON shape. It has no placeholders.

## Timezone resolution

Handled entirely in `background/messages/analyzeJob.ts` by `resolveTzCompatibility()` — the AI does no arithmetic.

1. `detectTimezone(jobText)` scans for UTC/GMT offset patterns, written-out timezone names, and abbreviations (PST, MST, CET, JST, etc.) using `TZ_OFFSETS` lookup table
2. `parseTimezoneRange(rangeStr)` parses the user's range string (e.g. `"UTC-8 to UTC+3"` or `"CET +/-4"`) into `{ low, high }`
3. Result is injected into the user context as a pre-calculated fact: `"Timezone check (extension-calculated): job requires MST (UTC-7), user range is UTC-8 to UTC+3 — COMPATIBLE."`
4. The prompt instructs the AI to treat this line as definitive and not recalculate

## Storage keys

| Key | Type | Default |
|---|---|---|
| `provider` | `"gemini"` \| `"local"` | `"gemini"` |
| `apiKey` | string | — |
| `model` | string | `"gemini-2.5-flash-lite"` |
| `localModel` | string | — |
| `localEndpoint` | string | `"http://localhost:11434"` |
| `workLocation` | string | — |
| `timezoneRange` | string | — |
| `requireKeywords` | string | — |
| `flagKeywords` | string | — |

All keys are stored in `chrome.storage.sync`. The popup uses `@plasmohq/storage` with `{ area: "sync" }` explicitly; the content script reads via `chrome.storage.sync.get` directly.

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

```bash
yarn dev    # watch mode — rebuilds on file save
yarn build  # production build → build/chrome-mv3-prod/
```

Load `build/chrome-mv3-prod/` as an unpacked extension from `chrome://extensions` (Developer mode on). After any source change in watch mode, click the reload button on the extension card. After a `contents/linkedin.ts` change, also refresh the LinkedIn tab.

## Known fragility

LinkedIn DOM selectors are in the `SELECTORS` object at the top of `contents/linkedin.ts` and break when LinkedIn updates their markup.
