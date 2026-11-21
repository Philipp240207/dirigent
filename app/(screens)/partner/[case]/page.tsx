import { releasedJobs } from "../live-jobs"
import { LiveRefresh } from "../../live-refresh"
import { WorkForm } from "./work-form"
import { notFound } from "next/navigation"
import { getState } from "@/lib/store"
import { electricJob, jobs } from "../jobs"
import { PartnerJob } from "./partner-job"
import { isPartnerId, partnerName } from "../../../../client/partners"
import { buildingPortrait, scenarioBuilding } from "../../../../client/buildings"

export const metadata = { title: "Partner job · Dirigent" }

export default async function PartnerPage({ params, searchParams }: { params: Promise<{ case: string }>; searchParams: Promise<{ partner?: string }> }) {
  const { case: caseId } = await params
  const { partner = "plumber_krause" } = await searchParams
  if (process.env.NEXT_PUBLIC_MOCK !== "true") {
    if (!isPartnerId(partner)) notFound()
    const job = releasedJobs(partner).find(item => item.id === caseId)
    if (!job) return <section className="report-card"><LiveRefresh /><h1>Job unavailable</h1><p>Only approved jobs appear here.</p></section>
    const completed = job.status === "resolved"
    const title = job.role === "electrician" ? "Ceiling lamp inspection" : "Water leak"
    // Timeline from the partner's own events (times in Berlin time from the event fields).
    const own = getState().events.filter(event => event.case_id === job.id &&
      (event.payload.partner_id === partner || (partner === "plumber_krause" && event.payload.partner_id == null)))
    const released = own.find(event => event.kind === "partner_job")
    const proposed = own.findLast(event => event.kind === "slot_proposed")
    const confirmed = own.findLast(event => event.kind === "slot_confirmed")
    const result = own.findLast(event => event.kind === "result")
    const proposedSlot = proposed?.payload.slot ?? confirmed?.payload.slot
    const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" })
    const at = (value?: string) => value && Number.isFinite(Date.parse(value)) ? clock.format(Date.parse(value)) : ""
    const cost = typeof result?.payload.cost_eur === "number" ? result.payload.cost_eur : null
    const steps = [
      { label: "Called by property management", done: Boolean(released), time: at(released?.at) },
      { label: typeof proposedSlot === "string" ? `Appointment proposed: ${proposedSlot}` : "Appointment proposed", done: typeof proposedSlot === "string", time: at((proposed ?? confirmed)?.at) },
      { label: "Confirmed", done: Boolean(confirmed), time: at(confirmed?.at) },
      { label: result ? `Done: ${cost !== null ? `${cost} EUR` : ""}${typeof result.payload.work_description === "string" ? `, ${result.payload.work_description}` : ""}` : "Done", done: Boolean(result), time: at(result?.at) },
    ]
    const current = steps.findLastIndex(step => step.done)
    return <>
      {!completed && <LiveRefresh />}
      <div className="heading management-heading"><div><h1>{title}</h1><p>{partnerName(partner)}</p></div></div>
      <div className="tenant-location" aria-label="Job location">
        <img src={buildingPortrait(scenarioBuilding)} width="72" height="76" alt="" />
        <div><strong>{scenarioBuilding.address}</strong><p>{scenarioBuilding.city}</p></div>
        <span>Apartment {job.unit}</span>
      </div>
      <section className="job-summary" aria-label="Job details">
        {job.photo && <img className="job-photo" src={job.photo} alt={`Damage photo from apartment ${job.unit}`} />}
        <dl>
          <div><dt>Address</dt><dd>{job.address}</dd></div>
          <div><dt>{job.confirmedUnits.length > 1 ? "Apartments" : "Apartment"}</dt><dd>{[job.unit, ...job.confirmedUnits.filter(unit => unit !== job.unit)].join(" and ")}</dd></div>
          {job.scope && <div><dt>Problem</dt><dd>{job.scope}</dd></div>}
          {job.assessment && <div><dt>Photo assessment</dt><dd>{job.assessment}</dd></div>}
          {job.caretaker && <div><dt>Caretaker</dt><dd>{job.caretaker}</dd></div>}
        </dl>
      </section>
      <section className="tracking-progress partner-timeline" aria-labelledby="partner-timeline-heading">
        <h2 id="partner-timeline-heading">Job timeline</h2>
        <ol>{steps.map((step, index) => (
          <li key={index} data-step={step.done ? (index === current ? "current" : "done") : "upcoming"} aria-current={index === current ? "step" : undefined}>
            <span className="tracking-dot" aria-hidden="true">{step.done && (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="m3 7 2.5 2.5L11 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}</span>
            <span>{step.label}{step.time && <small>{step.time}</small>}</span>
          </li>
        ))}</ol>
      </section>
      {!completed && <details className="job-disclosure manual-entry">
        <summary>Enter manually (only if the phone call fails)</summary>
        <WorkForm key={job.id + job.status} id={job.id} partnerId={partner} schedule={!confirmed} />
      </details>}
    </>
  }
  if (partner !== "plumber_krause" && partner !== "electrician_schmitz") notFound()
  if (partner === "electrician_schmitz" && caseId !== electricJob.id) notFound()
  if (!jobs.some((job) => job.id === caseId)) notFound()

  return <PartnerJob caseId={caseId} electrician={partner === "electrician_schmitz"} />
}
