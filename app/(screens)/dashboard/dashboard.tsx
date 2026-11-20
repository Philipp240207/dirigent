"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { buildings, buildingUnits, scenarioBuilding } from "../../../client/buildings"
import { advanceDemo, demoConnectorActivation, demoConnectorDraft, demoConnectorEnd, demoEnd, demoJob, demoMoveIn, demoReport, demoResult, demoSlot, emptyDemoSession, readConnectorDemo, readDemo, readDemoSession, readExampleJobs, subscribeDemoSession, writeDemoSession } from "../../../client/state"

import { jobs, jobStatus } from "../partner/jobs"
import { ConnectorDemo } from "./connector-demo"
import { PortfolioMap, type MapState } from "./portfolio-map"

const rooms: Record<string, { x: number; y: number; width: number }> = {
  "3.1": { x: 88.5, y: 220.5, width: 216 },
  "2.1": { x: 88.5, y: 302.5, width: 216 },
  "1.1": { x: 88.5, y: 384.5, width: 216 },
  cellar: { x: 88.5, y: 466.5, width: 511 },
}
const statusLabels: Record<string, string> = {
  open: "Reported",
  pending_approval: "Awaiting approval",
  dispatched: "Job sent",
  scheduled: "Visit scheduled",
  resolved: "Repaired",
}
const recipients: Record<string, string> = {
  t11: "Apartment 1.1",
  t21: "Apartment 2.1",
  t31: "Apartment 3.1",
  t42n: "Lucas Laurent",
  owner: "Property owner",
}

type DemoEvent = ReturnType<typeof readDemo>[number]

const recentActivityLimit = 5
const exampleCases = jobs.filter((job) => job.example)

const languageNames: Record<string, string> = { de: "German", en: "English", fr: "French" }

function demoTime(seconds: number) {
  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0")
  return `+${minutes}:${String(seconds % 60).padStart(2, "0")}`
}

function activityEntry(event: DemoEvent) {
  const { payload } = event
  const recipient = recipients[payload.to_tenant_id ?? ""] ?? payload.to_tenant_id
  switch (event.kind) {
    case "case_created":
      return { title: payload.type === "water_leak" ? "Water leak reported" : "Move-in recorded", detail: `Apartment ${payload.unit_id}` }
    case "affected":
      if (payload.unit_id === demoReport.payload.unit_id) return { title: "Leak source identified", detail: `Apartment ${payload.unit_id}` }
      if (payload.risk === "check") return { title: "Cellar marked for inspection" }
      return { title: `Apartment ${payload.unit_id} flagged`, detail: payload.risk === "high" ? "High risk" : "Low risk" }
    case "call_started":
      return { title: `Call started · ${recipient}`, detail: [languageNames[payload.language ?? ""], payload.dry_run ? "Simulated call" : null].filter(Boolean).join(" · ") }
    case "call_ended":
      return { title: `Call completed · ${recipient}`, detail: payload.summary }
    case "message":
      return { title: `Message queued · ${recipients[payload.to ?? ""] ?? payload.to}` }
    case "photo":
      return { title: "Damage photo assessed", detail: payload.assessment?.damage }
    case "partner_job_proposed":
      return { title: "Plumber job ready for review" }
    case "partner_job_approved":
      return { title: "Job approved by property manager" }
    case "partner_job":
      return { title: "Job sent to Sanitär Krause" }
    case "connector_drafted":
      return { title: "RheinNet connector drafted" }
    case "connector_activated":
      return { title: "RheinNet connector activated" }
    case "order":
      return { title: "RheinNet order prepared" }
    case "slot_confirmed":
      return { title: "Appointment confirmed", detail: payload.slot }
    case "maintenance_log":
      return { title: "Repair logged", detail: payload.work_description }
    case "reasoning":
      return { title: "Dirigent assessment", detail: payload.text }
    default:
      return null
  }
}

export function Dashboard({ startFromReport, initialBuildingId }: { startFromReport: boolean; initialBuildingId: string }) {
  const [overview, setOverview] = useState<"tasks" | "portfolio">("tasks")
  const [query, setQuery] = useState("")
  const [target, setTarget] = useState("")
  const [selectedId, setSelectedId] = useState(initialBuildingId)
  const selectedBuilding = buildings.find((building) => building.id === selectedId)
  const [elapsed, setElapsed] = useState(startFromReport ? 0 : -1)
  const [connectorTime, setConnectorTime] = useState(-1)
  const [connectorText, setConnectorText] = useState("")
  const session = useSyncExternalStore(subscribeDemoSession, readDemoSession, emptyDemoSession)
  const examples = useSyncExternalStore(subscribeDemoSession, readExampleJobs, emptyDemoSession)
  const approved = session !== ""
  const jobSent = elapsed >= demoJob.at_s || (approved && session !== "approved")
  const currentTime = session === "confirmed" ? Math.max(elapsed, demoSlot.at_s)
    : session === "reported" ? Math.max(elapsed, demoResult.at_s) : elapsed
  const [showFullActivity, setShowFullActivity] = useState(false)
  const leakReplay = readDemo(currentTime, approved)
  const leakEvents = leakReplay.filter((event) => event.case_id === demoReport.case_id)
  const events = [...leakReplay, ...readConnectorDemo(connectorTime)]
    .sort((a, b) => a.at_s - b.at_s)
  const connectorPlaying = connectorTime >= demoMoveIn.at_s && connectorTime < demoConnectorEnd
  const status = leakEvents.findLast((event) => event.kind === "status_change")?.payload.status ?? "open"
  const riserActive = status !== "resolved" && leakEvents.some((event) => event.kind === "affected")
  const proposal = leakEvents.find((event) => event.kind === "partner_job_proposed")
  const waiting = status === "pending_approval" && !approved
  const waitingForPartner =
    (session === "sent" && currentTime >= demoSlot.at_s - 1) ||
    (session === "confirmed" && currentTime >= demoResult.at_s - 1)
  const playing = elapsed >= 0 && currentTime < demoEnd && !waiting && !waitingForPartner
  const activity = events.flatMap((event) => {
    const entry = activityEntry(event)
    return entry ? [{ ...entry, id: event.id, at: event.at_s }] : []
  }).reverse()
  const visibleActivity = showFullActivity ? activity : activity.slice(0, recentActivityLimit)
  const olderActivityCount = Math.max(0, activity.length - recentActivityLimit)
  const outbox = events.filter((event) => event.kind === "message" || event.kind === "order")

  useEffect(() => {
    if (!playing) return
    const timer = window.setTimeout(() => {
      const next = advanceDemo(currentTime, approved)
      setElapsed(next)
      if (session === "approved" && next >= demoJob.at_s) writeDemoSession("sent")
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [playing, currentTime, approved, session])

  useEffect(() => {
    if (session) {
      setElapsed((previous) => Math.max(previous, session === "approved" ? demoJob.at_s - 1 : demoJob.at_s))
    }
  }, [session])

  useEffect(() => {
    if (!connectorPlaying) return
    const timer = window.setTimeout(() => setConnectorTime(connectorTime + 1), 1000)
    return () => window.clearTimeout(timer)
  }, [connectorPlaying, connectorTime])

  useEffect(() => {
    if (!target) return
    const section = document.getElementById(target)
    if (section instanceof HTMLDetailsElement) {
      section.open = true
      section.querySelector("summary")?.focus({ preventScroll: true })
    } else {
      section?.focus({ preventScroll: true })
    }
    section?.scrollIntoView({ block: "start" })
    setTarget("")
  }, [target])

  function openBuilding(id: string, section = "building-address") {
    setSelectedId(id)
    setTarget(section)
  }

  function startDemo() {
    setElapsed(0)
    openBuilding(scenarioBuilding.id)
  }

  const scenarioStarted = elapsed >= 0
  const filteredBuildings = useMemo(() => buildings.filter(({ address, city }) =>
    `${address} ${city}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  ).map((building) => {
    const example = exampleCases.find((job) => job.building.id === building.id)
    const exampleStatus = example && jobStatus(example, session, examples)
    const isScenario = building.id === scenarioBuilding.id && scenarioStarted
    const needsApproval = isScenario && waiting
    const label = isScenario ? statusLabels[status]
      : exampleStatus === "Scheduled" ? "Appointment confirmed"
      : exampleStatus === "Completed" ? "Repaired"
      : exampleStatus === "New" ? "Open case" : "No open cases"
    const state: MapState = isScenario
      ? status === "resolved" ? "completed" : status === "scheduled" ? "scheduled" : "attention"
      : exampleStatus === "Completed" ? "completed"
      : exampleStatus === "Scheduled" ? "scheduled"
      : exampleStatus === "New" ? "attention" : "clear"
    return { building, status: label, state, needsApproval }
  }), [query, session, examples, scenarioStarted, waiting, status])
  const apartmentCount = buildings.reduce((count, building) => count + buildingUnits(building).length, 0)

  if (process.env.NEXT_PUBLIC_MOCK !== "true") {
    return <main><h1>Dirigent</h1><p>Set NEXT_PUBLIC_MOCK=true to open the local demo.</p></main>
  }

  return (
    <main className="management-dashboard">
      <header className="topbar management-topbar">
        <strong className="wordmark"><span className="wordmark-icon" aria-hidden="true" />Dirigent</strong>
        <nav className="management-nav" aria-label="Dashboard">
          <button type="button" aria-pressed={overview === "portfolio" && !selectedBuilding} onClick={() => { setSelectedId(""); setOverview("portfolio") }}>Portfolio</button>
          <button type="button" aria-pressed={overview === "tasks" && !selectedBuilding} onClick={() => { setSelectedId(""); setOverview("tasks") }}>Tasks <span>{waiting ? 1 : 0}</span></button>
        </nav>
        <div className="management-utilities">
          <button type="button" onClick={() => openBuilding(scenarioBuilding.id, "activity-panel")}>Activity</button>
          <button type="button" onClick={() => openBuilding(scenarioBuilding.id, "outbox-panel")}>Outbox</button>
          <button type="button" onClick={() => openBuilding(scenarioBuilding.id, "connector-panel")}>Connectors</button>
          <Link className="nav-link" href="/partner">Partner jobs</Link>
        </div>
      </header>
      {!selectedBuilding ? (
        <>
          <div className="heading management-heading">
            <div>
              <h1>{overview === "tasks" ? "Tasks" : "Property portfolio"}</h1>
              {overview === "tasks" && <p>{waiting ? "1 task needs your decision" : "No tasks need a decision"}</p>}
            </div>
          </div>
          {overview === "tasks" && (
            <section className="task-hero" aria-labelledby="task-heading">
              <div>
                {waiting && <span className="task-priority">Urgent</span>}
                <h2 id="task-heading">{elapsed < 0 ? "Water damage demo" : "Water damage reported"}</h2>
                <p>{scenarioBuilding.address} · Apartment {demoReport.payload.unit_id}</p>
              </div>
              <div className="task-decision">
                <p>{waiting ? "Next decision" : "Case status"}</p>
                <h3>{waiting ? "Approve plumber job" : elapsed < 0 ? "Ready to start" : statusLabels[status]}</h3>
                <button type="button" onClick={elapsed < 0 ? startDemo : () => openBuilding(scenarioBuilding.id, waiting ? "approval-panel" : "building-address")}>
                  {waiting ? "Review plumber job" : elapsed < 0 ? "Start demo" : "View case"}
                </button>
              </div>
            </section>
          )}
          <section className="management-portfolio" aria-labelledby="portfolio-heading">
            <div className="portfolio-toolbar">
              <div><h2 id="portfolio-heading">All buildings</h2><p>{buildings.length} buildings · {apartmentCount} apartments</p></div>
              <input type="search" aria-label="Search buildings" placeholder="Search buildings" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <div className="portfolio-layout">
              <div className="portfolio-table-wrap" tabIndex={0} role="region" aria-labelledby="portfolio-heading">
                <table className="portfolio-table">
                  <thead><tr><th scope="col">Building</th><th scope="col">Apartments</th><th scope="col">Case status</th><th scope="col">Next step</th></tr></thead>
                  <tbody>
                    {filteredBuildings.map(({ building, status: label, state, needsApproval }) => (
                        <tr key={building.id} data-priority={needsApproval}>
                          <th scope="row">
                            <button className="table-building" type="button" onClick={() => openBuilding(building.id)}>
                              <img src={`/mock/portfolio/${building.id}.png`} width="42" height="42" alt="" />
                              <span>{building.address}<small>{building.city}</small></span>
                            </button>
                          </th>
                          <td>{buildingUnits(building).length}</td>
                          <td><span className="case-status" data-status={needsApproval ? "pending_approval" : state === "completed" ? "resolved" : state === "clear" ? "idle" : "open"}>{label}</span></td>
                          <td>
                            <button className="table-next" type="button" onClick={() => openBuilding(building.id, needsApproval ? "approval-panel" : "building-address")}>
                              {needsApproval ? "Approve plumber job" : state === "scheduled" ? "View appointment" : "View building"}
                            </button>
                          </td>
                        </tr>
                    ))}
                    {!filteredBuildings.length && <tr><td colSpan={4}>No buildings match your search.</td></tr>}
                  </tbody>
                </table>
              </div>
              <PortfolioMap locations={filteredBuildings} onSelect={openBuilding} />
            </div>
          </section>
        </>
      ) : (
        <>
          <button className="portfolio-back" type="button" onClick={() => setSelectedId("")}>All buildings</button>
          <div className="heading building-heading">
            <div>
              <h1 id="building-address" tabIndex={-1}>{selectedBuilding.address}</h1>
              <p>{selectedBuilding.city} · {buildingUnits(selectedBuilding).length} apartments</p>
            </div>
            {selectedBuilding.id === scenarioBuilding.id && (elapsed >= 0 || connectorTime >= 0) && (
              <button className="building-reset" type="button" onClick={() => {
                setElapsed(-1)
                setConnectorTime(-1)
                setConnectorText("")
                writeDemoSession("")
                setShowFullActivity(false)
              }}>Reset demo</button>
            )}
          </div>
          {selectedBuilding.id === scenarioBuilding.id ? (
            <div className="dashboard-grid building-detail-grid" key={selectedBuilding.id}>
              <section className="building-card" aria-labelledby="building-title">
                <div className="card-heading">
                  <div><h2 id="building-title">Building section</h2><p>{buildingUnits(selectedBuilding).length} apartments · 2 water risers</p></div>
                </div>
                <div className="building-map" data-riser-active={riserActive}>
                  <svg className="building" viewBox="64 26 560 552" role="img" aria-label={riserActive ? "Four floors and two water risers. Water leak on riser A." : "Four floors and two water risers."}>
                    <image href="/mock/dirigent-building.svg" width="688" height="608" />
                    {leakEvents.filter((event) => event.kind === "affected").map((event) => {
                      const unit = event.payload.unit_id ?? ""
                      const room = rooms[unit]
                      if (!room) return null
                      const color = status === "resolved" ? "#34C759"
                        : unit === "3.1" ? "#FF3B30" : event.payload.risk === "high" ? "#FF9500" : "#FFCC00"
                      return <rect key={event.id} {...room} height={unit === "cellar" ? 81 : 73} rx="2" fill={color} fillOpacity=".26" stroke={color} strokeWidth="2.5" />
                    })}
                    {riserActive && (
                      <g className="active-riser" aria-hidden="true">
                        <path d="M111 263v245" />
                        <circle cx="111" cy="263" r="6" />
                      </g>
                    )}
                  </svg>
                </div>
                {elapsed >= 0 && <ul className="building-legend" aria-label="Building status legend">
                  <li><span className="legend-source" />Leak source</li>
                  <li><span className="legend-high" />High risk</li>
                  <li><span className="legend-low" />Low risk or check</li>
                  <li><span className="legend-resolved" />Repaired</li>
                </ul>}
                <details className="building-disclosure">
                  <summary>Apartments</summary>
                  <ul className="building-apartment-links">
                    {buildingUnits(selectedBuilding).map((unit) => (
                      <li key={unit}><Link href={`/tenant/${unit}?building=${selectedBuilding.id}`}>Apartment {unit}</Link></li>
                    ))}
                  </ul>
                </details>
              </section>
              <div className="details">
                <section className="case-summary" data-status={elapsed < 0 ? "idle" : status}
                  id="approval-panel" tabIndex={-1} aria-labelledby="case-summary-heading">
                  <h2 id="case-summary-heading">{elapsed < 0 ? "No active case" : "Water damage · Apartment 3.1"}</h2>
                  {elapsed < 0 ? (
                    <button className="case-action" type="button" onClick={startDemo}>Start demo</button>
                  ) : (
                    <>
                      <p role="status" className="case-status" data-status={status}>{statusLabels[status]}</p>
                      {proposal && status === "pending_approval" && (
                        <>
                          <p className="approval-partner"><strong>Sanitär Krause</strong></p>
                          <p className="approval-scope">{proposal.payload.briefing}</p>
                          <details className="approval-fields">
                            <summary>Information to share</summary>
                            <dl>
                              {Object.entries(proposal.payload.shared ?? {}).map(([field, value]) => (
                                <div key={field}><dt>{field.replaceAll("_", " ")}</dt><dd>{Array.isArray(value) ? value.join(", ") : String(value)}</dd></div>
                              ))}
                            </dl>
                          </details>
                          <button className="case-action" type="button" disabled={approved} onClick={() => writeDemoSession("approved")}>
                            {approved ? "Sending job…" : "Approve and send"}
                          </button>
                        </>
                      )}
                      {!proposal && <p>Dirigent is assessing the damage and preparing the job.</p>}
                      {jobSent && status !== "pending_approval" && (
                        <>
                          <p>{session === "reported" ? demoResult.payload.work_description
                            : session === "confirmed" ? `Appointment at ${demoSlot.payload.slot} with Sanitär Krause.`
                            : "Waiting for Sanitär Krause to confirm an appointment."}</p>
                        </>
                      )}
                      <div className="repair-links">
                        <Link className="action-link" href={`/track/${demoReport.case_id}`}>Resident tracking</Link>
                        {jobSent && status !== "pending_approval" && <Link className="action-link" href="/partner">Open partner view</Link>}
                      </div>
                    </>
                  )}
                </section>
                <details className="building-disclosure" id="activity-panel">
                  <summary>Activity{activity.length > 0 && <span>{activity.length}</span>}</summary>
                  <div className="building-disclosure-content">
                    {activity.length ? (
                      <ol id="activity-timeline" className="activity-timeline" aria-label="Latest activity first">
                        {visibleActivity.map(({ id, at, title, detail }) => (
                          <li key={id}>
                            <time dateTime={`PT${at}S`} aria-label={`${at} seconds into the demo`}>{demoTime(at)}</time>
                            <div className="activity-entry">
                              <strong>{title}</strong>
                              {detail && <p>{detail}</p>}
                            </div>
                          </li>
                        ))}
                      </ol>
                    ) : <p>Start the demo to follow the incident.</p>}
                    {olderActivityCount > 0 && (
                      <button
                        type="button"
                        className="activity-toggle"
                        aria-expanded={showFullActivity}
                        aria-controls="activity-timeline"
                        onClick={() => setShowFullActivity((expanded) => !expanded)}
                      >
                        {showFullActivity ? "Show latest 5" : `Show full history (${activity.length})`}
                      </button>
                    )}
                  </div>
                </details>
                <details className="building-disclosure" id="outbox-panel">
                  <summary>Outbox{outbox.length > 0 && <span>{outbox.length}</span>}</summary>
                  <div className="building-disclosure-content">
                    {outbox.length ? (
                      <ul className="outbox-list">
                        {[...outbox].reverse().map(({ id, at_s: at, kind, payload }) => {
                          const order = kind === "order"
                          const recipient = order
                            ? payload.partner_id === "isp_rheinnet" ? "RheinNet Glasfaser" : payload.partner_id
                            : recipients[payload.to ?? ""] ?? payload.to
                          return (
                            <li key={id}>
                              <details>
                                <summary>
                                  <span className="outbox-heading">
                                    <strong>{recipient}</strong>
                                    <time dateTime={`PT${at}S`} aria-label={`${at} seconds into the demo`}>{demoTime(at)}</time>
                                  </span>
                                  <span className="outbox-preview">{order ? "Service order" : payload.text}</span>
                                </summary>
                                {order ? (
                                  <dl>
                                    {Object.entries(payload.fields ?? {}).map(([field, value]) => (
                                      <div key={field}><dt>{field.replaceAll("_", " ")}</dt><dd>{String(value)}</dd></div>
                                    ))}
                                  </dl>
                                ) : <p className="outbox-body">{payload.text}</p>}
                              </details>
                            </li>
                          )
                        })}
                      </ul>
                    ) : <p>No messages yet.</p>}
                  </div>
                </details>
                <ConnectorDemo elapsed={connectorTime} text={connectorText} onTextChange={setConnectorText}
                  onDraft={() => setConnectorTime(demoConnectorDraft.at_s)}
                  onActivate={() => setConnectorTime(demoConnectorActivation.at_s)}
                  onMoveIn={() => setConnectorTime(demoMoveIn.at_s)}
                  onOutbox={() => openBuilding(scenarioBuilding.id, "outbox-panel")} />
              </div>
            </div>
          ) : (
            <div className="dashboard-grid building-detail-grid" key={selectedBuilding.id}>
              <section className="building-card" aria-labelledby="building-title">
                <div className="card-heading">
                  <div><h2 id="building-title">Building section</h2><p>{selectedBuilding.floors} floors · {buildingUnits(selectedBuilding).length} apartments</p></div>
                </div>
                <div className="building-map">
                  <svg className="building" viewBox={`64 26 560 ${552 + (selectedBuilding.floors - 4) * 82}`}
                    role="img" aria-label={`${selectedBuilding.floors}-storey building section with two apartments on each floor`}>
                    <image href={`/mock/building-${selectedBuilding.id}.svg`} width="688" height={608 + (selectedBuilding.floors - 4) * 82} />
                    {exampleCases.filter((job) => job.building.id === selectedBuilding.id).map((job) => {
                      const [floor, side] = job.apartment.split(".").map(Number)
                      const phase = jobStatus(job, session, examples)
                      const color = phase === "Completed" ? "#34C759" : phase === "Scheduled" ? "#245be3" : "#FF9500"
                      return <rect key={job.id} x={side === 1 ? 88.5 : 383.5}
                        y={138.5 + (selectedBuilding.floors - floor) * 82} width="216" height="73" rx="2"
                        fill={color} fillOpacity=".24" stroke={color} strokeWidth="2.5" />
                    })}
                  </svg>
                </div>
                <details className="building-disclosure">
                  <summary>Apartments</summary>
                  <ul className="building-apartment-links">
                    {buildingUnits(selectedBuilding).map((unit) => (
                      <li key={unit}><Link href={`/tenant/${unit}?building=${selectedBuilding.id}`}>Apartment {unit}</Link></li>
                    ))}
                  </ul>
                </details>
              </section>
              <div className="details">
                {exampleCases.filter((job) => job.building.id === selectedBuilding.id).map((job) => (
                  <section className="building-case" key={job.id}>
                    <h2>{job.title}</h2>
                    <p>Apartment {job.apartment} · {jobStatus(job, session, examples)}</p>
                    <Link className="action-link" href={`/partner/${job.id}`}>View job</Link>
                  </section>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  )
}
