import { releasedJobs } from "../live-jobs"
import { LiveRefresh } from "../../live-refresh"
import { WorkForm } from "./work-form"
import { IncomingCall } from "./incoming-call"
import { notFound } from "next/navigation"
import { getState } from "@/lib/store"
import { isCallDryRun } from "@/lib/calls"
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
    const scheduled = job.status === "scheduled"
    const completed = job.status === "resolved"
    const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_PARTNER?.trim()
    // The server calls the plumber's phone to agree on the visit (lib/plumberCall.ts) when it is
    // configured; the browser call is then only used to report the result after the visit.
    const phoneDispatch = partner === "plumber_krause" && !isCallDryRun() &&
      Boolean(process.env.DEMO_PHONE_PLUMBER?.trim() && process.env.ELEVENLABS_AGENT_PARTNER_PHONE?.trim() &&
        process.env.ELEVENLABS_PARTNER_PHONE_NUMBER_ID?.trim())
    const notes = getState().events.filter(event => event.case_id === job.id && event.kind === "reasoning" &&
      typeof event.payload.text === "string" && /plumber call/i.test(event.payload.text))
    const phoneProblem = notes.some(event => /skipped|did not save|could not be verified/i.test(String(event.payload.text)))
    const calling = phoneDispatch && !scheduled && !completed
    const street = job.address.split(",")[0].replace(/stra(ss|ß)e\b/i, "Str.")
    const briefing = [job.scope, job.address, job.caretaker && `Access: ${job.caretaker}.`].filter(Boolean).join(" ")
    const title = job.role === "electrician" ? "Ceiling lamp inspection" : "Water leak"
    return <>
      <div className="heading management-heading"><div><h1>{title}</h1><p>{partnerName(partner)}</p></div></div>
      <div className="tenant-location" aria-label="Job location">
        <img src={buildingPortrait(scenarioBuilding)} width="72" height="76" alt="" />
        <div><strong>{scenarioBuilding.address}</strong><p>{scenarioBuilding.city}</p></div>
        <span>Apartment {job.unit}</span>
      </div>
      {calling && <section className="incoming-call phone-dispatch" data-state={phoneProblem ? "declined" : "active"} aria-live="polite">
        <LiveRefresh />
        {phoneProblem ? <>
          <p className="incoming-label">Anruf nicht abgeschlossen</p>
          <p>Den Termin bitte unten eintragen.</p>
        </> : <>
          <p className="incoming-label">Telefon</p>
          <p className="incoming-caller">Dirigent ruft Sanitär Krause an</p>
          <p className="incoming-topic">Termin wird am Telefon abgestimmt. Er erscheint hier automatisch.</p>
        </>}
      </section>}
      {agentId && !calling && <IncomingCall key={`${job.id}/${partner}`} agentId={agentId} caseId={job.id} partnerId={partner} completed={completed}
        mode={scheduled ? "report" : "dispatch"} caller={`Hausverwaltung ${street || "Dirigent"}`} fallbackBriefing={briefing} />}
      <section className="job-summary" aria-label="Job details">
        {job.photo && <img className="job-photo" src={job.photo} alt={`Damage photo from apartment ${job.unit}`} />}
        <dl>
          <div><dt>Address</dt><dd>{job.address}</dd></div>
          <div><dt>Apartment</dt><dd>{job.unit}{job.confirmedUnits.length > 1 && <>, also {job.confirmedUnits.filter(unit => unit !== job.unit).join(", ")}</>}</dd></div>
          {job.scope && <div><dt>Problem</dt><dd>{job.scope}</dd></div>}
          {job.assessment && <div><dt>Photo assessment</dt><dd>{job.assessment}</dd></div>}
          {job.caretaker && <div><dt>Caretaker</dt><dd>{job.caretaker}</dd></div>}
        </dl>
      </section>
      <section className="report-card" aria-labelledby="job-heading">
        <h2 id="job-heading">{completed ? "Work reported" : scheduled ? "Report your work" : "Confirm your visit"}</h2>
        {!scheduled && !completed && job.scope && <p>{job.scope}</p>}
        {scheduled && <p>Visit confirmed for <strong>{job.slot}</strong>. Report the result once the work is complete.</p>}
        {completed ? <div className="partner-result">
          {job.cost !== null && <strong>Reported charge: €{job.cost}</strong>}
          <p>{job.work}</p>
        </div> : <WorkForm key={job.id + job.status} id={job.id} partnerId={partner} schedule={!scheduled} />}
        <details className="job-disclosure">
          <summary>Work order details</summary>
          <p>{job.scope}</p>
          <dl>
            {job.caretaker && <div><dt>Access</dt><dd>{job.caretaker}</dd></div>}
            {job.slot && <div><dt>Appointment</dt><dd>{job.slot}</dd></div>}
            {job.assessment && <div><dt>Damage assessment</dt><dd>{job.assessment}</dd></div>}
            {job.availability && <div><dt>Tenant availability</dt><dd>{job.availability}</dd></div>}
            {job.affectedUnits.length > 0 && <div><dt>Affected units</dt><dd>{job.affectedUnits.join(", ")}</dd></div>}
          </dl>
        </details>
      </section>
    </>
  }
  if (partner !== "plumber_krause" && partner !== "electrician_schmitz") notFound()
  if (partner === "electrician_schmitz" && caseId !== electricJob.id) notFound()
  if (!jobs.some((job) => job.id === caseId)) notFound()

  return <PartnerJob caseId={caseId} electrician={partner === "electrician_schmitz"} />
}
