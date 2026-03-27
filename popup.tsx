import { useState, useEffect } from "react"
import { Storage } from "@plasmohq/storage"
import { useStorage } from "@plasmohq/storage/hook"
import "./popup.css"

const syncStorage = new Storage({ area: "sync" })

export default function IndexPopup() {
  const [provider, setProvider] = useStorage({ key: "provider", instance: syncStorage }, "gemini")
  const [apiKey, setApiKey] = useStorage({ key: "apiKey", instance: syncStorage }, "")
  const [model, setModel] = useStorage({ key: "model", instance: syncStorage }, "gemini-2.5-flash-lite")
  const [workLocation, setWorkLocation] = useStorage({ key: "workLocation", instance: syncStorage }, "")
  const [timezoneRange, setTimezoneRange] = useStorage({ key: "timezoneRange", instance: syncStorage }, "")
  const [requireKeywords, setRequireKeywords] = useStorage({ key: "requireKeywords", instance: syncStorage }, "")
  const [flagKeywords, setFlagKeywords] = useStorage({ key: "flagKeywords", instance: syncStorage }, "")
  const [localModel, setLocalModel] = useStorage({ key: "localModel", instance: syncStorage }, "")
  const [localEndpoint, setLocalEndpoint] = useStorage({ key: "localEndpoint", instance: syncStorage }, "http://localhost:11434")

  const [showKey, setShowKey] = useState(false)
  const [localModels, setLocalModels] = useState<string[]>([])
  const [modelStatus, setModelStatus] = useState("")
  const [modelStatusColor, setModelStatusColor] = useState("#555")
  const [saved, setSaved] = useState(false)

  const isLocal = (provider ?? "gemini") === "local"

  async function fetchLocalModels(savedModelId?: string) {
    const endpoint = (localEndpoint || "http://localhost:11434").replace(/\/$/, "")
    setModelStatus("connecting…")
    setModelStatusColor("#555")
    try {
      const res = await fetch(`${endpoint}/v1/models`, { signal: AbortSignal.timeout(4000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const models: string[] = (data.data || []).map((m: any) => m.id).sort()
      if (models.length === 0) throw new Error("no models found")
      setLocalModels(models)
      if (savedModelId && models.includes(savedModelId)) {
        setLocalModel(savedModelId)
      }
      setModelStatus(`✓ ${models.length} model${models.length !== 1 ? "s" : ""} available`)
      setModelStatusColor("#22c55e")
    } catch (err: any) {
      setLocalModels([])
      setModelStatus(`✗ ${err.message} — is Ollama running with OLLAMA_ORIGINS="*"?`)
      setModelStatusColor("#f87171")
    }
  }

  useEffect(() => {
    if (isLocal) {
      fetchLocalModels(localModel)
    }
  }, [isLocal])

  function handleProviderChange(value: string) {
    setProvider(value)
    if (value === "local") {
      fetchLocalModels(localModel)
    }
  }

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet" />

      <div className="header">
        <div className="header-name">LinkedIn <span>Job Filter</span></div>
        <div style={{ fontSize: "10px", color: "#444", marginTop: "3px", fontFamily: "'IBM Plex Mono', monospace" }}>
          {isLocal ? "powered by local model (Ollama)" : "powered by Google Gemini"}
        </div>
      </div>

      <div className="content">
        <div className="field">
          <label>Provider</label>
          <select value={provider ?? "gemini"} onChange={e => handleProviderChange(e.target.value)}>
            <option value="gemini">Gemini (Google AI Studio)</option>
            <option value="local">Local model (Ollama / OpenAI-compatible)</option>
          </select>
        </div>

        {!isLocal && (
          <div>
            <div className="field" style={{ marginTop: "14px" }}>
              <label>
                Gemini API Key
                <span className="label-hint"> — free at <a href="https://aistudio.google.com" target="_blank">aistudio.google.com</a></span>
              </label>
              <div className="api-key-row">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey ?? ""}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="AIza…"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button className="show-btn" onClick={() => setShowKey(!showKey)}>
                  {showKey ? "hide" : "show"}
                </button>
              </div>
            </div>
            <div className="field" style={{ marginTop: "14px" }}>
              <label>
                Model
                <span className="label-hint"> — switch if you hit rate limits</span>
              </label>
              <select value={model ?? "gemini-2.5-flash-lite"} onChange={e => setModel(e.target.value)}>
                <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite — fastest, most quota (default)</option>
                <option value="gemini-2.5-flash">gemini-2.5-flash — smarter, still fast</option>
                <option value="gemini-2.5-pro">gemini-2.5-pro — most capable, lowest quota</option>
              </select>
            </div>
          </div>
        )}

        {isLocal && (
          <div>
            <div className="field" style={{ marginTop: "14px" }}>
              <label>
                Endpoint URL
                <span className="label-hint"> — Ollama default: http://localhost:11434</span>
              </label>
              <input
                type="text"
                value={localEndpoint ?? "http://localhost:11434"}
                onChange={e => setLocalEndpoint(e.target.value)}
                onBlur={() => fetchLocalModels(localModel)}
                placeholder="http://localhost:11434"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="field" style={{ marginTop: "14px" }}>
              <label>Local model</label>
              <div className="api-key-row">
                <select
                  value={localModel ?? ""}
                  onChange={e => setLocalModel(e.target.value)}
                  style={{ flex: 1 }}>
                  {localModels.length === 0
                    ? <option value="">— connect to load models —</option>
                    : localModels.map(id => <option key={id} value={id}>{id}</option>)
                  }
                </select>
                <button className="show-btn" onClick={() => fetchLocalModels(localModel)} title="Refresh model list">↻</button>
              </div>
              <div style={{ fontSize: "10.5px", color: modelStatusColor, fontFamily: "'IBM Plex Mono', monospace", marginTop: "2px" }}>
                {modelStatus}
              </div>
            </div>
          </div>
        )}

        <hr className="divider" />

        <div className="field">
          <label>
            Your work location
            <span className="label-hint"> — where you're physically based</span>
          </label>
          <textarea
            value={workLocation ?? ""}
            onChange={e => setWorkLocation(e.target.value)}
            rows={2}
            placeholder="e.g. Andorra, can work remotely across EU/EMEA. Not eligible to work in UK or USA."
          />
        </div>

        <div className="field">
          <label>
            Acceptable timezone range
            <span className="label-hint"> — optional, checked by the extension (not the AI)</span>
          </label>
          <input
            type="text"
            value={timezoneRange ?? ""}
            onChange={e => setTimezoneRange(e.target.value)}
            placeholder="e.g. UTC-8 to UTC+3"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="field">
          <label>
            Require keywords
            <span className="label-hint"> — job should mention these (tech stack, etc.)</span>
          </label>
          <textarea
            value={requireKeywords ?? ""}
            onChange={e => setRequireKeywords(e.target.value)}
            rows={2}
            placeholder="e.g. React, TypeScript, Node.js"
          />
        </div>

        <div className="field">
          <label>
            Flag keywords
            <span className="label-hint"> — phrases that should trigger a warning</span>
          </label>
          <textarea
            value={flagKeywords ?? ""}
            onChange={e => setFlagKeywords(e.target.value)}
            rows={2}
            placeholder="e.g. UK only, must be based in, right to work in UK, sponsorship not available"
          />
        </div>

        <button className="save-btn" onClick={handleSave}>Save settings</button>
        <div className={`feedback${saved ? "" : " hidden"}`}>✓ Saved</div>
      </div>

      <div className="footer">
        API key is stored locally in Chrome sync storage.<br />
        Get a free key at <a href="https://aistudio.google.com" target="_blank">aistudio.google.com</a> → Get API key.
      </div>
    </div>
  )
}
