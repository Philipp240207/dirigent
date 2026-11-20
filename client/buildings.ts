export const buildings = [
  { id: "ksw-12", address: "Kaiserswerther Straße 12", city: "Düsseldorf", floors: 4 },
  { id: "lind-48", address: "Lindenstraße 48", city: "Düsseldorf", floors: 3 },
  { id: "park-7", address: "Parkstraße 7", city: "Düsseldorf", floors: 5 },
] as const

export type Building = typeof buildings[number]
export const scenarioBuilding = buildings[0]

export function buildingUnits(building: Building) {
  return Array.from({ length: building.floors }, (_, floor) => [
    `${floor + 1}.1`, `${floor + 1}.2`,
  ]).flat()
}
