import type { PlasmoMessaging } from "@plasmohq/messaging"

// ── Timezone resolution ──────────────────────────────────────────────────────

const TZ_OFFSETS: Record<string, number> = {
  // North America
  AKST: -9, AKDT: -8,
  PST: -8, PDT: -7,
  MST: -7, MDT: -6,
  CST: -6, CDT: -5,
  EST: -5, EDT: -4,
  AST: -4, NST: -3.5,
  // UTC / GMT
  UTC: 0, GMT: 0,
  // Europe
  WET: 0, WEST: 1,
  CET: 1, CEST: 2,
  EET: 2, EEST: 3,
  MSK: 3,
  // Asia / Pacific
  GST: 4, PKT: 5, IST: 5.5,
  BST_BD: 6, ICT: 7,
  SGT: 8, HKT: 8, CST_CN: 8, AWST: 8, ULAT: 8,
  JST: 9, KST: 9,
  ACST: 9.5, ACDT: 10.5,
  AEST: 10, AEDT: 11,
  NZST: 12, NZDT: 13,
}

const TZ_NAME_PATTERNS: [RegExp, number][] = [
  [/\balaska(?:n)?\s+(?:standard\s+)?time\b/i, -9],
  [/\bpacific\s+(?:standard\s+)?time\b/i, -8],
  [/\bmountain\s+(?:standard\s+)?time\b/i, -7],
  [/\bcentral\s+(?:standard\s+)?time\b/i, -6],
  [/\beast(?:ern)?\s+(?:standard\s+)?time\b/i, -5],
  [/\bgreenwich\s+mean\s+time\b/i, 0],
  [/\bcentral\s+european\s+(?:standard\s+)?time\b/i, 1],
  [/\beast(?:ern)?\s+european\s+(?:standard\s+)?time\b/i, 2],
  [/\bindia(?:n)?\s+(?:standard\s+)?time\b/i, 5.5],
  [/\bjapan\s+(?:standard\s+)?time\b/i, 9],
  [/\baustrali(?:a|an)\s+eastern\s+(?:standard\s+)?time\b/i, 10],
  [/\bnew\s+zealand\s+(?:standard\s+)?time\b/i, 12],
]

const TZ_ABBREVS = [
  'AKST','AKDT','CEST','EEST','WEST','NZST','NZDT','AEDT','AEST','ACDT','ACST',
  'AWST','PDT','PST','MDT','MST','CDT','CST','EDT','EST','AST','NST',
  'UTC','GMT','WET','CET','EET','MSK','GST','PKT','IST','ICT','SGT',
  'HKT','JST','KST',
]

function detectTimezone(text: string) {
  const explicitMatch = text.match(/\b(UTC|GMT)([+-])(\d{1,2})(?::(\d{2}))?/i)
  if (explicitMatch) {
    const sign = explicitMatch[2] === '+' ? 1 : -1
    const offset = sign * (parseInt(explicitMatch[3]) + (explicitMatch[4] ? parseInt(explicitMatch[4]) / 60 : 0))
    return { label: explicitMatch[0].toUpperCase(), offset }
  }

  for (const [pattern, offset] of TZ_NAME_PATTERNS) {
    const m = text.match(pattern)
    if (m) return { label: m[0], offset }
  }

  for (const abbrev of TZ_ABBREVS) {
    const re = new RegExp(`\\b${abbrev}\\b`, 'i')
    if (re.test(text)) {
      const key = abbrev.toUpperCase()
      const offset = TZ_OFFSETS[key] ?? TZ_OFFSETS[key + '_CN'] ?? null
      if (offset !== null) return { label: abbrev, offset }
    }
  }

  return null
}

function parseTimezoneRange(rangeStr: string) {
  // Handle "CET +/-4", "CET ±4", "CET +/- 4 timezones", etc.
  const relativeMatch = rangeStr.match(/\b([A-Z]{2,5})\s*(?:\+\/-|±)\s*(\d+(?:\.\d+)?)/i)
  if (relativeMatch) {
    const abbrev = relativeMatch[1].toUpperCase()
    const delta = parseFloat(relativeMatch[2])
    const baseOffset = TZ_OFFSETS[abbrev] ?? TZ_OFFSETS[abbrev + '_CN'] ?? null
    if (baseOffset !== null) {
      return { low: baseOffset - delta, high: baseOffset + delta }
    }
  }

  // Accept "UTC-8 to UTC+3", "-8 to +3", etc.
  const nums = [...rangeStr.matchAll(/([+-]?\d+(?:\.\d+)?)/g)].map(m => parseFloat(m[1]))
  if (nums.length >= 2) return { low: Math.min(nums[0], nums[1]), high: Math.max(nums[0], nums[1]) }
  return null
}

function resolveTzCompatibility(jobText: string, timezoneRange: string | undefined) {
  if (!timezoneRange?.trim()) return null
  const range = parseTimezoneRange(timezoneRange)
  if (!range) return null

  const detected = detectTimezone(jobText)
  if (!detected) return `No specific timezone requirement detected in the job text. Timezone range check skipped.`

  const { label, offset } = detected
  const compatible = offset >= range.low && offset <= range.high
  const offsetStr = offset >= 0 ? `UTC+${offset}` : `UTC${offset}`
  const rangeStr = `UTC${range.low >= 0 ? '+' : ''}${range.low} to UTC${range.high >= 0 ? '+' : ''}${range.high}`

  return compatible
    ? `Timezone check (extension-calculated): job requires ${label} (${offsetStr}), user range is ${rangeStr} — COMPATIBLE. Treat timezone as acceptable.`
    : `Timezone check (extension-calculated): job requires ${label} (${offsetStr}), user range is ${rangeStr} — INCOMPATIBLE. Flag timezone as a blocker.`
}

// ── AI analysis ──────────────────────────────────────────────────────────────

interface Preferences {
  apiKey?: string
  model?: string
  workLocation?: string
  timezoneRange?: string
  flagKeywords?: string
  requireKeywords?: string
  provider?: string
  localModel?: string
  localEndpoint?: string
}

async function analyzeJob({ jobText, preferences }: { jobText: string; preferences: Preferences }) {
  const { model, workLocation, timezoneRange, flagKeywords, requireKeywords, provider, localModel } = preferences
  const apiKey = preferences.apiKey?.trim()
  const localEndpoint = preferences.localEndpoint?.trim()

  const tzResult = resolveTzCompatibility(jobText, timezoneRange)

  const userContext = [
    `User location: ${workLocation || "unspecified"}`,
    `Must-have keywords: ${requireKeywords || "none"}`,
    `Flag keywords: ${flagKeywords || "none"}`,
    tzResult ?? null,
  ].filter(Boolean).join("\n")

  const rules = await fetch(chrome.runtime.getURL("assets/prompt.md")).then(r => r.text())
  const systemInstruction = `${userContext}\n\n${rules.trim()}`
  const userPrompt = `Analyze this job ad:\n\n${jobText.slice(0, 8000)}`

  let raw: string
  let usedModel: string

  if (provider === "local") {
    if (!localModel) throw new Error("No local model set. Open the extension popup to configure.")
    usedModel = localModel

    const endpoint = (localEndpoint || "http://localhost:11434").replace(/\/$/, "")
    const response = await fetch(`${endpoint}/v1/chat/completions`, {
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
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err?.error?.message || `Local model API error ${response.status}`)
    }

    const data = await response.json()
    raw = data?.choices?.[0]?.message?.content || ""
    if (!raw) throw new Error("Empty response from local model")

  } else {
    // Gemini (default)
    if (!apiKey) throw new Error("No API key set. Open the extension popup to configure.")

    const selectedModel = model || "gemini-2.5-flash-lite"
    usedModel = selectedModel
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`

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
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err?.error?.message || `Gemini API error ${response.status}`)
    }

    const data = await response.json()
    raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || ""

    if (!raw) {
      const finishReason = data?.candidates?.[0]?.finishReason
      if (finishReason && finishReason !== "STOP") {
        throw new Error(`Gemini stopped with reason: ${finishReason}`)
      }
      throw new Error("Empty response from Gemini API")
    }
  }

  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()

  try {
    const parsed = JSON.parse(cleaned)
    parsed._model = usedModel
    return parsed
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
      keyFacts: { seniority: null, stack: [], contractType: null, salary: null },
      _model: usedModel
    }
  }
}

// ── Plasmo message handler ────────────────────────────────────────────────────

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  try {
    const result = await analyzeJob(req.body)
    res.send({ ok: true, result })
  } catch (err: any) {
    res.send({ ok: false, error: err.message })
  }
}

export default handler
