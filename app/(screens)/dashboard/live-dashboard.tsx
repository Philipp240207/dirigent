"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import type { getState } from "../../../lib/store"
import { scenarioBuilding } from "../../../client/buildings"
import { HomeLink } from "../home-link"
import { LiveCaseActivity } from "./live-case-activity"
import { LivePortfolio } from "./live-portfolio"
import { LiveIncident, type WaterStatus } from "./live-incident"
import { JobContext } from "./job-context"
import { LiveConnector } from "./live-connector"
import { partnerName } from "../../../client/partners"

type State = ReturnType<typeof getState>
const labels = { open: "Checking the damage", pending_approval: "Awaiting approval", dispatched: "Waiting for the repair visit", scheduled: "Visit scheduled", resolved: "Repair complete" }

async function loadState(signal?: AbortSignal): Promise<State> {
  const response = await fetch("/api/state", { cache: "no-store", signal })
  if (!response.ok) throw new Error("Could not load cases.")
  return response.json()
}

function latestProposal(state: State, caseId: string, partnerId: string) {
  return state.events.findLast(event => event.case_id === caseId && event.kind === "partner_job_proposed" && event.payload.partner_id === partnerId)
}

function isReleased(state: State, caseId: string, partnerId: string) {
  return state.events.some(event => event.case_id === caseId && event.payload.partner_id === partnerId &&
    (event.kind === "partner_job_approved" || event.kind === "partner_job"))
}

// The latest proposal per partner, until that partner is approved (CLAUDE.md 7.2).
function openProposals(state: State, caseId: string) {
  const partners = new Set(state.events.flatMap(event => event.case_id === caseId && event.kind === "partner_job_proposed" &&
    typeof event.payload.partner_id === "string" ? [event.payload.partner_id] : []))
  return [...partners].flatMap(partnerId => {
    const proposal = latestProposal(state, caseId, partnerId)
    return proposal && !isReleased(state, caseId, partnerId) ? [{ partnerId, proposal }] : []
  })
}

function releasedPartners(state: State, caseId: string) {
  return [...new Set(state.events.flatMap(event => event.case_id === caseId && event.kind === "partner_job" &&
    typeof event.payload.partner_id === "string" ? [event.payload.partner_id] : []))]
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
  const [confirmReset, setConfirmReset] = useState(false)
  const [selectedCase, setSelectedCase] = useState("")
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

  async function approve(caseId: string, partnerId: string, proposalId: string) {
    if (sending.current) return
    sending.current = true
    setBusy(`approve:${caseId}:${partnerId}`)
    setError("")
    try {
      const current = await loadState()
      ++version.current
      setState(current)
      const latest = latestProposal(current, caseId, partnerId)
      if (current.cases.find(item => item.id === caseId)?.status === "resolved" || isReleased(current, caseId, partnerId) || latest?.id !== proposalId) {
        setError("The case changed. Review its current details.")
        return
      }
      if (containsPrivateAccess(sharedFields(latest.payload.shared))) {
        setError("Private access details must be removed from this proposal before sending.")
        return
      }
      const result = await fetch(`/api/cases/${encodeURIComponent(caseId)}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partner_id: partnerId }),
      })
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

  async function confirmWater(caseId: string, status: WaterStatus) {
    if (sending.current) return
    sending.current = true
    setBusy(`water:${caseId}`)
    setError("")
    try {
      const result = await fetch(`/api/cases/${encodeURIComponent(caseId)}/water-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const updated = await loadState()
      ++version.current
      setState(updated)
      if (!result.ok) setError(result.status === 409 ? "The case changed. Check the water status before retrying." : "Could not confirm the water status. Try again.")
    } catch {
      setError("Could not confirm the water status. Check the case before retrying.")
    } finally {
      sending.current = false
      setBusy("")
    }
  }

  async function refresh() {
    try {
      const updated = await loadState()
      ++version.current
      setState(updated)
    } catch {
      setOffline(true)
    }
  }

  async function resetDemo() {
    if (sending.current) return
    sending.current = true
    setBusy("reset")
    setError("")
    try {
      const response = await fetch("/api/reset", { method: "POST" })
      if (!response.ok) throw new Error()
      const updated = await loadState()
      ++version.current
      setSelectedCase("")
      setConfirmReset(false)
      setState(updated)
    } catch {
      setError("Could not reset the demo. Check the current cases before retrying.")
    } finally {
      sending.current = false
      setBusy("")
    }
  }

  const cases = state?.cases.toReversed().sort((a, b) => Number(b.status === "pending_approval") - Number(a.status === "pending_approval"))
  const displayed = cases?.some(item => item.id === selectedCase) ? selectedCase : cases?.[0]?.id
  return <main className="tracking-page">
    <header className="topbar"><HomeLink /><span className="mode">Property management</span></header>
    <div className="heading"><div><h1>Repair cases</h1><p>{scenarioBuilding.address}</p></div>
      {Boolean(cases?.length) && <button type="button" className="secondary" onClick={() => setConfirmReset(true)} disabled={Boolean(busy) || offline || confirmReset}>Reset demo</button>}
    </div>
    {confirmReset && <section className="reset-confirmation" aria-labelledby="reset-heading">
      <h2 id="reset-heading">Reset the demo?</h2>
      <p>This clears all cases and restarts the demo clock.</p>
      <div className="photo-actions">
        <button type="button" onClick={resetDemo} disabled={Boolean(busy) || offline}>Clear demo cases</button>
        <button type="button" className="secondary" onClick={() => setConfirmReset(false)} disabled={Boolean(busy)}>Cancel</button>
      </div>
    </section>}
    {offline && <p role="alert">Connection interrupted. Reconnecting…</p>}
    {error && <p role="alert">{error}</p>}
    {!state && !offline && <p role="status">Loading cases…</p>}
    {cases && <LivePortfolio cases={cases} caseId={displayed} />}
    {cases?.length === 0 && <p>No repairs reported.</p>}
    <div className="details">{cases?.map(item => {
      const events = state!.events.filter(event => event.case_id === item.id)
      const proposals = item.status === "resolved" ? [] : openProposals(state!, item.id)
      const released = releasedPartners(state!, item.id)
      return <section id={`case-${item.id}`} className="case-summary" key={item.id} data-status={item.status}>
        <h2>Water leak in apartment {item.unit_id}</h2>
        <p className="case-status" data-status={proposals.length ? "pending_approval" : item.status}>{labels[proposals.length ? "pending_approval" : item.status]}</p>
        {proposals.map(({ partnerId, proposal }) => {
          const fields = sharedFields(proposal.payload.shared)
          const withheld = proposal.payload.withheld
          const blocked = containsPrivateAccess(fields)
          return <div className="partner-review" key={partnerId}>
            <h3>{partnerName(partnerId)}</h3>
            <p>{String(proposal.payload.briefing ?? "")}</p>
            <p><strong>Cost estimate</strong> {typeof fields.cost_estimate_eur === "number" ? `€${fields.cost_estimate_eur}` : "Pending"}</p>
            {blocked && <p role="alert">This proposal contains private access details. A corrected proposal is needed before approval.</p>}
            <JobContext shared={fields} withheld={Array.isArray(withheld) ? withheld.filter((key): key is string => typeof key === "string") : []} sent={false} />
            <button className="case-action" disabled={Boolean(busy) || offline || blocked} onClick={() => approve(item.id, partnerId, proposal.id)}>
              {busy === `approve:${item.id}:${partnerId}` ? "Sending…" : "Approve and send"}
            </button>
          </div>
        })}
        {displayed === item.id ? <LiveIncident unit={item.unit_id} resolved={item.status === "resolved"} events={events}
          onWaterStatus={status => confirmWater(item.id, status)} waterBusy={busy === `water:${item.id}`} disabled={Boolean(busy) || offline} />
          : <button className="secondary" onClick={() => setSelectedCase(item.id)}>Show building and calls</button>}
        {displayed === item.id && item.status !== "resolved" && <LiveConnector caseId={item.id} events={events}
          connectors={state!.connectors} disabled={Boolean(busy) || offline} onChanged={refresh} />}
        {displayed === item.id && <LiveCaseActivity events={events} />}
        <details className="demo-views"><summary>Demo views</summary><div>
          <Link href={`/track/${item.id}`}>Resident tracking</Link>
          {released.map(partnerId => <Link key={partnerId} href={`/partner/${item.id}?partner=${encodeURIComponent(partnerId)}`}>{partnerName(partnerId)} job</Link>)}
        </div></details>
      </section>
    })}</div>
  </main>
}
