"use client"

import Link from "next/link"
import { useSyncExternalStore } from "react"
import { emptyDemoSession, readDemoSession, readExampleJobs, subscribeDemoSession, writeDemoSession, writeExampleJob } from "../../../../client/state"
import { jobs, jobStatus } from "../jobs"

export function PartnerJob({ caseId }: { caseId: string }) {
  const session = useSyncExternalStore(subscribeDemoSession, readDemoSession, emptyDemoSession)
  const examples = useSyncExternalStore(subscribeDemoSession, readExampleJobs, emptyDemoSession)
  const job = jobs.find(({ id }) => id === caseId)!
  const status = process.env.NEXT_PUBLIC_MOCK === "true" ? jobStatus(job, session, examples) : null

  function advanceJob() {
    const scheduled = status === "New"
    if (job.example) writeExampleJob(job.id, scheduled ? "Scheduled" : "Completed")
    else writeDemoSession(scheduled ? "confirmed" : "reported")
  }

  return (
    <main className="partner-page">
      <header className="topbar">
        <strong className="wordmark"><span className="wordmark-icon" aria-hidden="true" />Dirigent</strong>
        <Link className="nav-link" href="/partner">All jobs</Link>
      </header>
      <div className="heading">
        <div><h1>{status ? job.title : "Plumber job"}</h1><p>Sanitär Krause</p></div>
      </div>
      {status && (
        <div className="tenant-location" aria-label="Job location">
          <div><strong>{job.building.address}</strong><p>{job.building.city}</p></div>
          <span>Apartment {job.apartment}</span>
        </div>
      )}
      <section className="report-card" aria-labelledby="job-heading">
        <h2 id="job-heading">{status ? "Job status" : "Job unavailable"}</h2>
        {status ? (
          <>
            <p className="case-status" data-status={status === "Completed" ? "resolved" : "open"} role="status">
              {status}{job.example && " · Example job"}
            </p>
            <p className="job-scope">{job.scope}</p>
            {status !== "New" && <p><strong>Appointment at {job.slot}</strong></p>}
            {job.access && (
              <details className="job-disclosure">
                <summary>Access and damage details</summary>
                <dl>
                  <div><dt>Access</dt><dd>{job.access}</dd></div>
                  {job.assessment && <div><dt>Damage assessment</dt><dd>{job.assessment}</dd></div>}
                  {job.availability && <div><dt>Tenant availability</dt><dd>{job.availability}</dd></div>}
                  {job.affectedUnits && <div><dt>Affected units</dt><dd>{job.affectedUnits.join(", ")}</dd></div>}
                </dl>
              </details>
            )}
            {status === "Completed" ? (
              <div className="partner-result">
                <strong>Repair reported · €{job.result.cost}</strong>
                <p>{job.result.description}</p>
              </div>
            ) : (
              <button className="partner-action" type="button" onClick={advanceJob}>
                {status === "Scheduled" ? "Report done" : `Confirm ${job.slot} appointment`}
              </button>
            )}
          </>
        ) : <p>The job becomes available when the property manager approves and sends it.</p>}
      </section>
      <Link className="action-link" href="/dashboard">Back to dashboard</Link>
    </main>
  )
}
