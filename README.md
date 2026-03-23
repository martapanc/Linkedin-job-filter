# LinkedIn Job Filter — Chrome Extension

AI-powered job ad analyzer that reads LinkedIn listings and flags misleading "remote" roles where the candidate must actually be located in a specific country.

Supports **Google Gemini** (free tier via Google AI Studio) and **local models via Ollama** (no API key required).

## What it does

- Watches the LinkedIn job detail panel and **auto-analyzes** each job you open
- Gives a **color-coded verdict**: ✅ Suitable / ⚠️ Review / ❌ Not suitable
- Does a **location reality check**: detects when a "Remote" job actually requires UK/US residency
- Lists **red flags** (e.g. "right to work in UK required") and **positives**
- Shows key facts: seniority, tech stack, salary, contract type

## Setup

Choose either provider — or set up both and switch in the popup.

### Option A: Google Gemini (free, no local GPU needed)

#### 1. Get a free Gemini API key
1. Go to https://aistudio.google.com
2. Sign in with your Google account
3. Click **Get API key** → **Create API key in new project**
4. Copy the key (starts with `AIza…`)

No billing setup required for the free tier. The free quota is generous enough for personal job searching.

### Option B: Local model via Ollama (private, no API key)

#### 1. Install Ollama

```bash
brew install ollama
```

Or download the app from [ollama.com](https://ollama.com).

#### 2. Start the server

Chrome extensions have a non-web origin, so Ollama's CORS policy blocks them by default. Start Ollama with:

```bash
OLLAMA_ORIGINS="*" ollama serve
```

#### 3. Pull a model

```bash
ollama pull llama3.2      # 2 GB — good starting point
ollama pull qwen2.5:7b    # 4 GB — reliable at structured JSON output
ollama pull mistral       # 4 GB — strong general reasoning
```

#### 4. Configure the extension

In the popup, set **Provider → Local model**, enter the model name exactly as shown in `ollama list` (e.g. `llama3.2`), leave the endpoint as `http://localhost:11434`, and save.

---

### Install the extension in Chrome
1. Open `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select this folder (`linkedin-job-filter/`)

### Configure your preferences
Click the extension icon in the Chrome toolbar and fill in:
- **Provider**: Gemini or Local model
- **API Key** (Gemini only): your key from AI Studio
- **Local model / Endpoint** (Local only): model name and Ollama URL
- **Work location**: describe where you're based and what you're eligible for
  - Example: `Andorra, EU citizen. Can work remotely from Andorra or anywhere in EU/EMEA. Not eligible for UK or US work without sponsorship.`
- **Require keywords**: tech you want to see (comma-separated)
  - Example: `React, TypeScript, Node.js`
- **Flag keywords**: phrases that should raise a warning
  - Example: `UK only, must be based in, right to work in UK, US timezone, sponsorship not available`

### Use it
Go to **LinkedIn Jobs**, search for jobs, and click any listing. The analysis panel appears in the bottom-right corner of the page within a few seconds.

## File structure

```
linkedin-job-filter/
├── manifest.json      # Extension config (MV3)
├── background.js      # Service worker — handles AI API calls (Gemini or Ollama)
├── content.js         # Injected into LinkedIn — reads DOM, shows panel
├── content.css        # Styles for the injected panel
├── popup.html         # Settings UI
├── popup.js           # Settings load/save logic
├── prompt.md          # AI system prompt with your personal rules (gitignored)
├── sample-prompt.md   # Starter template — copy to prompt.md and customise
├── icons/             # Extension icons (add your own PNG icons here)
└── README.md
```

## Notes

- **LinkedIn DOM selectors** may need updating if LinkedIn changes their markup. The relevant selectors are at the top of `content.js` in the `SELECTORS` object.
- **API costs**: Gemini free tier via Google AI Studio has rate limits sufficient for personal job searching. No credit card required. Local models via Ollama are completely free.
- **Privacy**: with Gemini, job text is sent to Google's API. With Ollama, everything stays on your machine.
- **Icons**: the `icons/` folder needs 16×16, 48×48, and 128×128 PNG icons. You can use any placeholder PNGs for local development.

## Tweaking the AI prompt

The prompt lives in `prompt.md` (gitignored — your personal copy). To get started:

```bash
cp sample-prompt.md prompt.md
```

Then edit `prompt.md` to reflect your situation: your timezone, region, what counts as a flag, how strictly to interpret location requirements, etc. Reload the extension after saving — no code changes needed.

The three variables in the prompt are filled in at runtime from your popup settings:
- `{{workLocation}}`
- `{{requireKeywords}}`
- `{{flagKeywords}}`
