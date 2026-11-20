import { notFound } from "next/navigation"
import { jobs } from "../jobs"
import { PartnerJob } from "./partner-job"

export default async function PartnerPage({ params }: { params: Promise<{ case: string }> }) {
  const { case: caseId } = await params
  if (!jobs.some((job) => job.id === caseId)) notFound()

  return <PartnerJob caseId={caseId} />
}
