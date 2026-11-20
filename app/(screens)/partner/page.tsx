import { connection } from "next/server"
import MockQueue from "./mock-queue"
import { releasedJobs } from "./live-jobs"
import { LiveRefresh } from "../live-refresh"
import { LiveQueue } from "./live-queue"
import { isPartnerId, partnerName } from "../../../client/partners"

export const metadata = { title: "Partner jobs · Dirigent" }

export default async function PartnerOverview({ searchParams }: { searchParams: Promise<{ partner?: string }> }) {
  if (process.env.NEXT_PUBLIC_MOCK === "true") return <MockQueue />
  await connection()
  const { partner = "plumber_krause" } = await searchParams
  if (!isPartnerId(partner)) return <p>No live jobs for this partner.</p>
  const statusLabel = { dispatched: "New", scheduled: "Scheduled", resolved: "Completed" } as const
  const jobs = releasedJobs(partner).map(job => ({
    id: job.id, title: job.role === "electrician" ? "Ceiling lamp inspection" : "Water leak", address: job.address, unit: job.unit,
    status: statusLabel[job.status as keyof typeof statusLabel], slot: job.slot, cost: job.cost,
  }))
  return <>
    <LiveRefresh />
    <LiveQueue partnerId={partner} partnerLabel={partnerName(partner)} jobs={jobs} />
  </>
}
