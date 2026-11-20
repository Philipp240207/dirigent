import { getState } from "@/lib/store"
import { scenarioBuilding } from "../../../../client/buildings"
import { LiveRefresh } from "../../live-refresh"
import { notFound } from "next/navigation"
import { demoReport } from "../../../../client/state"
import { RepairTracking } from "./repair-tracking"

export default async function TrackPage({ params }: { params: Promise<{ case: string }> }) {
  const { case: caseId } = await params
  if (process.env.NEXT_PUBLIC_MOCK !== "true") {
    const { cases, events } = getState()
    const item = cases.find(entry => entry.id === caseId)
    if (!item) notFound()
    const slot = events.findLast(event => event.case_id === caseId && event.kind === "slot_confirmed")?.payload.slot
    const steps = ["Report received", "Plumber contacted", "Appointment confirmed", "Repair complete"]
    const current = { open: 0, pending_approval: 0, dispatched: 1, scheduled: 2, resolved: 3 }[item.status]
    const messages = ["Your property manager is reviewing your report.", "Sanitär Krause will confirm a visit.",
      "Sanitär Krause has confirmed the visit.", "The plumber has reported the repair complete."]
    return <main className="tracking-page">
      {item.status !== "resolved" && <LiveRefresh />}
      <header className="topbar"><strong>Dirigent</strong><span className="mode">Resident portal</span></header>
      <div className="heading"><div><h1>Water leak</h1><p>{scenarioBuilding.address} · Apartment {item.unit_id}</p></div></div>
      <section className="tracking-status" data-complete={current === 3} aria-live="polite">
        <h2>{steps[current]}</h2><p>{messages[current]}</p>
      </section>
      <section className="tracking-progress"><h2>Repair progress</h2><ol>{steps.map((label, index) =>
        <li key={label} data-step={index < current ? "done" : index === current ? "current" : "upcoming"} aria-current={index === current ? "step" : undefined}>
          <span className="tracking-dot" aria-hidden="true">{index <= current && "✓"}</span>
          <span>{label}{index === 2 && typeof slot === "string" && <small>{slot}</small>}</span>
        </li>)}</ol></section>
    </main>
  }
  if (caseId !== demoReport.case_id) notFound()

  return <RepairTracking />
}
