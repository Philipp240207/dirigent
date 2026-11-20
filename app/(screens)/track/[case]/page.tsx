import { notFound } from "next/navigation"
import { demoReport } from "../../../../client/state"
import { RepairTracking } from "./repair-tracking"

export default async function TrackPage({ params }: { params: Promise<{ case: string }> }) {
  const { case: caseId } = await params
  if (process.env.NEXT_PUBLIC_MOCK !== "true" || caseId !== demoReport.case_id) notFound()

  return <RepairTracking />
}
