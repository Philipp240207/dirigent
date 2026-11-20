"use client"

import { useState } from "react"
import type { getState } from "../../../lib/store"
import { partnerName } from "../../../client/partners"

type State = ReturnType<typeof getState>
type CaseEvent = State["events"][number]
type Connector = {
  partner_id?: unknown
  role?: unknown
  handover?: { required?: unknown; never?: unknown }
}

// Fields centrix can hand over for a water leak (building graph, case and photo).
const centrixFields = new Set([
  "address", "unit_id", "caretaker_contact", "affected_units", "problem_description",
  "damage_photo", "damage_assessment", "tenant_availability", "cost_estimate_eur",
])
// Never leaves centrix, whatever a connector asks for (CLAUDE.md 7.1, context pass).
const policyBlocked = ["key_safe", "rent_arrears_eur", "main_door_code"]
const sample = "Elektro Schmitz, Düsseldorf. Electrical repairs and 24/7 emergency service. For a job we need the address, the flat, a photo of the problem, the damage assessment, when the tenant is available and who opens the door."

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function electricsFlagged(events: CaseEvent[]) {
  return events.some(event => {
    if (event.kind === "reasoning") return typeof event.payload.text === "string" && /no electrician connected/i.test(event.payload.text)
    const assessment = event.kind === "photo" ? event.payload.assessment : undefined
    return Boolean(assessment && typeof assessment === "object" && "electrics" in assessment && assessment.electrics === true)
  })
}

export function LiveConnector({ caseId, events, connectors, disabled, onChanged }: {
  caseId: string
  events: CaseEvent[]
  connectors: State["connectors"]
  disabled: boolean
  onChanged: () => void
}) {
  const [text, setText] = useState("")
  const [draft, setDraft] = useState<Connector | null>(null)
  const [busy, setBusy] = useState<"" | "draft" | "activate">("")
  const [error, setError] = useState("")

  const activated = events.findLast(event => event.kind === "connector_activated")?.payload.partner_id
  const electricianActive = connectors.some(item => item.role === "electrician" && item.active)
  if (activated || electricianActive) {
    return <p className="live-connector-status" role="status">
      {activated ? `${partnerName(activated)} is connected to this case.` : "An electrician is connected."}
    </p>
  }
  if (!electricsFlagged(events)) return null

  async function requestDraft() {
    if (!text.trim() || busy) return
    setBusy("draft")
    setError("")
    try {
      const response = await fetch("/api/connectors/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partner_text: text.trim() }),
      })
      if (response.status === 404) throw new Error("Connector drafting is not available on this server yet.")
      const body = await response.json().catch(() => null) as { connector?: Connector } | null
      if (!response.ok || !body?.connector || typeof body.connector !== "object") throw new Error("The connector could not be drafted. Edit the description and try again.")
      setDraft(body.connector)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The connector could not be drafted.")
    } finally {
      setBusy("")
    }
  }

  async function activate() {
    if (!draft || busy) return
    setBusy("activate")
    setError("")
    try {
      const response = await fetch("/api/connectors/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connector: draft, case_id: caseId }),
      })
      if (!response.ok) throw new Error()
      onChanged()
    } catch {
      setError("The connector could not be activated. Check the case before retrying.")
    } finally {
      setBusy("")
    }
  }

  const required = strings(draft?.handover?.required)
  const missing = required.filter(field => !centrixFields.has(field))
  const blocked = [...new Set([...strings(draft?.handover?.never), ...policyBlocked])]

  return <section className="live-connector connector-demo" aria-labelledby={`connector-${caseId}`}>
    <h3 id={`connector-${caseId}`}>Connect an electrician</h3>
    <p>The photo shows water near electrics. No electrician is connected yet.</p>
    {!draft ? <form onSubmit={event => { event.preventDefault(); void requestDraft() }}>
      <label htmlFor={`partner-text-${caseId}`}>Partner website text</label>
      <textarea id={`partner-text-${caseId}`} value={text} rows={4} onChange={event => setText(event.target.value)} />
      <div className="connector-actions">
        <button disabled={!text.trim() || Boolean(busy) || disabled}>{busy === "draft" ? "Drafting…" : "Draft connector"}</button>
        <button type="button" className="secondary" onClick={() => setText(sample)} disabled={Boolean(busy)}>Use sample</button>
      </div>
    </form> : <>
      <p><strong>{partnerName(draft.partner_id)}</strong> · {typeof draft.role === "string" ? draft.role : "partner"}</p>
      <ul className="connector-checks">
        <li data-check="ok">Schema valid</li>
        <li data-check={missing.length ? "warn" : "ok"}>
          {missing.length ? `Not in centrix: ${missing.join(", ")}` : `Handover fields available in centrix (${required.length})`}
        </li>
        <li data-check="ok">Blocked by policy: {blocked.join(", ")}</li>
      </ul>
      <details className="connector-json"><summary>View connector JSON</summary><pre>{JSON.stringify(draft, null, 2)}</pre></details>
      <div className="connector-actions">
        <button onClick={activate} disabled={Boolean(busy) || disabled}>{busy === "activate" ? "Activating…" : "Activate for this case"}</button>
        <button type="button" className="secondary" onClick={() => setDraft(null)} disabled={Boolean(busy)}>Edit text</button>
      </div>
    </>}
    {error && <p role="alert">{error}</p>}
  </section>
}
