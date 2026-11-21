"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import type { getState } from "../../../lib/store"
import { buildings, buildingPortrait, buildingUnits, scenarioBuilding } from "../../../client/buildings"
import { HomeLink } from "../home-link"
import { LiveCaseActivity } from "./live-case-activity"
import { LiveIncident, incidentRisks, type WaterStatus } from "./live-incident"
import { BuildingSection, IncidentSection, riskStyles } from "./building-section"
import { PortfolioMap, type MapState } from "./portfolio-map"
import { JobContext } from "./job-context"
import { LiveConnector } from "./live-connector"
import { partnerName } from "../../../client/partners"

type State = ReturnType<typeof getState>
type CaseEvent = State["events"][number]
const labels = { open: "Checking the damage", pending_approval: "Awaiting approval", dispatched: "Waiting for the repair visit", scheduled: "Visit scheduled", resolved: "Repair complete" }

// Navigation icons and overview titles from the management design.
const navPaths = {
  Portfolio: "M3 20V8l6-4 6 4v12M15 10h5v10H3m4-9h4m-4 4h4",
  Tasks: "M8 4h9v16H5V4h3m0 0v3h6V4m-6 9 2 2 4-5",
  Activity: "M2 13h4l3-8 4 14 3-8 2 2h4",
  Outbox: "M3 13l3-8h12l3 8v6H3zm0 0h5l1 3h6l1-3h5",
  Chevron: "m9 5 7 7-7 7",
  Connectors: "m9 8 4-4a4 4 0 0 1 6 6l-3 3m-1 3-4 4a4 4 0 0 1-6-6l3-3m1 3 6-6",
}
function NavIcon({ name }: { name: keyof typeof navPaths }) {
  return <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={navPaths[name]} /></svg>
}
const overviewTitles = { tasks: "Tasks", portfolio: "Portfolio", activity: "Activity", outbox: "Outbox", connectors: "Connectors" }
type Overview = keyof typeof overviewTitles
const approvalTarget = "approval-panel"
const recentActivityLimit = 5
const languageNames: Record<string, string> = { de: "German", en: "English", fr: "French" }
const clockOptions = { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" } as const
const retryClock = new Intl.DateTimeFormat("en-GB", clockOptions)
const eventClock = new Intl.DateTimeFormat("en-GB", { ...clockOptions, second: "2-digit" })

// Times only from event fields (CLAUDE.md 5.1), shown in Berlin time.
function EventTime({ at }: { at: string }) {
  const timestamp = Date.parse(at)
  return Number.isFinite(timestamp) ? <time dateTime={at} title="Berlin time">{eventClock.format(timestamp)}</time> : null
}

function who(id: unknown) {
  if (id === "caretaker") return "Caretaker Peter Wolf"
  if (id === "owner") return "Property owner"
  const unit = typeof id === "string" && /^t(\d)(\d)$/.exec(id)
  return unit ? `Apartment ${unit[1]}.${unit[2]}` : partnerName(id)
}

function text(value: unknown) {
  return typeof value === "string" ? value : undefined
}

function activityEntry(event: CaseEvent): { title: string; detail?: string } | null {
  const p = event.payload
  const recipient = who(p.to_tenant_id)
  switch (event.kind) {
    case "case_created": return { title: "Water leak reported", detail: `Apartment ${text(p.unit_id) ?? ""}` }
    case "affected": return { title: p.unit_id === "cellar" ? "Cellar" : `Apartment ${text(p.unit_id) ?? ""}`, detail: riskStyles[text(p.risk) ?? ""]?.label }
    case "call_started": return { title: `Call started · ${recipient}`, detail: [p.attempt && `Attempt ${p.attempt}`, languageNames[text(p.language) ?? ""], p.dry_run ? "Simulated call" : null].filter(Boolean).join(" · ") }
    case "call_ended": return { title: `${p.outcome === "no_answer" ? "No answer" : "Call completed"} · ${recipient}`, detail: text(p.summary) }
    case "call_retry_scheduled": {
      const at = Date.parse(text(p.at) ?? "")
      return { title: `${Number.isFinite(at) ? `Retry at ${retryClock.format(at)}` : "Retry scheduled"} · ${recipient}`, detail: p.attempt ? `Attempt ${p.attempt}` : undefined }
    }
    case "message": return { title: `Message queued · ${who(p.to)}` }
    case "photo": {
      const assessment = p.assessment as { damage?: unknown } | undefined
      return { title: "Damage photo assessed", detail: text(assessment?.damage) }
    }
    case "partner_job_proposed": return { title: `${partnerName(p.partner_id)} job ready for review` }
    case "partner_job_approved": return { title: "Job approved by property manager" }
    case "partner_job": return { title: `Job sent to ${partnerName(p.partner_id)}` }
    case "water_shutoff_requested": return { title: "Caretaker asked to shut off water", detail: Array.isArray(p.units) ? p.units.join(", ") : undefined }
    case "water_status_confirmed": return { title: p.status === "off" ? "Water shut off" : "Water back on", detail: Array.isArray(p.units) ? p.units.join(", ") : undefined }
    case "connector_activated": return { title: `${partnerName(p.partner_id)} connector activated` }
    case "slot_confirmed": return { title: `Appointment confirmed · ${partnerName(p.partner_id)}`, detail: text(p.slot) }
    case "result": return { title: `Work reported · ${partnerName(p.partner_id)}`, detail: text(p.work_description) }
    case "maintenance_log": return { title: "Repair logged", detail: text(p.work_description) }
    case "reasoning": return { title: "Dirigent assessment", detail: text(p.text) }
    default: return null
  }
}

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

// What the manager should see per released partner: waiting for the call, the confirmed visit, or the result.
function partnerProgress(state: State, caseId: string, partnerId: string) {
  const own = state.events.filter(event => event.case_id === caseId &&
    (event.payload.partner_id === partnerId || (partnerId === "plumber_krause" && event.payload.partner_id == null)))
  const slot = own.findLast(event => event.kind === "slot_confirmed")?.payload.slot
  const proposed = own.findLast(event => event.kind === "slot_proposed")?.payload.slot
  const result = own.findLast(event => event.kind === "result")?.payload
  return {
    slot: typeof slot === "string" ? slot : "",
    proposed: typeof proposed === "string" ? proposed : "",
    cost: typeof result?.cost_eur === "number" ? result.cost_eur : null,
    done: Boolean(result),
  }
}

// Flats where the caretaker shuts off the water: water_shutoff_units from the proposal or job when
// the server sends it, otherwise the reported and confirmed flats of the case.
function shutoffUnits(state: State, caseId: string, payload?: Record<string, unknown>) {
  const listed = payload?.water_shutoff_units
  if (Array.isArray(listed)) return listed.filter((unit): unit is string => typeof unit === "string")
  const events = state.events.filter(event => event.case_id === caseId)
  if (!events.some(event => event.kind === "water_shutoff_requested")) return []
  const risk = new Map<string, string>()
  for (const event of events) {
    if (event.kind === "affected" && typeof event.payload.unit_id === "string" && typeof event.payload.risk === "string") {
      risk.set(event.payload.unit_id, event.payload.risk)
    }
  }
  return [...risk].filter(([unit, value]) => value === "confirmed" && unit !== "cellar").map(([unit]) => unit)
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
  // Start on the portfolio so the map shows the building light up when a report comes in.
  const [overview, setOverview] = useState<Overview>("portfolio")
  const [selectedId, setSelectedId] = useState("")
  const [query, setQuery] = useState("")
  const [showFullActivity, setShowFullActivity] = useState(false)
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

  // Confirms the slot the partner proposed on the phone (Emil's confirm-slot route).
  async function confirmSlot(caseId: string, partnerId: string) {
    if (sending.current) return
    sending.current = true
    setBusy(`confirm:${caseId}:${partnerId}`)
    setError("")
    try {
      const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}/confirm-slot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partner_id: partnerId }),
      })
      if (response.status === 404) setError("Confirming the appointment is not available on this server yet.")
      else if (!response.ok) setError("The appointment could not be confirmed. Check the case and try again.")
      await refresh()
    } catch {
      setError("The appointment could not be confirmed. Check the connection and try again.")
    } finally {
      sending.current = false
      setBusy("")
    }
  }

  // Calls the partner again after the visit to collect the result (Emil's partner-call route).
  async function askForUpdate(caseId: string, partnerId: string) {
    if (sending.current) return
    sending.current = true
    setBusy(`update:${caseId}:${partnerId}`)
    setError("")
    try {
      const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}/partner-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partner_id: partnerId, mode: "report" }),
      })
      if (response.status === 404) setError("Asking for an update is not available on this server yet.")
      else if (!response.ok) setError("The update call could not be started. Try again.")
      await refresh()
    } catch {
      setError("The update call could not be started. Check the connection and try again.")
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
      setSelectedId("")
      setOverview("tasks")
      setConfirmReset(false)
      setState(updated)
    } catch {
      setError("Could not reset the demo. Check the current cases before retrying.")
    } finally {
      sending.current = false
      setBusy("")
    }
  }

  const cases = state?.cases.toReversed() ?? []
  // The case shown for the scenario building: the newest open one, else the newest.
  const current = cases.find(item => item.status !== "resolved") ?? cases[0]
  const events = current ? state!.events.filter(event => event.case_id === current.id) : []
  const proposals = current && current.status !== "resolved" ? openProposals(state!, current.id) : []
  const released = current ? releasedPartners(state!, current.id) : []
  const pendingCount = proposals.length
  const status = current ? (pendingCount ? "pending_approval" : current.status) : undefined
  const selectedBuilding = buildings.find(building => building.id === selectedId)
  const allEvents = state?.events ?? []
  const activity = allEvents.flatMap(event => {
    const entry = activityEntry(event)
    return entry ? [{ ...entry, id: event.id, at: event.at }] : []
  }).reverse()
  const visibleActivity = showFullActivity ? activity : activity.slice(0, recentActivityLimit)
  const outbox = allEvents.filter(event => event.kind === "message" && typeof event.payload.text === "string").toReversed()
  const downstairsConfirmed = events.some(event => event.kind === "affected" && event.payload.unit_id === "2.1" && event.payload.risk === "confirmed")
  const flatsMessaged = new Set(events.flatMap(event => event.kind === "message" && typeof event.payload.to === "string" && /^t\d\d$/.test(event.payload.to) ? [event.payload.to] : [])).size
  const waterState = events.findLast(event => event.kind === "water_status_confirmed")?.payload.status
  const nextDecision = pendingCount ? `Approve ${partnerName(proposals[0].partnerId)} job` : status ? labels[status as keyof typeof labels] : "No open repairs"

  const locations = buildings.filter(({ address, city }) =>
    `${address} ${city}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  ).map(building => {
    const isScenario = building.id === scenarioBuilding.id && Boolean(current)
    const needsApproval = isScenario && pendingCount > 0
    // An open water leak shows red on the map and in the list until the visit is scheduled.
    const state: MapState = !isScenario ? "clear"
      : status === "resolved" ? "completed" : status === "scheduled" ? "scheduled" : "attention"
    const label = isScenario && status
      ? state === "attention" ? `Water damage · ${labels[status as keyof typeof labels]}` : labels[status as keyof typeof labels]
      : "No open cases"
    return { building, status: label, state, needsApproval }
  }).sort((a, b) => Number(b.state === "attention") - Number(a.state === "attention"))
  const apartmentCount = buildings.reduce((count, building) => count + buildingUnits(building).length, 0)

  function openOverview(view: Overview) {
    setSelectedId("")
    setOverview(view)
    window.scrollTo(0, 0)
  }

  function openBuilding(id: string, section = "building-address") {
    setSelectedId(id)
    // Focus and scroll once the building view has rendered.
    window.setTimeout(() => {
      const element = document.getElementById(section)
      element?.focus({ preventScroll: true })
      element?.scrollIntoView({ block: "start" })
    }, 50)
  }

  const statusBanner = <>
    {offline && <p role="alert">Connection interrupted. Reconnecting…</p>}
    {error && <p role="alert">{error}</p>}
    {!state && !offline && <p role="status">Loading cases…</p>}
  </>

  return (
    <main className="management-dashboard">
      <header className="topbar management-topbar">
        <div className="management-brand"><HomeLink onNavigate={() => openOverview("tasks")} /><span>Property management</span></div>
        <nav className="management-nav" aria-label="Property management">
          <button type="button" aria-pressed={overview === "portfolio" && !selectedBuilding} onClick={() => openOverview("portfolio")}><NavIcon name="Portfolio" />Portfolio</button>
          <button type="button" aria-pressed={overview === "tasks" && !selectedBuilding} onClick={() => openOverview("tasks")}><NavIcon name="Tasks" />Tasks <span>{pendingCount}</span></button>
        </nav>
        <div className="management-utilities">
          <button type="button" aria-pressed={overview === "activity" && !selectedBuilding} onClick={() => openOverview("activity")}><NavIcon name="Activity" />Activity</button>
          <button type="button" aria-pressed={overview === "outbox" && !selectedBuilding} onClick={() => openOverview("outbox")}><NavIcon name="Outbox" />Outbox</button>
          <button type="button" aria-pressed={overview === "connectors" && !selectedBuilding} onClick={() => openOverview("connectors")}><NavIcon name="Connectors" />Connectors</button>
        </div>
      </header>
      {statusBanner}
      {!selectedBuilding ? (
        <>
          <div className="heading management-heading">
            <div>
              <h1>{overviewTitles[overview]}</h1>
              {overview === "portfolio" && <p>{buildings.length} buildings · {apartmentCount} apartments</p>}
              {overview === "tasks" && <p>{pendingCount ? `${pendingCount} ${pendingCount === 1 ? "task needs" : "tasks need"} your decision` : "No tasks need a decision"}</p>}
            </div>
          </div>
          {overview === "tasks" && (
            <section className="task-hero" aria-labelledby="task-heading">
              <img className="case-portrait" src="/mock/dirigent-building.svg" alt="" />
              <div>
                {pendingCount > 0 && <span className="task-priority">Urgent</span>}
                <h2 id="task-heading">{current ? "Water damage reported" : "No open repairs"}</h2>
                <p>{scenarioBuilding.address}{current && ` · Apartment ${current.unit_id}`}</p>
              </div>
              <div className="task-decision">
                <p>{pendingCount ? "Next decision" : "Case status"}</p>
                <h3>{current ? nextDecision : "Waiting for a report"}</h3>
                <button type="button" onClick={() => openBuilding(scenarioBuilding.id, pendingCount ? approvalTarget : "building-address")}>
                  {pendingCount ? `Review ${partnerName(proposals[0].partnerId)} job` : current ? "View case" : "View building"}
                </button>
              </div>
            </section>
          )}
          {overview === "portfolio" && (
            <section className="management-portfolio" aria-label="Buildings">
              <div className="portfolio-toolbar">
                <input type="search" aria-label="Search buildings" placeholder="Search buildings" value={query} onChange={event => setQuery(event.target.value)} />
              </div>
              <div className="portfolio-layout">
                <ul className="property-register" aria-label="Building list">
                  {locations.map(({ building, status: label, state: mapState, needsApproval }) => (
                    <li key={building.id}>
                      <button className="property-row" type="button" onClick={() => openBuilding(building.id, needsApproval ? approvalTarget : "building-address")}>
                        <img src={buildingPortrait(building)} alt="" />
                        <span className="property-data">
                          <strong>{building.address}</strong>
                          <small>{building.city} · {buildingUnits(building).length} apartments</small>
                          <span className="case-status" data-status={mapState === "completed" ? "resolved" : mapState === "clear" ? "idle" : mapState === "attention" ? "alert" : "open"}>{label}</span>
                        </span>
                        <span className="row-action"><span>{needsApproval ? "Review job" : mapState === "scheduled" ? "View appointment" : "View building"}</span> <NavIcon name="Chevron" /></span>
                      </button>
                    </li>
                  ))}
                  {!locations.length && <li className="job-empty">No buildings match your search.</li>}
                </ul>
                <PortfolioMap locations={locations} onSelect={openBuilding} />
              </div>
            </section>
          )}
          {overview === "activity" && (
            <section className="workspace-feed" aria-label="Event history">
              {current && status !== "resolved" && (
                <button className="activity-property" onClick={() => openBuilding(scenarioBuilding.id)}>
                  <img src={buildingPortrait(scenarioBuilding)} alt="" width="44" height="48" />
                  {scenarioBuilding.address}<NavIcon name="Chevron" />
                </button>
              )}
              {activity.length ? (
                <ol id="activity-timeline" className="activity-timeline" aria-label="Latest activity first">
                  {visibleActivity.map(({ id, at, title, detail }) => (
                    <li key={id}>
                      <EventTime at={at} />
                      <div className="activity-entry"><strong>{title}</strong>{detail && <p>{detail}</p>}</div>
                    </li>
                  ))}
                </ol>
              ) : <p>No activity yet. It starts when a resident reports a repair.</p>}
              {activity.length > recentActivityLimit && (
                <button type="button" className="activity-toggle" aria-expanded={showFullActivity} aria-controls="activity-timeline"
                  onClick={() => setShowFullActivity(expanded => !expanded)}>
                  {showFullActivity ? "Show latest 5" : `Show full history (${activity.length})`}
                </button>
              )}
            </section>
          )}
          {overview === "outbox" && (
            <section className="workspace-feed" aria-label="Outgoing messages">
              {outbox.length ? (
                <ul className="outbox-list">
                  {outbox.map(event => (
                    <li key={event.id}>
                      <div className="outbox-heading"><strong>{who(event.payload.to)}</strong><EventTime at={event.at} /></div>
                      <p className="outbox-body">{String(event.payload.text)}</p>
                    </li>
                  ))}
                </ul>
              ) : <p>No messages yet.</p>}
            </section>
          )}
          {overview === "connectors" && (
            <section className="workspace-feed" aria-label="Connectors">
              <ul className="outbox-list">
                {(state?.connectors ?? []).map(connector => (
                  <li key={connector.partner_id}>
                    <div className="outbox-heading"><strong>{partnerName(connector.partner_id)}</strong><span>{connector.active ? "Active" : "Inactive"}</span></div>
                    <p className="outbox-body">Role: {connector.role}</p>
                  </li>
                ))}
              </ul>
              {current && current.status !== "resolved"
                ? <LiveConnector caseId={current.id} events={events} connectors={state!.connectors} disabled={Boolean(busy) || offline} onChanged={refresh} />
                : null}
              <p>A new partner is connected from an open case once the photo shows that it is needed.</p>
            </section>
          )}
        </>
      ) : (
        <>
          <button className="portfolio-back" type="button" onClick={() => openOverview("portfolio")}>All buildings</button>
          <div className="heading building-heading">
            <div>
              <h1 id="building-address" tabIndex={-1}>{selectedBuilding.address}</h1>
              <p>{selectedBuilding.city} · {buildingUnits(selectedBuilding).length} apartments</p>
            </div>
          </div>
          {selectedBuilding.id === scenarioBuilding.id ? (
            <div className="dashboard-grid incident-workspace" key={selectedBuilding.id}>
              <div className="details">
                <section className="case-summary incident-decision" data-status={status ?? "idle"} id={approvalTarget} tabIndex={-1} aria-labelledby="case-summary-heading">
                  <h2 id="case-summary-heading">{current ? `Water damage in apartment ${current.unit_id}` : "No active case"}</h2>
                  {!current ? <p>Waiting for a resident to report a repair.</p> : <>
                    <p className="case-status" data-status={status}>{labels[status as keyof typeof labels]}</p>
                    {proposals.map(({ partnerId, proposal }) => {
                      const fields = sharedFields(proposal.payload.shared)
                      const withheld = proposal.payload.withheld
                      const blocked = containsPrivateAccess(fields)
                      const units = Array.isArray(proposal.payload.water_shutoff_units) || proposal.payload.role === "plumber"
                        ? shutoffUnits(state!, current.id, proposal.payload) : []
                      return <div className="partner-review" key={partnerId}>
                        <h3>{String(proposal.payload.briefing ?? "Review the job")}</h3>
                        <p><strong>{partnerName(partnerId)}</strong> · Cost estimate {typeof fields.cost_estimate_eur === "number" ? `€${fields.cost_estimate_eur}` : "pending"}</p>
                        {units.length > 0 && <p className="caretaker-line"><strong>Caretaker:</strong> shut off water in flats {units.join(", ")}</p>}
                        {blocked && <p role="alert">This proposal contains private access details. A corrected proposal is needed before approval.</p>}
                        <button className="case-action" disabled={Boolean(busy) || offline || blocked} onClick={() => approve(current.id, partnerId, proposal.id)}>
                          {busy === `approve:${current.id}:${partnerId}` ? "Sending…" : "Approve and send"}
                        </button>
                        <JobContext shared={fields} withheld={Array.isArray(withheld) ? withheld.filter((key): key is string => typeof key === "string") : []} sent={false} partner={partnerName(partnerId)} />
                      </div>
                    })}
                    {!proposals.length && !released.length && <><h3>Checking the damage</h3><p>Dirigent is contacting residents and preparing the plumber’s job for your review.</p></>}
                    {released.map(partnerId => {
                      const progress = partnerProgress(state!, current.id, partnerId)
                      const name = partnerName(partnerId)
                      return <div className="partner-progress" key={partnerId} data-step={progress.done ? "done" : progress.slot ? "scheduled" : progress.proposed ? "proposed" : "calling"}>
                        {progress.done ? <p><strong>{name}</strong> reported the repair complete{progress.cost !== null ? ` · €${progress.cost}` : ""}.</p>
                          : !progress.slot && progress.proposed ? <>
                            <p><strong>Appointment proposed: {progress.proposed}</strong> · {name}</p>
                            <button type="button" className="case-action" disabled={Boolean(busy) || offline} onClick={() => confirmSlot(current.id, partnerId)}>
                              {busy === `confirm:${current.id}:${partnerId}` ? "Confirming…" : "Confirm appointment"}
                            </button>
                          </>
                          : progress.slot ? <>
                            <p><strong>Appointment: {progress.slot}</strong> · {name}</p>
                            <p>The caretaker lets them in. Residents and the caretaker were notified.</p>
                            <button type="button" className="secondary" disabled={Boolean(busy) || offline} onClick={() => askForUpdate(current.id, partnerId)}>
                              {busy === `update:${current.id}:${partnerId}` ? "Calling…" : `Ask ${partnerId === "plumber_krause" ? "plumber" : name} for update`}
                            </button>
                          </>
                          : <>
                            {(() => {
                              const notes = events.filter(event => event.kind === "reasoning" && typeof event.payload.text === "string" && /plumber call|appointment call/i.test(event.payload.text))
                              const problem = partnerId === "plumber_krause" && notes.some(event => /skipped|did not save|could not be verified/i.test(String(event.payload.text)))
                              const onPhone = partnerId === "plumber_krause" && notes.some(event => /call started/i.test(String(event.payload.text)))
                              return problem
                                ? <p role="alert">The phone call to <strong>{name}</strong> did not confirm a visit. Open their page to enter it.</p>
                                : <p><strong>Calling {partnerId === "plumber_krause" ? "plumber" : name}…</strong> {name}{onPhone ? " is being called on the phone" : " is asked"} to agree on a visit.</p>
                            })()}
                            <Link className="case-action partner-call-link" href={`/partner/${current.id}?partner=${encodeURIComponent(partnerId)}`}>Open {name}’s phone</Link>
                          </>}
                      </div>
                    })}
                  </>}
                </section>
                {current && (() => {
                  const photo = events.findLast(event => event.kind === "photo" && typeof event.payload.url === "string" && event.payload.url)
                  if (!photo) return null
                  const assessment = photo.payload.assessment as { damage?: unknown; severity?: unknown; electrics?: unknown } | undefined
                  return <figure className="case-photo">
                    <img src={String(photo.payload.url)} alt={`Damage photo from apartment ${current.unit_id}`} />
                    <figcaption>
                      <strong>Photo from apartment {current.unit_id}</strong>
                      {typeof assessment?.damage === "string" && <span>{assessment.damage}</span>}
                      {(typeof assessment?.severity === "number" || typeof assessment?.severity === "string") && <span>Severity: {String(assessment.severity)}</span>}
                      {assessment?.electrics === true && <span>Electrics near the water</span>}
                    </figcaption>
                  </figure>
                })()}
                {current && <>
                  <LiveIncident unit={current.unit_id} resolved={current.status === "resolved"} events={events} section={false}
                    onWaterStatus={water => confirmWater(current.id, water)} waterBusy={busy === `water:${current.id}`} disabled={Boolean(busy) || offline} />
                  {(downstairsConfirmed || flatsMessaged > 0 || released.length > 0) && (
                    <section className="incident-updates">
                      <h2>Case update</h2>
                      {downstairsConfirmed && <p>Apartment 2.1 confirmed a wet ceiling.</p>}
                      {flatsMessaged > 0 && <p>Messages queued for {flatsMessaged} {flatsMessaged === 1 ? "apartment" : "apartments"}.</p>}
                      {waterState === "off" && <p>The water is shut off.</p>}
                      {released.map(partnerId => {
                        const job = events.findLast(event => event.kind === "partner_job" && event.payload.partner_id === partnerId)
                        const withheld = job?.payload.withheld
                        return job && <JobContext key={partnerId} shared={sharedFields(job.payload.shared)} sent partner={partnerName(partnerId)}
                          withheld={Array.isArray(withheld) ? withheld.filter((key): key is string => typeof key === "string") : []} />
                      })}
                    </section>
                  )}
                  {current.status !== "resolved" && <LiveConnector caseId={current.id} events={events} connectors={state!.connectors} disabled={Boolean(busy) || offline} onChanged={refresh} />}
                  <LiveCaseActivity events={events} />
                </>}
              </div>
              <IncidentSection unitRisk={unit => current ? incidentRisks(current.unit_id, events).get(unit) ?? "" : ""}
                reportedUnit={current?.unit_id ?? "3.1"} riserActive={Boolean(current) && current?.status !== "resolved" && waterState !== "off"} showLegend={Boolean(current)} />
            </div>
          ) : (
            <div className="dashboard-grid building-detail-grid" key={selectedBuilding.id}>
              <BuildingSection building={selectedBuilding}>
                <div className="building-map">
                  <svg className="building" viewBox={`64 26 560 ${552 + (selectedBuilding.floors - 4) * 82}`}
                    role="img" aria-label={`${selectedBuilding.floors}-storey building section with two apartments on each floor`}>
                    <image href={`/mock/building-${selectedBuilding.id}.svg`} width="688" height={608 + (selectedBuilding.floors - 4) * 82} />
                  </svg>
                </div>
                <details className="building-disclosure">
                  <summary>Apartments</summary>
                  <ul className="building-apartment-links">{buildingUnits(selectedBuilding).map(unit => <li key={unit}>Apartment {unit}</li>)}</ul>
                </details>
              </BuildingSection>
              <div className="details"><section className="building-case"><h2>No open cases</h2><p>Nothing needs your attention in this building.</p></section></div>
            </div>
          )}
        </>
      )}
      <details className="demo-views">
        <summary>Demo views</summary>
        <div>
          <Link href="/tenant/3.1">Resident report</Link>
          {current && <Link href={`/track/${current.id}`}>Resident tracking</Link>}
          {current && released.map(partnerId => <Link key={partnerId} href={`/partner/${current.id}?partner=${encodeURIComponent(partnerId)}`}>{partnerName(partnerId)} job</Link>)}
          {cases.length > 0 && !confirmReset && <button className="building-reset" type="button" onClick={() => setConfirmReset(true)} disabled={Boolean(busy) || offline}>Reset demo</button>}
        </div>
        {confirmReset && <section className="reset-confirmation" aria-labelledby="reset-heading">
          <h2 id="reset-heading">Reset the demo?</h2>
          <p>This clears all cases and restarts the demo clock.</p>
          <div className="photo-actions">
            <button type="button" onClick={resetDemo} disabled={Boolean(busy) || offline}>Clear demo cases</button>
            <button type="button" className="secondary" onClick={() => setConfirmReset(false)} disabled={Boolean(busy)}>Cancel</button>
          </div>
        </section>}
      </details>
    </main>
  )
}
