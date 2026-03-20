# LinkedIn Job Filter — Chrome Extension (Gemini Edition)

AI-powered job ad analyzer that reads LinkedIn listings and flags misleading "remote" roles where the candidate must actually be located in a specific country.

Powered by **Google Gemini 2.5 Flash** via the free tier at Google AI Studio — no credit card required.

## What it does

- Watches the LinkedIn job detail panel and **auto-analyzes** each job you open
- Gives a **color-coded verdict**: ✅ Suitable / ⚠️ Review / ❌ Not suitable
- Does a **location reality check**: detects when a "Remote" job actually requires UK/US residency
- Lists **red flags** (e.g. "right to work in UK required") and **positives**
- Shows key facts: seniority, tech stack, salary, contract type

## Setup

### 1. Get a free Gemini API key
1. Go to https://aistudio.google.com
2. Sign in with your Google account
3. Click **Get API key** → **Create API key in new project**
4. Copy the key (starts with `AIza…`)

No billing setup required for the free tier. The free quota is generous enough for personal job searching.

### 2. Install the extension in Chrome
1. Open `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select this folder (`linkedin-job-filter/`)

### 3. Configure your preferences
Click the extension icon in the Chrome toolbar and fill in:
- **API Key**: your Gemini API key from AI Studio (stored locally in Chrome sync storage)
- **Work location**: describe where you're based and what you're eligible for
  - Example: `Andorra, EU citizen. Can work remotely from Andorra or anywhere in EU/EMEA. Not eligible for UK or US work without sponsorship.`
- **Require keywords**: tech you want to see (comma-separated)
  - Example: `React, TypeScript, Node.js`
- **Flag keywords**: phrases that should raise a warning
  - Example: `UK only, must be based in, right to work in UK, US timezone, sponsorship not available`

### 4. Use it
Go to **LinkedIn Jobs**, search for jobs, and click any listing. The analysis panel appears in the bottom-right corner of the page within a few seconds.

## File structure

```
linkedin-job-filter/
├── manifest.json      # Extension config (MV3)
├── background.js      # Service worker — handles Anthropic API calls
├── content.js         # Injected into LinkedIn — reads DOM, shows panel
├── content.css        # Styles for the injected panel
├── popup.html         # Settings UI
├── popup.js           # Settings load/save logic
├── icons/             # Extension icons (add your own PNG icons here)
└── README.md
```

## Notes

- **LinkedIn DOM selectors** may need updating if LinkedIn changes their markup. The relevant selectors are at the top of `content.js` in the `SELECTORS` object.
- **API costs**: the free tier of Gemini 2.5 Flash via Google AI Studio is free with rate limits (sufficient for job searching). No credit card required.
- **Privacy**: job text is sent to Google's Gemini API. Your API key is stored in Chrome's local sync storage (not sent anywhere else).
- **Icons**: the `icons/` folder needs 16×16, 48×48, and 128×128 PNG icons. You can use any placeholder PNGs for local development.
- **Model**: uses `gemini-2.5-flash`. You can change this in `background.js` if you want to try other models.

## Tweaking the AI prompt

The analysis prompt is in `background.js` in the `systemInstruction` variable. You can edit it to change:
- How it interprets location requirements
- What counts as a flag vs. a positive
- The verdict thresholds
