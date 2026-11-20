import Link from "next/link"
import { useId } from "react"
import type { getState } from "../../../lib/store"
import portfolio from "../../../data/portfolio.json"

type RepairCase = ReturnType<typeof getState>["cases"][number]

export function LivePortfolio({ cases, caseId }: { cases: RepairCase[]; caseId?: string }) {
  const headingId = useId()
  const active = cases.filter(item => item.status !== "resolved")
  const awaiting = active.some(item => item.status === "pending_approval")
  const buildingStatus = awaiting ? "Approval needed" : active.length > 0 ? "Open repair" : "No open repairs"
  const state = awaiting ? "approval" : active.some(item => item.status === "open") ? "attention"
    : active.length > 0 ? "scheduled" : "clear"
  const buildings = portfolio.buildings.toSorted((a, b) => Number(b.real && active.length > 0) - Number(a.real && active.length > 0))

  return <details className="demo-views live-portfolio">
    <summary id={headingId}>Düsseldorf portfolio · {buildings.length} buildings</summary>
    <div className="live-portfolio-layout" aria-labelledby={headingId}>
      <div className="live-city-map" aria-label="Schematic map of Düsseldorf">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path className="live-city-river" d="M36 -4C24 17 55 28 47 45S13 53 22 68 39 90 25 105" />
          <path className="live-city-roads" d="M0 20 21 25 62 16 100 21M0 44 17 38 37 41 61 43 100 32M0 74 23 66 47 61 68 49 100 53M0 89 21 83 64 80 100 68M58 0 56 32 64 54 59 77 67 100M76 0 72 24 78 45 74 74 88 100M9 0 15 19 9 49 12 82 5 100" />
        </svg>
        {buildings.map((building, index) => {
          const label = `${index + 1}. ${building.name}`
          const position = { left: `${building.x}%`, top: `${building.y}%` }
          return building.real && caseId
            ? <Link className="live-city-pin" style={position} data-state={state} key={building.id} href={`#case-${caseId}`} aria-label={label} title={label}>{index + 1}</Link>
            : <span className="live-city-pin" style={position} data-state="clear" key={building.id} aria-label={label} title={label}>{index + 1}</span>
        })}
      </div>
      <ol className="live-buildings">
        {buildings.map(building => <li key={building.id}>
          {building.real && caseId ? <Link href={`#case-${caseId}`}>{building.name}</Link> : <strong>{building.name}</strong>}
          <small>{building.district} · {building.units} apartments{building.real && ` · ${buildingStatus}`}</small>
        </li>)}
      </ol>
    </div>
  </details>
}
