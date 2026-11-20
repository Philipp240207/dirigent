import Link from "next/link"
import { connection } from "next/server"
import MockQueue from "./mock-queue"
import { releasedJobs } from "./live-jobs"
import { LiveRefresh } from "../live-refresh"

export default async function PartnerOverview({ searchParams }: { searchParams: Promise<{ partner?: string }> }) {
  if (process.env.NEXT_PUBLIC_MOCK === "true") return <MockQueue />
  await connection()
  const { partner = "plumber_krause" } = await searchParams
  if (partner !== "plumber_krause") return <p>No live jobs for this partner.</p>
  const jobs = releasedJobs()
  return <>
    <LiveRefresh />
    <div className="heading management-heading"><div><h1>Partner jobs</h1><p>Sanitär Krause</p></div></div>
    {["dispatched", "scheduled", "resolved"].map((status, i) => {
      const group = jobs.filter(job => job.status === status)
      if (!group.length) return null
      return <section className="job-queue live-group" key={status}>
        <h2>{["New jobs", "Scheduled visits", "Completed jobs"][i]}</h2>
        <ul>{group.map(job => <li key={job.id}><Link className="job-row" href={`/partner/${job.id}`}>
          <strong>Water leak in apartment {job.unit}</strong><span>{job.address}</span>
          <span>{job.slot || "Confirm a visit"}</span>
        </Link></li>)}</ul>
      </section>
    })}
    {!jobs.length && <p>No approved jobs yet.</p>}
  </>
}
