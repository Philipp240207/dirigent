"use client"

import Link from "next/link"
import { useState } from "react"
import { jobStatuses, type JobStatus } from "./jobs"

export type LiveQueueJob = {
  id: string
  title: string
  address: string
  unit: string
  status: JobStatus
  slot: string
  cost: number | null
}

// The partner's job list in the partner design, from released jobs on the server.
export function LiveQueue({ partnerId, partnerLabel, jobs }: { partnerId: string; partnerLabel: string; jobs: LiveQueueJob[] }) {
  const [selected, setSelected] = useState<JobStatus | null>(null)
  const filter = selected ?? jobStatuses.find(status => jobs.some(job => job.status === status)) ?? "New"
  const visible = jobs.filter(job => job.status === filter)
  return <>
    <div className="heading management-heading"><div><h1>Partner jobs</h1><p>{partnerLabel}</p></div></div>
    <div className="job-filters" role="group" aria-label="Filter jobs by status">
      {jobStatuses.map(status => (
        <button key={status} type="button" aria-pressed={filter === status} onClick={() => setSelected(status)}>
          {status} <span>{jobs.filter(job => job.status === status).length}</span>
        </button>
      ))}
    </div>
    <section className="job-queue" aria-label={`${filter} jobs`}>
      {visible.length ? <ul>{visible.map(job => (
        <li key={job.id}>
          <Link href={`/partner/${job.id}?partner=${encodeURIComponent(partnerId)}`} className="job-row" data-urgent={job.status === "New"}>
            <span className="job-row-heading"><strong>{job.title}</strong></span>
            <span className="job-location">{job.address} · Apartment {job.unit}</span>
            <span className={job.status === "New" ? "job-urgent" : "job-meta"}>
              {job.status === "New" ? "Urgent" : job.status === "Scheduled" ? `Appointment · ${job.slot}` : `Repair reported${job.cost !== null ? ` · €${job.cost}` : ""}`}
            </span>
          </Link>
        </li>
      ))}</ul> : <p className="job-empty">No {filter.toLowerCase()} jobs. Jobs appear here once the property manager approves them.</p>}
    </section>
  </>
}
