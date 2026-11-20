import { Dashboard } from "./dashboard"
import { buildings, scenarioBuilding } from "../../../client/buildings"
import { demoReport } from "../../../client/state"

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ report?: string | string[]; building?: string | string[] }>
}) {
  const { report, building } = await searchParams
  const startFromReport = report === demoReport.case_id
  const initialBuildingId = startFromReport
    ? scenarioBuilding.id
    : buildings.find(({ id }) => id === building)?.id ?? ""

  return <Dashboard key={`${initialBuildingId}/${startFromReport}`} initialBuildingId={initialBuildingId} startFromReport={startFromReport} />
}
