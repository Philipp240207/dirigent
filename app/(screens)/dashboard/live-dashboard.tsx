"use client"

import { useEffect, useRef, useState } from "react"
import type { getState } from "../../../lib/store"
import { scenarioBuilding } from "../../../client/buildings"
import { HomeLink } from "../home-link"
import { JobContext } from "./job-context"

type State = ReturnType<typeof getState>
const labels = { open: "Checking the damage", pending_approval: "Awaiting approval", dispatched: "Waiting for the plumber", scheduled: "Visit scheduled", resolved: "Repair complete" }

async function loadState(signal?: AbortSignal): Promise<State> {
  const response = await fetch("/api/state", { cache: "no-store", signal })
  if (!response.ok) throw new Error("Could not load cases.")
  return response.json()
}

function latestProposal(state: State, caseId: string) {
  return state.events.findLast(event => event.case_id === caseId && event.kind === "partner_job_proposed" && event.payload.partner_id === "plumber_krause")
}

function sharedFields(value: unknown): Record<string, string | number | string[]> {
  if (!value || typeof value !== "object") return {}
  return Object.fromEntries(Object.entries(value).filter(([, field]) =>
    typeof field === "string" || typeof field === "number" || (Array.isArray(field) && field.every(item => typeof item === "string"))))
}

function containsPrivateAccess(fields: ReturnType<typeof sharedFields>) {
  // Older proposals bundled the key-safe code into free-form access instructions.
  return "key_safe" in fields || "rent_arrears_eur" in fields ||
    (typeof fields.access_info === "string" && /key safe|schlüsseltresor/i.test(fields.access_info))
}

export function LiveDashboard() {
  const [state, setState] = useState<State | null>(null)
  const [offline, setOffline] = useState(false)
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const version = useRef(0)
  const sending = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    let timer: number
    async function poll() {
      const before = version.current
      try {
        const snapshot = await loadState(controller.signal)
        if (!controller.signal.aborted && before === version.current) {
          setState(snapshot)
          setOffline(false)
        }
      } catch {
        if (!controller.signal.aborted) setOffline(true)
      } finally {
        if (!controller.signal.aborted) timer = window.setTimeout(poll, 2500)
      }
    }
    void poll()
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [])

  async function approve(caseId: string, proposalId: string) {
    if (sending.current) return
    sending.current = true
    setBusy(caseId)
    setError("")
    try {
      const current = await loadState()
      ++version.current
      setState(current)
      if (current.cases.find(item => item.id === caseId)?.status !== "pending_approval" || latestProposal(current, caseId)?.id !== proposalId) {
        setError("The case changed. Review its current details.")
        return
      }
      if (containsPrivateAccess(sharedFields(latestProposal(current, caseId)?.payload.shared))) {
        setError("Private access details must be removed from this proposal before sending.")
        return
      }
      const result = await fetch(`/api/cases/${encodeURIComponent(caseId)}/approve`, { method: "POST" })
      if (!result.ok) throw new Error()
      const updated = await loadState()
      ++version.current
      setState(updated)
    } catch {
      setError("Could not confirm the approval. Check the case status before retrying.")
    } finally {
      sending.current = false
      setBusy("")
    }
  }

  const cases = state?.cases.toReversed().sort((a, b) => Number(b.status === "pending_approval") - Number(a.status === "pending_approval"))
  return <main className="tracking-page">
    <header className="topbar"><HomeLink /><span className="mode">Property management</span></header>
    <div className="heading"><div><h1>Repair cases</h1><p>{scenarioBuilding.address}</p></div></div>
    {offline && <p role="alert">Connection interrupted. Reconnecting…</p>}
    {error && <p role="alert">{error}</p>}
    {!state && !offline && <p role="status">Loading cases…</p>}
    {cases?.length === 0 && <p>No repairs reported.</p>}
    <div className="details">{cases?.map(item => {
      const proposal = latestProposal(state!, item.id)
      const fields = sharedFields(proposal?.payload.shared)
      const withheld = proposal?.payload.withheld
      const ready = item.status === "pending_approval" && proposal?.payload.status === "awaiting_approval"
      return <section className="case-summary" key={item.id} data-status={item.status}>
        <h2>Water leak in apartment {item.unit_id}</h2>
        <p className="case-status" data-status={item.status}>{labels[item.status]}</p>
        {ready && proposal && <>
          <h3>Sanitär Krause</h3>
          <p>{String(proposal.payload.briefing ?? "")}</p>
          <p><strong>Cost estimate</strong> {typeof fields.cost_estimate_eur === "number" ? `€${fields.cost_estimate_eur}` : "Pending"}</p>
          {containsPrivateAccess(fields) && <p role="alert">This proposal contains private access details. A corrected proposal is needed before approval.</p>}
          <JobContext shared={fields} withheld={Array.isArray(withheld) ? withheld.filter((key): key is string => typeof key === "string") : []} sent={false} />
          <button className="case-action" disabled={Boolean(busy) || offline || containsPrivateAccess(fields)} onClick={() => approve(item.id, proposal.id)}>{busy === item.id ? "Sending…" : "Approve and send"}</button>
        </>}
      </section>
    })}</div>
  </main>
}
