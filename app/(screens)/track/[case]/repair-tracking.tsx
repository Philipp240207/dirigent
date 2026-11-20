"use client"

import { useSyncExternalStore } from "react"
import { scenarioBuilding } from "../../../../client/buildings"
import { demoReport, demoSlot, emptyDemoSession, readDemoSession, subscribeDemoSession } from "../../../../client/state"

const steps = [
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
  const current = statusBySession[session] ?? 0

  return (
    <main className="tracking-page">
      <header className="topbar">
        <strong className="wordmark"><span className="wordmark-icon" aria-hidden="true" />Dirigent</strong>
        <span className="mode">Local demo</span>
      </header>
      <div className="heading">
        <div>
          <h1>Water leak</h1>
          <p>{scenarioBuilding.address} · Apartment {demoReport.payload.unit_id}</p>
        </div>
      </div>
      <section className="tracking-status" data-complete={current === steps.length - 1} aria-live="polite" aria-atomic="true">
        <h2>{steps[current]}</h2>
        <p>{statusDetails[current]}</p>
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
    </main>
  )
}
