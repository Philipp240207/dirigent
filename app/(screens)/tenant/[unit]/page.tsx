import { notFound } from "next/navigation"
import { buildings, buildingUnits, scenarioBuilding } from "../../../../client/buildings"
import { demoReport } from "../../../../client/state"
import { TenantReport } from "./tenant-report"

export default async function TenantPage({ params, searchParams }: {
  params: Promise<{ unit: string }>
  searchParams: Promise<{ building?: string | string[] }>
}) {
  const [{ unit }, { building: buildingId }] = await Promise.all([params, searchParams])
  const building = buildings.find(({ id }) => id === (buildingId ?? scenarioBuilding.id))
  if (!building || !buildingUnits(building).includes(unit)) notFound()

  return <TenantReport key={`${building.id}/${unit}`} unit={unit} building={building}
    canSimulate={building.id === scenarioBuilding.id && unit === demoReport.payload.unit_id} />
}
