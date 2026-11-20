import { notFound } from "next/navigation"
import { buildings, buildingUnits, scenarioBuilding } from "../../../../client/buildings"
import buildingData from "../../../../data/building.json"
import { demoReport } from "../../../../client/state"
import { TenantReport } from "./tenant-report"

export default async function TenantPage({ params, searchParams }: {
  params: Promise<{ unit: string }>
  searchParams: Promise<{ building?: string | string[] }>
}) {
  const [{ unit }, { building: buildingId }] = await Promise.all([params, searchParams])
  const building = buildings.find(({ id }) => id === (buildingId ?? scenarioBuilding.id))
  if (!building || !buildingUnits(building).includes(unit)) notFound()

  const flat = buildingData.units.find(item => item.id === unit)
  const resident = building.id === scenarioBuilding.id
    ? buildingData.parties.tenants.find(tenant => tenant.id === flat?.tenant_id)
    : undefined
  const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_TENANT?.trim()

  return <TenantReport key={`${building.id}/${unit}`} unit={unit} building={building}
    liveResident={resident ? { name: resident.name, language: resident.language, agentId } : undefined}
    canSimulate={building.id === scenarioBuilding.id && unit === demoReport.payload.unit_id} />
}
