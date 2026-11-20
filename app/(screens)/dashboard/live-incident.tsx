import type { getState } from "../../../lib/store"
import { IncidentSection, riskStyles } from "./building-section"

type IncidentEvent = ReturnType<typeof getState>["events"][number]
const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" })

function eventTime(value: unknown) {
  const timestamp = typeof value === "string" ? Date.parse(value) : NaN
  return Number.isFinite(timestamp) ? clock.format(timestamp) : ""
}

function callEntry(event: IncidentEvent) {
  const p = event.payload
  const recipient = String(p.to_tenant_id ?? "")
  const apartment = /^t(\d)(\d)$/.exec(recipient)
  const target = apartment ? `Apartment ${apartment[1]}.${apartment[2]}` : recipient
  switch (event.kind) {
    case "call_started":
      return { title: p.attempt ? `Calling · attempt ${p.attempt}` : "Calling", target }
    case "call_retry_scheduled": {
      const time = eventTime(p.at)
      return { title: time ? `Retry at ${time}` : "Retry scheduled", target }
    }
    case "call_ended":
      return { title: p.outcome === "no_answer" ? "No answer" : "Call answered", target, summary: typeof p.summary === "string" ? p.summary : "" }
    default:
      return null
  }
}

export type WaterStatus = "off" | "restored"

export function LiveIncident({ unit, resolved, events, onWaterStatus, waterBusy = false, disabled = false }: {
  unit: string
  resolved: boolean
  events: IncidentEvent[]
  onWaterStatus?: (status: WaterStatus) => void
  waterBusy?: boolean
  disabled?: boolean
}) {
  const risks = new Map([[unit, "confirmed"]])
  for (const { kind, payload } of events) {
    // Earlier servers emitted the possible source in a reasoning event.
    if (kind === "reasoning" && typeof payload.text === "string") {
      const source = /^Likely source (\d+\.\d+)\./.exec(payload.text)
      if (source && !risks.has(source[1])) risks.set(source[1], "source")
    }
    if (kind === "affected" && typeof payload.unit_id === "string" && typeof payload.risk === "string") {
      let risk = payload.risk
      if (risk === "low") risk = "check"
      if (payload.unit_id === unit && risk === "high") risk = "confirmed"
      if (Object.hasOwn(riskStyles, risk)) risks.set(payload.unit_id, risk)
    }
  }
  const calls = events.flatMap(event => {
    const entry = callEntry(event)
    return entry ? [{ ...entry, id: event.id, at: event.at }] : []
  }).reverse()
  const [latest, ...earlier] = calls
  const water = events.findLast(event => event.kind === "water_status_confirmed")?.payload.status
  const waterOff = water === "off"
  const shutoffRequested = events.some(event => event.kind === "water_shutoff_requested")
  const plumberDone = events.some(event => event.kind === "result" && event.payload.partner_id === "plumber_krause")
  const canConfirmOff = Boolean(onWaterStatus) && shutoffRequested && !water && !resolved
  const canConfirmRestored = Boolean(onWaterStatus) && waterOff
  return <div className="live-incident">
    <IncidentSection unitRisk={id => risks.get(id) ?? ""} reportedUnit={unit} showLegend riserActive={!resolved && !waterOff} />
    {(waterOff || water === "restored" || (!resolved && shutoffRequested)) && <div className="live-water-status">
      <p role="status">
        {waterOff ? (plumberDone ? "Caretaker asked to reopen the valve" : "Water shut-off confirmed")
          : water === "restored" ? "Water supply restored" : "Caretaker asked to shut off the water"}
      </p>
      {canConfirmOff && <button type="button" className="secondary" disabled={waterBusy || disabled} onClick={() => onWaterStatus?.("off")}>
        {waterBusy ? "Confirming…" : "Caretaker closed the valve"}
      </button>}
      {canConfirmRestored && <>
        <button type="button" className="secondary" disabled={waterBusy || disabled || !plumberDone} aria-describedby={plumberDone ? undefined : "water-restore-note"} onClick={() => onWaterStatus?.("restored")}>
          {waterBusy ? "Confirming…" : "Caretaker reopened the valve"}
        </button>
        {!plumberDone && <p id="water-restore-note">Available after the plumber reports the repair.</p>}
      </>}
    </div>}
    <div className="call-history">
      <h3>Resident calls</h3>
      {latest ? <>
        <p><strong>{latest.title}</strong> · {latest.target} <time dateTime={latest.at}>{eventTime(latest.at)}</time></p>
        {latest.summary && <p>{latest.summary}</p>}
        {earlier.length > 0 && <details><summary>Earlier calls and attempts ({earlier.length})</summary>
          <ol>{earlier.map(entry => <li key={entry.id}><time dateTime={entry.at}>{eventTime(entry.at)}</time> {entry.title} · {entry.target}{entry.summary && <p>{entry.summary}</p>}</li>)}</ol>
        </details>}
      </> : <p>No calls recorded yet.</p>}
    </div>
  </div>
}
