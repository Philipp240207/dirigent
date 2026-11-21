import type { ReactNode } from "react"
import { buildingPortrait, buildingUnits, scenarioBuilding, type Building } from "../../../client/buildings"

const rooms: Record<string, { x: number; y: number; width: number }> = {
  "3.1": { x: 88.5, y: 220.5, width: 216 },
  "2.1": { x: 88.5, y: 302.5, width: 216 },
  "1.1": { x: 88.5, y: 384.5, width: 216 },
  "4.1": { x: 88.5, y: 138.5, width: 216 },
  "1.2": { x: 383.5, y: 384.5, width: 216 },
  "2.2": { x: 383.5, y: 302.5, width: 216 },
  "3.2": { x: 383.5, y: 220.5, width: 216 },
  "4.2": { x: 383.5, y: 138.5, width: 216 },
  cellar: { x: 88.5, y: 466.5, width: 511 },
}
export const riskStyles: Record<string, { label: string; color: string }> = {
  confirmed: { label: "Reported or confirmed", color: "#ff3b30" },
  high: { label: "High risk", color: "#ff9500" },
  source: { label: "Possible source", color: "#ffcc00" },
  check: { label: "Possible damage, check", color: "#e0b000" },
  clear: { label: "Clear", color: "#34c759" },
}

export function BuildingSection({ building, children }: { building: Building; children: ReactNode }) {
  const apartments = `${buildingUnits(building).length} apartments`
  return (
    <details className="building-card section-fold" open>
      <summary>
        <img src={buildingPortrait(building)} alt="" />
        <span>
          <strong>Building section</strong>
          <small>{building.id === scenarioBuilding.id ? `${apartments} · 2 water risers` : `${building.floors} floors · ${apartments}`}</small>
        </span>
      </summary>
      {children}
    </details>
  )
}

export function IncidentSection({ unitRisk, reportedUnit, riserActive, showLegend }: {
  unitRisk: (unit: string) => string
  reportedUnit: string
  riserActive: boolean
  showLegend: boolean
}) {
  const pipeX = reportedUnit.endsWith(".2") ? 578 : 111
  const pipeY = (rooms[reportedUnit]?.y ?? 220.5) + 42.5
  return (
  <BuildingSection building={scenarioBuilding}>
    <div className="building-map" data-riser-active={riserActive}>
      <svg className="building" viewBox="64 26 560 552" role="img" aria-label={"Building cross-section. " + Object.entries(rooms).filter(([unit]) => riskStyles[unitRisk(unit)]).map(([unit]) => unit + ": " + riskStyles[unitRisk(unit)].label).join(", ")}>
        <image href="/mock/dirigent-building.svg" width="688" height="608" />
        {Object.entries(rooms).map(([unit, room]) => {
          const risk = unitRisk(unit)
          const style = riskStyles[risk]
          if (!style) return null
          return <rect key={unit} data-unit={unit} data-risk={risk} {...room} height={unit === "cellar" ? 81 : 73} rx="2"
            fill={style.color} fillOpacity={risk === "check" ? ".14" : ".26"} stroke={style.color} strokeWidth="2.5">
            <title>{unit === "cellar" ? "Cellar" : `Apartment ${unit}`} · {style.label}</title>
          </rect>
        })}
        {rooms[reportedUnit] && riskStyles[unitRisk(reportedUnit)] && (
          // The reported flat is circled in red.
          <rect className="reported-ring" aria-hidden="true" x={rooms[reportedUnit].x - 7} y={rooms[reportedUnit].y - 7}
            width={rooms[reportedUnit].width + 14} height={87} rx="12" fill="none" stroke="#ff3b30" strokeWidth="4" />
        )}
        {riserActive && (
          <g className="active-riser" aria-hidden="true">
            <path d={`M${pipeX} ${pipeY} V508`} />
            <circle cx={pipeX} cy={pipeY} r="6" />
          </g>
        )}
      </svg>
    </div>
    {showLegend && <ul className="building-legend" aria-label="Building status legend">
      {Object.entries(riskStyles).map(([risk, style]) => (
        <li key={risk}><span style={{ background: style.color, border: `2px solid ${style.color}`, opacity: risk === "check" ? .55 : 1 }} />{style.label}</li>
      ))}
    </ul>}
    <details className="building-disclosure">
      <summary>Apartments</summary>
      <ul className="building-apartment-links">
        {buildingUnits(scenarioBuilding).map(unit => {
          const label = riskStyles[unitRisk(unit)]?.label
          return <li key={unit}>Apartment {unit}{label && <small>{label}</small>}</li>
        })}
      </ul>
    </details>
  </BuildingSection>
  )
}
