import { getState } from "@/lib/store"
import { scenarioBuilding } from "../../../../client/buildings"
import { LiveRefresh } from "../../live-refresh"
import { notFound } from "next/navigation"
import { demoReport } from "../../../../client/state"
import { RepairTracking } from "./repair-tracking"
import { partnerName } from "../../../../client/partners"

export const metadata = { title: "Repair tracking · Dirigent" }

export default async function TrackPage({ params }: { params: Promise<{ case: string }> }) {
  const { case: caseId } = await params
  if (process.env.NEXT_PUBLIC_MOCK !== "true") {
    const { cases, events } = getState()
    const item = cases.find(entry => entry.id === caseId)
    if (!item) notFound()
    const history = events.filter(event => event.case_id === caseId)
    const partners = [...new Set(history.flatMap(event => event.kind === "partner_job" && typeof event.payload.partner_id === "string" ? [event.payload.partner_id] : []))]
    const latestFor = (partnerId: string, kind: string) => history.findLast(event => event.kind === kind &&
      (event.payload.partner_id === partnerId || (partnerId === "plumber_krause" && event.payload.partner_id == null)))?.payload
    const slots = partners.flatMap(partnerId => {
      const slot = latestFor(partnerId, "slot_confirmed")?.slot
      return typeof slot === "string" ? [`${partnerName(partnerId)} · ${slot}`] : []
    })
    const approved = partners.length > 0
    const scheduled = approved && partners.every(partnerId => latestFor(partnerId, "slot_confirmed"))
    const repaired = item.status === "resolved" || (approved && partners.every(partnerId => latestFor(partnerId, "result")))
    // A neighbour check counts as done once someone answered, or once the case moved on without them.
    const neighboursChecked = approved || history.some(event => event.kind === "call_ended" && event.payload.outcome === "answered")
    const done = [true, neighboursChecked, approved, scheduled, repaired]
    const steps = ["Report received", "Neighbours checked", "Repair approved", "Appointment confirmed", "Repair complete"]
    // The last step reached in order; a later step never shows as reached before an earlier one.
    const current = done.indexOf(false) === -1 ? steps.length - 1 : done.indexOf(false) - 1
    const waiting = partners.filter(partnerId => !latestFor(partnerId, "slot_confirmed")).map(partnerName)
    const messages = [
      "We are checking the apartments next to yours.",
      "Your property manager is reviewing the repair.",
      `${waiting.join(" and ")} will confirm a visit.${slots.length ? ` Confirmed: ${slots.join(", ")}.` : ""}`,
      `Visit confirmed: ${slots.join(", ")}.`,
      "The repair has been reported complete.",
    ]
    const water = history.findLast(event => event.kind === "water_status_confirmed")?.payload.status
    const waterNote = water === "off" ? "The water on your riser is off until the repair is finished."
      : water === "restored" ? "The water on your riser is back on." : ""
    return <main className="tracking-page">
      {item.status !== "resolved" && <LiveRefresh />}
      <header className="topbar"><strong>Dirigent</strong><span className="mode">Resident portal</span></header>
      <div className="heading"><div><h1>Water leak</h1><p>{scenarioBuilding.address} · Apartment {item.unit_id}</p></div></div>
      <section className="tracking-status" data-complete={repaired} aria-live="polite">
        <h2>{steps[current]}</h2><p>{messages[current]}</p>
        {waterNote && <p>{waterNote}</p>}
      </section>
      <section className="tracking-progress"><h2>Repair progress</h2><ol>{steps.map((label, index) =>
        <li key={label} data-step={index < current ? "done" : index === current ? "current" : "upcoming"} aria-current={index === current ? "step" : undefined}>
          <span className="tracking-dot" aria-hidden="true">{index <= current && "✓"}</span>
          <span>{label}{index === 3 && slots.map(slot => <small key={slot}>{slot}</small>)}</span>
        </li>)}</ol></section>
    </main>
  }
  if (caseId !== demoReport.case_id) notFound()

  return <RepairTracking />
}
