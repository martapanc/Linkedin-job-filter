# LinkedIn Job Filter — Chrome Extension

AI-powered job ad analyzer that reads LinkedIn listings and flags misleading "remote" roles where the candidate must actually be located in a specific country.

Supports **Google Gemini** (free tier via Google AI Studio) and **local models via Ollama** (no API key required, fully private).

## What it does

- Watches the LinkedIn job detail panel and **auto-analyzes** each job you open
- Gives a **color-coded verdict**: ✅ Suitable / ⚠️ Review / ❌ Not suitable
- Does a **location reality check**: detects when a "Remote" job actually requires local residency
- **Timezone check**: resolves timezone names (MST, CET, JST…) to UTC offsets and compares against your acceptable range — no AI arithmetic involved
- Lists **red flags** and **positives**, shows key facts: seniority, tech stack, salary, contract type
- Settings **auto-save** as you type — no Save button needed

## Setup

Choose either provider — or set up both and switch in the popup.

### Option A: Google Gemini (free, no local hardware needed)

1. Go to https://aistudio.google.com
2. Sign in with your Google account
3. Click **Get API key** → **Create API key in new project**
4. Copy the key (starts with `AIza…`)

No billing setup required. The free quota is sufficient for personal job searching.

### Option B: Local model via Ollama (private, no API key)

#### 1. Install Ollama

```bash
brew install ollama
```

Or download the app from [ollama.com](https://ollama.com).

#### 2. Start the server

Chrome extensions have a non-web origin, so Ollama's CORS policy blocks them by default. Always start Ollama with:

```bash
OLLAMA_ORIGINS="*" ollama serve
```

If you get `address already in use`: `pkill ollama` first, then re-run the command above. If you use the macOS menu bar app, quit it from the menu bar icon before running this.

#### 3. Pull a model

```bash
ollama pull qwen2.5:7b    # 4.7 GB — best at following structured JSON instructions
ollama pull mistral       # 4.4 GB — strong general reasoning
ollama pull llama3.2      # 2.0 GB — lightest option, good starting point
ollama pull deepseek-r1   # 5.2 GB — strong reasoning, slower
```

The popup model selector auto-populates from your running Ollama instance. **`qwen2.5:7b` is recommended** for this task — it follows system prompt instructions most reliably among smaller models.

#### 4. Configure the extension

Set **Provider → Local model** in the popup. The model selector will load your available models automatically once Ollama is running. Leave the endpoint as `http://localhost:11434`.

---

### Install the extension in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select this folder

### Configure your preferences

Click the extension icon and fill in:

- **Provider**: Gemini or Local model
- **API Key** (Gemini only): your key from AI Studio
- **Local model** (Local only): selected from your running Ollama instance; hit ↻ to refresh
- **Endpoint URL** (Local only): defaults to `http://localhost:11434`
- **Work location**: describe where you're based and what you're eligible for
  - Example: `EU citizen based in Andorra. Looking for fully remote roles. No relocation, no hybrid.`
- **Acceptable timezone range** *(optional)*: the extension resolves this deterministically — no AI guesswork
  - Example: `UTC-8 to UTC+3`
- **Require keywords**: tech you want to see (comma-separated)
  - Example: `React, TypeScript, Node.js`
- **Flag keywords**: phrases that should raise a warning
  - Example: `must be based in, UK only, right to work in UK`

### Use it

Go to **LinkedIn Jobs**, search, and click any listing. The analysis panel appears in the bottom-right corner within a few seconds.

## File structure

```
linkedin-job-filter/
├── manifest.json      # Extension config (MV3)
├── background.js      # Service worker — AI API calls + timezone resolution
├── content.js         # Injected into LinkedIn — reads DOM, shows panel
├── content.css        # Styles for the injected panel
├── popup.html         # Settings UI
├── popup.js           # Settings load/save logic
├── prompt.md          # AI prompt — edit to customise behaviour
├── icons/             # Extension icons (16×16, 48×48, 128×128 PNG)
└── README.md
```

## Tweaking the AI prompt

The prompt lives in `prompt.md`. Edit it to reflect your situation: your region, what counts as a red flag, how strictly to interpret location requirements. Reload the extension after saving — no code changes needed.

Your popup settings (work location, keywords, timezone range) are injected automatically at runtime — the prompt itself contains no personal data and does not use placeholders.

## Notes

- **LinkedIn DOM selectors** may break if LinkedIn updates their markup. The relevant selectors are at the top of `content.js` in the `SELECTORS` object.
- **API costs**: Gemini free tier has rate limits sufficient for job searching. Local Ollama models are free.
- **Privacy**: with Gemini, job text is sent to Google's API. With Ollama, everything stays on your machine.
- **Icons**: add placeholder PNGs to `icons/` for local development (16×16, 48×48, 128×128).
