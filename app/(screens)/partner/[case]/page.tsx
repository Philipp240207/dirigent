import { releasedJobs } from "../live-jobs"
import { LiveRefresh } from "../../live-refresh"
import { WorkForm } from "./work-form"
import { notFound } from "next/navigation"
import { electricJob, jobs } from "../jobs"
import { PartnerJob } from "./partner-job"

export default async function PartnerPage({ params, searchParams }: { params: Promise<{ case: string }>; searchParams: Promise<{ partner?: string }> }) {
  const { case: caseId } = await params
  const { partner = "plumber_krause" } = await searchParams
  if (process.env.NEXT_PUBLIC_MOCK !== "true") {
    if (partner !== "plumber_krause") notFound()
    const job = releasedJobs().find(item => item.id === caseId)
    if (!job) return <section className="report-card"><LiveRefresh /><h1>Job unavailable</h1><p>Only approved jobs appear here.</p></section>
    const scheduled = job.status === "scheduled"
    const completed = job.status === "resolved"
    return <>
      {!completed && <LiveRefresh />}
      <div className="heading management-heading"><div><h1>Water leak in apartment {job.unit}</h1><p>{job.address}</p></div></div>
      <section className="report-card">
        <h2>{completed ? "Work reported" : scheduled ? "Report your work" : "Confirm your visit"}</h2>
        {job.scope && <p>{job.scope}</p>}
        {job.caretaker && <p><strong>Access</strong> {job.caretaker}</p>}
        {job.slot && <p><strong>Appointment</strong> {job.slot}</p>}
        {completed ? <><p>{job.work}</p>{job.cost !== null && <p>Reported charge: €{job.cost}</p>}</>
          : <WorkForm key={job.id + job.status} id={job.id} schedule={!scheduled} />}
      </section>
    </>
  }
  if (partner !== "plumber_krause" && partner !== "electrician_schmitz") notFound()
  if (partner === "electrician_schmitz" && caseId !== electricJob.id) notFound()
  if (!jobs.some((job) => job.id === caseId)) notFound()

  return <PartnerJob caseId={caseId} electrician={partner === "electrician_schmitz"} />
}
