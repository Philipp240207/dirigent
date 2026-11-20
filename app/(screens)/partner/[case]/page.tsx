import { notFound } from "next/navigation"
import { electricJob, jobs } from "../jobs"
import { PartnerJob } from "./partner-job"

export default async function PartnerPage({ params, searchParams }: { params: Promise<{ case: string }>; searchParams: Promise<{ partner?: string }> }) {
  const { case: caseId } = await params
  const { partner = "plumber_krause" } = await searchParams
  if (partner !== "plumber_krause" && partner !== "electrician_schmitz") notFound()
  if (partner === "electrician_schmitz" && caseId !== electricJob.id) notFound()
  if (!jobs.some((job) => job.id === caseId)) notFound()

  return <PartnerJob caseId={caseId} electrician={partner === "electrician_schmitz"} />
}
