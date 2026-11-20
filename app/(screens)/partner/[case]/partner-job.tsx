"use client"

import { buildingPortrait } from "../../../../client/buildings"
import { useSyncExternalStore } from "react"
import { advanceElectrician, readElectrician, emptyDemoSession, readDemoSession, readExampleJobs, subscribeDemoSession, writeDemoSession, writeExampleJob } from "../../../../client/state"
import { electricJob, jobs, jobStatus } from "../jobs"

export function PartnerJob({ caseId, electrician }: { caseId: string; electrician: boolean }) {
  const session = useSyncExternalStore(subscribeDemoSession, readDemoSession, emptyDemoSession)
  const examples = useSyncExternalStore(subscribeDemoSession, readExampleJobs, emptyDemoSession)
  const step = useSyncExternalStore(subscribeDemoSession, readElectrician, emptyDemoSession)
  const job = electrician ? electricJob : jobs.find(({ id }) => id === caseId)!
  const status = process.env.NEXT_PUBLIC_MOCK === "true" ? jobStatus(job, electrician ? step : session, examples) : null

  function advanceJob() {
    const scheduled = status === "New"
    if (electrician) advanceElectrician(scheduled ? "confirmed" : "reported")
    else if (job.example) writeExampleJob(job.id, scheduled ? "Scheduled" : "Completed")
    else writeDemoSession(scheduled ? "confirmed" : "reported")
  }

  return (
    <>
      <div className="heading management-heading">
        <div><h1>{status ? job.title : electrician ? "Electrician job" : "Plumber job"}</h1><p>{electrician ? "Elektro Schmitz" : "Sanitär Krause"}</p></div>
      </div>
      {status && (
        <div className="tenant-location" aria-label="Job location">
          <img src={buildingPortrait(job.building)} width="72" height="76" alt="" />
          <div><strong>{job.building.address}</strong><p>{job.building.city}</p></div>
          <span>Apartment {job.apartment}</span>
        </div>
      )}
      <section className="report-card" aria-labelledby="job-heading">
        <h2 id="job-heading">{!status ? "Job unavailable" : status === "New" ? "Confirm your visit" : status === "Scheduled" ? "Report your work" : "Work reported"}</h2>
        {status ? (
          <>
            {status === "New" && <p>{electrician ? "Check the ceiling lamp and wiring." : job.example ? job.scope : "Find and repair the leak on riser A."}</p>}
            {status === "Scheduled" && <p>Visit confirmed for <strong>{job.slot}</strong>. Report the result once the work is complete.</p>}
            {status === "Completed" ? (
              <div className="partner-result">
                <strong>Reported charge: €{job.result.cost}</strong>
                <p>{job.result.description}</p>
              </div>
            ) : (
              <button className="partner-action" type="button" onClick={advanceJob}>
                {status === "Scheduled" ? "Report done" : `Confirm ${job.slot} appointment`}
              </button>
            )}
            <details className="job-disclosure">
              <summary>Work order details</summary>
              <p>{job.scope}</p>
              <dl>
                {job.access && <div><dt>Access</dt><dd>{job.access}</dd></div>}
                {job.assessment && <div><dt>Damage assessment</dt><dd>{job.assessment}</dd></div>}
                {job.availability && <div><dt>Tenant availability</dt><dd>{job.availability}</dd></div>}
                {job.affectedUnits && <div><dt>Affected units</dt><dd>{job.affectedUnits.join(", ")}</dd></div>}
              </dl>
            </details>
          </>
        ) : <p>The job becomes available when the property manager approves and sends it.</p>}
      </section>
    </>
  )
}
