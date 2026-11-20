"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useState, useSyncExternalStore } from "react"
import { buildings } from "../../../client/buildings"
import { readElectrician, emptyDemoSession, readDemoSession, readExampleJobs, subscribeDemoSession } from "../../../client/state"
import { electricJob, jobs, jobStatus, jobStatuses, type JobStatus } from "./jobs"

export default function PartnerOverview() {
  const [buildingId, setBuildingId] = useState("")
  const [selectedFilter, setFilter] = useState<JobStatus | null>(null)
  const session = useSyncExternalStore(subscribeDemoSession, readDemoSession, emptyDemoSession)
  const examples = useSyncExternalStore(subscribeDemoSession, readExampleJobs, emptyDemoSession)
  const electrician = useSearchParams().get("partner") === "electrician_schmitz"
  const step = useSyncExternalStore(subscribeDemoSession, readElectrician, emptyDemoSession)
  const queue = process.env.NEXT_PUBLIC_MOCK === "true"
    ? (electrician ? [electricJob] : jobs).map((job) => ({ job, status: jobStatus(job, electrician ? step : session, examples) })).filter(({ status }) => status)
    : []
  const availableBuildings = buildings.filter(building => queue.some(({ job }) => job.building.id === building.id))
  const buildingJobs = queue.filter(({ job }) => !buildingId || job.building.id === buildingId)
  const filter = selectedFilter ?? jobStatuses.find(tab => buildingJobs.some(({ status }) => status === tab)) ?? "New"
  const visible = buildingJobs.filter(({ status }) => status === filter)

  return (
    <>
      <div className="heading management-heading"><div><h1>Partner jobs</h1><p>{electrician ? "Elektro Schmitz" : "Sanitär Krause"}</p></div></div>
      {availableBuildings.length > 1 && <div className="partner-toolbar">
        <label className="building-picker">
          Building
          <select value={buildingId} onChange={(event) => setBuildingId(event.target.value)}>
            <option value="">All buildings</option>
            {availableBuildings.map((building) => <option key={building.id} value={building.id}>{building.address}</option>)}
          </select>
        </label>
      </div>}
      <div className="job-filters" role="group" aria-label="Filter jobs by status">
        {jobStatuses.map((status) => (
          <button key={status} type="button" aria-pressed={filter === status} onClick={() => setFilter(status)}>
            {status} <span>{buildingJobs.filter((entry) => entry.status === status).length}</span>
          </button>
        ))}
      </div>
      <section className="job-queue" aria-label={`${filter} jobs`}>
        {visible.length ? (
          <ul>{visible.map(({ job, status }) => (
            <li key={job.id}>
              <Link href={`/partner/${job.id}${electrician ? "?partner=electrician_schmitz" : ""}`} className="job-row" data-urgent={status === "New" && job.priority === "Urgent"}>
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
    </>
  )
}
