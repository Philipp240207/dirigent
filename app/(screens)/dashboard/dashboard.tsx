"use client"

import { HomeLink } from "../home-link"
import Link from "next/link"
import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { buildings, buildingPortrait, buildingUnits, scenarioBuilding } from "../../../client/buildings"
import { advanceDemo, demoEnd, demoJob, demoReport, demoResult, demoSlot, emptyDemoSession, readDemo, readDemoSession, readExampleJobs, subscribeDemoSession, writeDemoSession } from "../../../client/state"

import { jobs, jobStatus } from "../partner/jobs"
import electric from "../../../fixtures/electrician-demo.json"
import { advanceElectrician, readElectrician, electricianDispatched, prepareElectricianReview, readReplayTime, saveReplayTime } from "../../../client/state"
import { JobContext } from "./job-context"
import { PortfolioMap, type MapState } from "./portfolio-map"

import { BuildingSection, IncidentSection, riskStyles } from "./building-section"

const statusLabels: Record<string, string> = {
  open: "Reported",
  pending_approval: "Awaiting approval",
  dispatched: "Job sent",
  scheduled: "Visit scheduled",
  resolved: "Repaired",
}
const recipients: Record<string, string> = {
  t41: "Apartment 4.1",
  t21: "Apartment 2.1",
  t11: "Apartment 1.1",
  caretaker: "Caretaker Peter Wolf",
  t31: "Apartment 3.1",
  owner: "Property owner",
}

type DemoEvent = ReturnType<typeof readDemo>[number]

const navPaths = {
  Portfolio: "M3 20V8l6-4 6 4v12M15 10h5v10H3m4-9h4m-4 4h4",
  Tasks: "M8 4h9v16H5V4h3m0 0v3h6V4m-6 9 2 2 4-5",
  Activity: "M2 13h4l3-8 4 14 3-8 2 2h4",
  Outbox: "M3 13l3-8h12l3 8v6H3zm0 0h5l1 3h6l1-3h5",
  Chevron: "m9 5 7 7-7 7",
}

function NavIcon({ name }: { name: keyof typeof navPaths }) {
  return <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={navPaths[name]} /></svg>
}

const overviewTitles = { tasks: "Tasks", portfolio: "Portfolio", activity: "Activity", outbox: "Outbox" }
const recentActivityLimit = 5
const exampleCases = jobs.filter((job) => job.example)
const euro = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" })
const manualCoordinationEstimate = 45
const costItems = [["voice_eur", "ElevenLabs voice"], ["phone_eur", "Phone calls"], ["openai_eur", "OpenAI"]] as const

const languageNames: Record<string, string> = { de: "German", en: "English", fr: "French" }

const demoStart = Date.parse("2026-11-20T13:40:00+01:00")
const clockOptions = { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" } as const
const retryClock = new Intl.DateTimeFormat("en-GB", clockOptions)
const eventClock = new Intl.DateTimeFormat("en-GB", { ...clockOptions, second: "2-digit" })

function DemoEventTime({ seconds }: { seconds: number }) {
  const timestamp = new Date(demoStart + seconds * 1000)
  return <time dateTime={timestamp.toISOString()} title="Berlin time">{eventClock.format(timestamp)}</time>
}

function activityEntry(event: DemoEvent) {
  const { payload } = event
  const recipient = recipients[payload.to_tenant_id ?? ""] ?? payload.to_tenant_id
  switch (event.kind) {
    case "case_created":
      return { title: payload.type === "water_leak" ? "Water leak reported" : "Move-in recorded", detail: `Apartment ${payload.unit_id}` }
    case "affected":
      return { title: payload.unit_id === "cellar" ? "Cellar" : `Apartment ${payload.unit_id}`, detail: riskStyles[payload.risk ?? ""]?.label }
    case "call_started":
      return { title: `Call started · ${recipient}`, detail: [payload.attempt && `Attempt ${payload.attempt}`, languageNames[payload.language ?? ""], payload.dry_run ? "Simulated call" : null].filter(Boolean).join(" · ") }
    case "call_ended":
      return { title: `${payload.outcome === "no_answer" ? "No answer" : "Call completed"} · ${recipient}`, detail: payload.summary }
    case "call_retry_scheduled": {
      const at = Date.parse(payload.at ?? "")
      const title = Number.isFinite(at) ? `Retry at ${retryClock.format(at)}` : "Retry scheduled"
      return { title: `${title} · ${recipient}`, detail: payload.attempt && `Attempt ${payload.attempt}` }
    }
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
  const [overview, setOverview] = useState<keyof typeof overviewTitles>("tasks")
  const [query, setQuery] = useState("")
  const [target, setTarget] = useState("")
  const [selectedId, setSelectedId] = useState(initialBuildingId)
  const selectedBuilding = buildings.find((building) => building.id === selectedId)
  const [elapsed, setElapsed] = useState(startFromReport ? 0 : -1)
  const [reviewingElectric, setReviewingElectric] = useState(false)
  const session = useSyncExternalStore(subscribeDemoSession, readDemoSession, emptyDemoSession)
  const examples = useSyncExternalStore(subscribeDemoSession, readExampleJobs, emptyDemoSession)
  const electrician = useSyncExternalStore(subscribeDemoSession, readElectrician, emptyDemoSession)
  const electricSent = electricianDispatched(electrician)
  const electricPending = electrician === "active"
  const approved = session !== ""
  const jobSent = elapsed >= demoJob.at_s || (approved && session !== "approved")
  const currentTime = session === "confirmed" ? Math.max(elapsed, demoSlot.at_s)
    : session === "reported" ? Math.max(elapsed, demoResult.at_s) : elapsed
  const [showFullActivity, setShowFullActivity] = useState(false)
  const leakReplay = readDemo(currentTime, approved)
  const leakEvents = leakReplay.filter((event) => event.case_id === demoReport.case_id)
  const events = leakReplay
  const plumberStatus = leakEvents.findLast((event) => event.kind === "status_change")?.payload.status ?? "open"
  const electricalDamage = leakEvents.some(event => event.kind === "photo" && event.payload.assessment?.electrics)
  const electricNeeded = electricalDamage && electrician !== "reported"
  const status = plumberStatus === "resolved" && electricNeeded
    ? electrician === "confirmed" ? "scheduled" : electricSent ? "dispatched" : "pending_approval"
    : plumberStatus
  const noticeRecipients = new Set(leakEvents.filter(event => event.kind === "message" && event.at_s < demoJob.at_s).map(event => event.payload.to))
  const flatsContacted = [...noticeRecipients].filter(id => id && recipients[id]?.startsWith("Apartment")).length
  const downstairsConfirmed = leakEvents.some(event => event.kind === "affected" && event.payload.unit_id === "2.1" && event.payload.risk === "confirmed")
  const riserActive = session !== "reported" && leakEvents.some((event) => event.kind === "affected")
  const proposal = leakEvents.findLast((event) => event.kind === "partner_job_proposed" && event.payload.partner_id === demoJob.payload.partner_id)
  const sentJob = leakEvents.findLast((event) => event.kind === "partner_job")
  const jobContext = (sentJob ?? proposal)?.payload
  const cost = leakEvents.findLast((event) => event.kind === "cost")?.payload
  const waiting = plumberStatus === "pending_approval" && !approved
  const reviewElectric = electricNeeded && !electricSent
  const pendingCount = Number(waiting) + Number(reviewElectric)
  const approvalTarget = "approval-panel"
  const electricFirst = reviewElectric && (reviewingElectric || (!waiting && (approved || electricPending)))
  const nextDecision = electricFirst ? "Review electrician job" : waiting ? "Approve plumber job" : reviewElectric ? "Review electrician job" : statusLabels[status]
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
  const outbox = events.filter((event) => event.kind === "message")

  useEffect(() => {
    const savedTime = readReplayTime()
    if (savedTime >= 0) setElapsed(previous => Math.max(previous, savedTime))
    else if (startFromReport) saveReplayTime(0)
  }, [startFromReport])

  useEffect(() => {
    if (!playing) return
    const timer = window.setTimeout(() => {
      const next = advanceDemo(currentTime, approved)
      saveReplayTime(next)
      setElapsed(next)
      if (session === "approved" && next >= demoJob.at_s) writeDemoSession("sent")
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [playing, currentTime, approved, session])

  useEffect(() => {
    if (!session && (electricPending || electricSent)) setElapsed(previous => Math.max(previous, 17))
    if (session) {
      setElapsed((previous) => Math.max(previous, session === "approved" ? demoJob.at_s - 1 : demoJob.at_s))
    }
  }, [session, electricPending, electricSent])

  useEffect(() => {
    if (!target) return
    const section = document.getElementById(target)
    section?.focus({ preventScroll: true })
    section?.scrollIntoView({ block: "start" })
    setTarget("")
  }, [target])

  function openOverview(view: keyof typeof overviewTitles) {
    setSelectedId("")
    setTarget("")
    setOverview(view)
    window.scrollTo(0, 0)
  }

  function openBuilding(id: string, section = "building-address") {
    setSelectedId(id)
    setTarget(section)
  }

  function reviewElectrician() {
    prepareElectricianReview()
    setReviewingElectric(true)
  }

  function startDemo() {
    saveReplayTime(0)
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
    const needsApproval = isScenario && pendingCount > 0
    const label = isScenario ? statusLabels[status]
      : exampleStatus === "Scheduled" ? "Appointment confirmed"
      : exampleStatus === "Completed" ? "Repaired"
      : exampleStatus === "New" ? "Open case" : "No open cases"
    const state: MapState = isScenario
      ? needsApproval ? "approval" : status === "resolved" ? "completed" : status === "scheduled" ? "scheduled" : "attention"
      : exampleStatus === "Completed" ? "completed"
      : exampleStatus === "Scheduled" ? "scheduled"
      : exampleStatus === "New" ? "attention" : "clear"
    return { building, status: label, state, needsApproval }
  }), [query, session, examples, scenarioStarted, pendingCount, status])
  const apartmentCount = buildings.reduce((count, building) => count + buildingUnits(building).length, 0)

  function unitRisk(unit: string) {
    const last = leakEvents.findLast(event => event.kind === "affected" && event.payload.unit_id === unit)
    if (!last) return ""
    if (session === "reported") return unit === "3.1" && electricNeeded ? "check" : "clear"
    return last.payload.risk ?? ""
  }

  if (process.env.NEXT_PUBLIC_MOCK !== "true") {
    return <main><h1>Dirigent</h1><p>Set NEXT_PUBLIC_MOCK=true to open the local demo.</p></main>
  }

  return (
    <main className="management-dashboard">
      <header className="topbar management-topbar">
        <div className="management-brand"><HomeLink onNavigate={() => {
          setSelectedId("")
          setOverview("tasks")
          setQuery("")
          setTarget("")
          window.scrollTo(0, 0)
        }} /><span>Property management</span></div>
        <nav className="management-nav" aria-label="Property management">
          <button type="button" aria-pressed={overview === "portfolio" && !selectedBuilding} onClick={() => openOverview("portfolio")}><NavIcon name="Portfolio" />Portfolio</button>
          <button type="button" aria-pressed={overview === "tasks" && !selectedBuilding} onClick={() => openOverview("tasks")}><NavIcon name="Tasks" />Tasks <span>{pendingCount}</span></button>
        </nav>
        <div className="management-utilities">
          <button type="button" aria-pressed={overview === "activity" && !selectedBuilding} onClick={() => openOverview("activity")}><NavIcon name="Activity" />Activity</button>
          <button type="button" aria-pressed={overview === "outbox" && !selectedBuilding} onClick={() => openOverview("outbox")}><NavIcon name="Outbox" />Outbox</button>

        </div>
      </header>
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
                {waiting && <span className="task-priority">Urgent</span>}
                <h2 id="task-heading">{elapsed < 0 ? "Water damage demo" : "Water damage reported"}</h2>
                <p>{scenarioBuilding.address} · Apartment {demoReport.payload.unit_id}</p>
              </div>
              <div className="task-decision">
                <p>{pendingCount ? "Next decision" : "Case status"}</p>
                <h3>{elapsed < 0 ? "Ready to start" : nextDecision}</h3>
                <button type="button" onClick={elapsed < 0 ? startDemo : () => openBuilding(scenarioBuilding.id, pendingCount ? approvalTarget : "building-address")}>
                  {electricFirst ? "Review electrician job" : waiting ? "Review plumber job" : reviewElectric ? "Review electrician job" : elapsed < 0 ? "Start demo" : "View case"}
                </button>
              </div>
            </section>
          )}
          {overview === "portfolio" && (
            <section className="management-portfolio" aria-label="Buildings">
              <div className="portfolio-toolbar">
                <input type="search" aria-label="Search buildings" placeholder="Search buildings" value={query} onChange={(event) => setQuery(event.target.value)} />
              </div>
              <div className="portfolio-layout">
                <ul className="property-register" aria-label="Building list">
                  {filteredBuildings.map(({ building, status: label, state, needsApproval }) => (
                    <li key={building.id}>
                      <button className="property-row" type="button"
                        onClick={() => openBuilding(building.id, needsApproval ? approvalTarget : "building-address")}>
                        <img src={buildingPortrait(building)} alt="" />
                        <span className="property-data">
                          <strong>{building.address}</strong>
                          <small>{building.city} · {buildingUnits(building).length} apartments</small>
                          <span className="case-status" data-status={needsApproval ? "pending_approval" : state === "completed" ? "resolved" : state === "clear" ? "idle" : "open"}>{label}</span>
                        </span>
                        <span className="row-action"><span>{needsApproval ? "Review job" : state === "scheduled" ? "View appointment" : "View building"}</span> <NavIcon name="Chevron" /></span>
                      </button>
                    </li>
                  ))}
                  {!filteredBuildings.length && <li className="job-empty">No buildings match your search.</li>}
                </ul>
                <PortfolioMap locations={filteredBuildings} onSelect={openBuilding} />
              </div>
            </section>
          )}
          {overview === "activity" && (
            <section className="workspace-feed" aria-label="Event history">
              {scenarioStarted && status !== "resolved" && (
                <button className="activity-property" onClick={() => openBuilding(scenarioBuilding.id)}>
                  <img src={buildingPortrait(scenarioBuilding)} alt="" width="44" height="48" />
                  {scenarioBuilding.address}<NavIcon name="Chevron" />
                </button>
              )}
              {activity.length ? (
                <ol id="activity-timeline" className="activity-timeline" aria-label="Latest activity first">
                  {visibleActivity.map(({ id, at, title, detail }) => (
                    <li key={id}>
                      <DemoEventTime seconds={at} />
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
            </section>
          )}
          {overview === "outbox" && (
            <section className="workspace-feed" aria-label="Outgoing messages">
              {outbox.length ? (
                <ul className="outbox-list">
                  {[...outbox].reverse().map(({ id, at_s: at, payload }) => {
                    const recipient = recipients[payload.to ?? ""] ?? payload.to
                    return (
                      <li key={id}>
                        <div className="outbox-heading">
                          <strong>{recipient}</strong>
                          <DemoEventTime seconds={at} />
                        </div>
                        <p className="outbox-body">{payload.text}</p>
                      </li>
                    )
                  })}
                </ul>
              ) : <p>No messages yet.</p>}
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
                <section className="case-summary incident-decision" data-status={pendingCount ? "pending_approval" : status}
                  id="approval-panel" tabIndex={-1} aria-labelledby="case-summary-heading">
                  <h2 id="case-summary-heading">{scenarioStarted ? "Water damage in apartment 3.1" : "No active case"}</h2>
                  {!scenarioStarted ? <button className="case-action" onClick={startDemo}>Start demo</button> : <>
                    {waiting || electricFirst ? (
                      <>
                        <h3>{electricFirst ? "Check the ceiling lamp and wiring" : "Find and repair the leak"}</h3>
                        <p><strong>{electricFirst ? "Elektro Schmitz" : "Sanitär Krause"}</strong> · Cost estimate pending</p>
                        <p>{electricFirst ? "Water was found next to the living-room lamp in apartment 3.1."
                          : "Inspect riser A, both affected ceilings, apartment 1.1 and the cellar."}</p>
                        {electricFirst ? (
                          electricPending
                            ? <button className="case-action" onClick={() => advanceElectrician("sent")}>Approve electrician job</button>
                            : <button className="case-action" onClick={reviewElectrician}>Review electrician job</button>
                        ) : <button className="case-action" onClick={() => writeDemoSession("approved")}>Approve and send</button>}
                        {electricFirst
                          ? <JobContext shared={electric.proposal.shared} withheld={electric.proposal.withheld} sent={false} partner="Elektro Schmitz" />
                          : jobContext && <JobContext shared={jobContext.shared ?? {}} withheld={jobContext.withheld ?? []} sent={false} />}
                        {waiting && reviewElectric && <p className="incident-followup">{electricFirst ? "Also needs your decision: plumber repair." : "Also needs your decision: electrical inspection."}</p>}
                      </>
                    ) : !approved && reviewElectric ? (
                      <>
                        <h3>Electrical inspection needed</h3><p>Water was found near the ceiling lamp. Dirigent is also preparing the plumber’s job.</p>
                        <button className="case-action" onClick={reviewElectrician}>Review electrician job</button>
                      </>
                    ) : !approved ? (
                      <><h3>Checking the damage</h3><p>Dirigent is contacting residents and preparing the plumber’s job for your review.</p></>
                    ) : <>
                      <h3>{session === "approved" ? "Sending the plumber’s job" : session === "sent" ? "Waiting for Sanitär Krause"
                        : session === "confirmed" ? "Plumber visit confirmed" : electricNeeded ? "Leak fixed. Electrical check pending." : "Repairs complete"}</h3>
                      <p>{session === "approved" ? "Your approval is recorded." : session === "sent" ? "Sanitär Krause will confirm an appointment."
                        : session === "confirmed" ? `Sanitär Krause will visit at ${demoSlot.payload.slot}.` : demoResult.payload.work_description}</p>
                    </>}
                    {electricFirst && approved && <p className="incident-followup">{session === "reported" ? "Sanitär Krause has repaired the leak." : session === "confirmed" ? `Plumber visit confirmed for ${demoSlot.payload.slot}.` : "The plumber’s job is approved."}</p>}
                    {electricSent && <p className="incident-followup">{electrician === "reported" ? "Elektro Schmitz has completed the electrical inspection."
                      : electrician === "confirmed" ? `Elektro Schmitz will visit at ${electric.slot}.` : "Waiting for Elektro Schmitz to confirm an appointment."}</p>}
                  </>}
                </section>
                {scenarioStarted && (noticeRecipients.size > 0 || jobSent) && (
                  <section className="incident-updates">
                    <h2>Case update</h2>
                    {downstairsConfirmed && <p>Apartment 2.1 confirmed a wet ceiling.</p>}
                    {flatsContacted > 0 && <p>Messages queued for {flatsContacted} {flatsContacted === 1 ? "apartment" : "apartments"}.</p>}
                    {noticeRecipients.has("caretaker") && <p>The caretaker was asked to shut off riser A.</p>}
                    {jobSent && jobContext && <JobContext shared={jobContext.shared ?? {}} withheld={jobContext.withheld ?? []} sent />}
                    {electricSent && <JobContext shared={electric.proposal.shared} withheld={electric.proposal.withheld} sent partner="Elektro Schmitz" />}
                  </section>
                )}
                {cost?.total_eur != null && (
                  <details className="building-disclosure case-costs">
                    <summary>Coordination costs<span>{euro.format(cost.total_eur)}</span></summary>
                    <div className="building-disclosure-content">
                      <dl>
                        {costItems.map(([key, label]) => {
                          const amount = cost.breakdown?.[key]
                          return amount == null ? null : (
                            <div key={key}><dt>{label}</dt><dd>{euro.format(amount)}</dd></div>
                          )
                        })}
                        <div className="case-costs-estimate">
                          <dt>Manual coordination estimate</dt>
                          <dd>{euro.format(manualCoordinationEstimate)}</dd>
                        </div>
                      </dl>
                      <p>Demo figures. The manual estimate assumes 45 minutes at €60/hour. Repair charges are separate.</p>
                    </div>
                  </details>
                )}
              </div>
              <IncidentSection unitRisk={unitRisk} reportedUnit="3.1" riserActive={riserActive} showLegend={elapsed >= 0} />
            </div>
          ) : (
            <div className="dashboard-grid building-detail-grid" key={selectedBuilding.id}>
              <BuildingSection building={selectedBuilding}>
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
                      <li key={unit}>Apartment {unit} <small>{exampleCases.find(job => job.building.id === selectedBuilding.id && job.apartment === unit)?.title}</small></li>
                    ))}
                  </ul>
                </details>
              </BuildingSection>
              <div className="details">
                {exampleCases.filter((job) => job.building.id === selectedBuilding.id).map((job) => (
                  <section className="building-case" key={job.id}>
                    <h2>{job.title}</h2>
                    <p>Apartment {job.apartment} · {jobStatus(job, session, examples)}</p>
                    <p>{job.scope}</p>
                  </section>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      <details className="demo-views">
        <summary>Demo views</summary>
        <div><Link href="/tenant/3.1">Resident report</Link><Link href="/partner">Plumber jobs</Link>
          {scenarioStarted && <Link href="/track/c1">Resident tracking</Link>}
          {electricSent && <Link href="/partner/c1?partner=electrician_schmitz">Electrician job</Link>}
          {elapsed >= 0 && (
              <button className="building-reset" type="button" onClick={() => {
                setReviewingElectric(false)
                setElapsed(-1)
                writeDemoSession("")
                setShowFullActivity(false)
              }}>Reset demo</button>
            )}
        </div>
      </details>
    </main>
  )
}
