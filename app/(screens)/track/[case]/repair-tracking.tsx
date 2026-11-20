"use client"

import Link from "next/link"
import { HomeLink } from "../../home-link"
import { useSyncExternalStore } from "react"
import electric from "../../../../fixtures/electrician-demo.json"
import { scenarioBuilding } from "../../../../client/buildings"
import { readElectrician, hasResidentReport, demoReport, demoSlot, emptyDemoSession, readDemoSession, subscribeDemoSession } from "../../../../client/state"

const plumberSteps = [
  "Report received",
  "Plumber contacted",
  "Appointment confirmed",
  "Repair complete",
]

const statusBySession: Record<string, number> = { sent: 1, confirmed: 2, reported: 3 }
const statusDetails = [
  "Your property manager is reviewing the water leak.",
  "We’re waiting for the plumber to confirm a time.",
  `Sanitär Krause will visit at ${demoSlot.payload.slot}.`,
  "The plumber has confirmed that the leak is fixed.",
]

export function RepairTracking() {
  const session = useSyncExternalStore(subscribeDemoSession, readDemoSession, emptyDemoSession)
  const electrician = useSyncExternalStore(subscribeDemoSession, readElectrician, emptyDemoSession)
  const hasReport = useSyncExternalStore(subscribeDemoSession, hasResidentReport, () => false)
  const leakFixed = session === "reported"
  const electricalPending = leakFixed && electrician !== "reported"
  const steps = leakFixed ? [...plumberSteps.slice(0, 3), "Leak repaired", "Electrical inspection complete"] : plumberSteps
  const current = leakFixed && !electricalPending ? steps.length - 1 : statusBySession[session] ?? 0
  const title = electricalPending ? "Leak fixed. Electrical check pending." : leakFixed ? "Repairs complete" : steps[current]
  const detail = electricalPending
    ? electrician === "confirmed" ? `Elektro Schmitz will check the ceiling lamp at ${electric.slot}.`
      : electrician === "sent" ? "Elektro Schmitz will confirm a time to check the ceiling lamp." : "Your property manager is arranging a check of the ceiling lamp."
    : leakFixed ? "The plumber repaired the leak and the electrician completed the inspection." : statusDetails[current]

  return (
    <main className="tracking-page">
      <header className="topbar">
        <HomeLink href="/tenant/3.1" />
        <span className="mode">Resident portal</span>
      </header>
      <div className="heading">
        <div>
          <h1>Water leak</h1>
          <p>{scenarioBuilding.address} · Apartment {demoReport.payload.unit_id}</p>
        </div>
      </div>
      {!hasReport ? <section className="report-card"><h2>No repair reported yet</h2>
        <Link className="action-link" href="/tenant/3.1">Report a repair</Link></section> : <>
      <section className="tracking-status" data-complete={current === steps.length - 1} aria-live="polite" aria-atomic="true">
        <h2>{title}</h2>
        <p>{detail}</p>
      </section>
      <section className="tracking-progress" aria-labelledby="tracking-heading">
        <h2 id="tracking-heading">Repair progress</h2>
        <ol>
          {steps.map((step, index) => (
            <li key={step} data-step={index < current ? "done" : index === current ? "current" : "upcoming"}
              aria-current={index === current ? "step" : undefined}>
              <span className="tracking-dot" aria-hidden="true">
                {index <= current && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="m3 7 2.5 2.5L11 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span>{step}{index === 2 && index <= current && <small>{demoSlot.payload.slot}</small>}</span>
            </li>
          ))}
        </ol>
      </section>
      </>}
    </main>
  )
}
