"use client"

import Link from "next/link"
import { useState, useSyncExternalStore } from "react"
import { buildings } from "../../../client/buildings"
import { emptyDemoSession, readDemoSession, readExampleJobs, subscribeDemoSession } from "../../../client/state"
import { jobs, jobStatus, jobStatuses, type JobStatus } from "./jobs"

export default function PartnerOverview() {
  const [buildingId, setBuildingId] = useState("")
  const [filter, setFilter] = useState<JobStatus>("New")
  const session = useSyncExternalStore(subscribeDemoSession, readDemoSession, emptyDemoSession)
  const examples = useSyncExternalStore(subscribeDemoSession, readExampleJobs, emptyDemoSession)
  const queue = process.env.NEXT_PUBLIC_MOCK === "true"
    ? jobs.map((job) => ({ job, status: jobStatus(job, session, examples) })).filter(({ job, status }) => status && (!buildingId || job.building.id === buildingId))
    : []
  const visible = queue.filter(({ status }) => status === filter)

  return (
    <main className="partner-page">
      <header className="topbar">
        <strong className="wordmark"><span className="wordmark-icon" aria-hidden="true" />Dirigent</strong>
        <Link className="nav-link" href="/dashboard">Dashboard</Link>
      </header>
      <div className="heading"><div><h1>Jobs</h1><p>Sanitär Krause</p></div></div>
      <div className="partner-toolbar">
        <label className="building-picker">
          Building
          <select value={buildingId} onChange={(event) => setBuildingId(event.target.value)}>
            <option value="">All buildings</option>
            {buildings.map((building) => <option key={building.id} value={building.id}>{building.address}</option>)}
          </select>
        </label>
      </div>
      <div className="job-filters" role="group" aria-label="Filter jobs by status">
        {jobStatuses.map((status) => (
          <button key={status} type="button" aria-pressed={filter === status} onClick={() => setFilter(status)}>
            {status} <span>{queue.filter((entry) => entry.status === status).length}</span>
          </button>
        ))}
      </div>
      <section className="job-queue" aria-label={`${filter} jobs`}>
        {visible.length ? (
          <ul>{visible.map(({ job, status }) => (
            <li key={job.id}>
              <Link href={`/partner/${job.id}`} className="job-row" data-urgent={status === "New" && job.priority === "Urgent"}>
                <span className="job-row-heading">
                  <strong>{job.title}</strong>
                  {job.example && <span className="job-example">Example</span>}
                </span>
                <span className="job-location">
                  {job.building.address} · Apartment {job.apartment}
                </span>
                <span className={status === "New" && job.priority === "Urgent" ? "job-urgent" : "job-meta"}>
                  {status === "New" ? job.priority : status === "Scheduled" ? `Appointment · ${job.slot}` : `Repair reported · €${job.result.cost}`}
                </span>
              </Link>
            </li>
          ))}</ul>
        ) : <p className="job-empty">No {filter.toLowerCase()} jobs{buildingId ? " in this building" : ""}.</p>}
      </section>
    </main>
  )
}
