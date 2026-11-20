import type { getState } from "../../../lib/store"
import { partnerName } from "../../../client/partners"

type CaseEvent = ReturnType<typeof getState>["events"][number]
const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" })
const euro = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" })
const touchpointKinds = new Set(["message", "call_started", "partner_job", "slot_confirmed", "result"])
const costLabels = { voice_eur: "ElevenLabs voice", phone_eur: "Phone calls", openai_eur: "OpenAI" }

function recipientLabel(value: unknown) {
  if (value === "caretaker") return "Caretaker"
  if (value === "owner") return "Property owner"
  const unit = typeof value === "string" && /^t(\d)(\d)$/.exec(value)
  return unit ? `Apartment ${unit[1]}.${unit[2]}` : typeof value === "string" ? partnerName(value) : "Recipient"
}

export function LiveCaseActivity({ events }: { events: CaseEvent[] }) {
  const reasoning = events.filter(event => event.kind === "reasoning" && typeof event.payload.text === "string").toReversed()
  const outbox = events.filter(event => event.kind === "message" && typeof event.payload.text === "string").toReversed()
  const photo = events.findLast(event => event.kind === "photo")?.payload.assessment
  const damage = photo && typeof photo === "object" && "damage" in photo && typeof photo.damage === "string"
    ? photo.damage : undefined
  const usage = events.findLast(event => event.kind === "cost")?.payload
  const total = usage?.total_eur
  const breakdown = usage?.breakdown as Partial<Record<keyof typeof costLabels, number>> | undefined

  const charges = new Map<string, number>()
  for (const { kind, payload } of events) {
    if (kind === "result" && typeof payload.cost_eur === "number") {
      const partner = typeof payload.partner_id === "string" ? payload.partner_id : "plumber_krause"
      charges.set(partner, payload.cost_eur)
    }
  }
  const touchpoints = events.filter(event => touchpointKinds.has(event.kind)).length
  const clicks = events.filter(event => event.kind === "partner_job_approved" || event.kind === "connector_activated").length

  return <div className="live-case-activity">
    <details className="demo-views">
      <summary>Assessment ({reasoning.length + Number(Boolean(damage))})</summary>
      {damage && <p><strong>Photo assessment</strong> · {damage}</p>}
      {!damage && reasoning.length === 0 && <p>No assessment recorded yet.</p>}
      <ol>{reasoning.map(event => <li key={event.id}>
        {typeof event.payload.tool === "string" && <p><code>{event.payload.tool}</code></p>}
        <p>{String(event.payload.text)}</p>
      </li>)}</ol>
    </details>
    <details className="demo-views">
      <summary>Outbox ({outbox.length})</summary>
      {outbox.length === 0 && <p>No messages recorded yet.</p>}
      <ol>{outbox.map(event => <li key={event.id}>
        <strong>{recipientLabel(event.payload.to)}</strong>
        {Number.isFinite(Date.parse(event.at)) && <> · <time dateTime={event.at}>{clock.format(Date.parse(event.at))}</time></>}
        <p>{String(event.payload.text)}</p>
      </li>)}</ol>
    </details>
    <details className="demo-views">
      <summary>Coordination and costs</summary>
      <dl className="live-costs">
        <div><dt>Touchpoints handled</dt><dd>{touchpoints}</dd></div>
        <div><dt>Manager clicks</dt><dd>{clicks}</dd></div>
        <div><dt>Estimated coordination cost</dt><dd>{typeof total === "number" ? euro.format(total) : "Awaiting cost data"}</dd></div>
        {[...charges].map(([partner, cost]) => <div key={partner}>
          <dt>Repair charge · {recipientLabel(partner)}</dt><dd>{euro.format(cost)}</dd>
        </div>)}
        {(Object.keys(costLabels) as (keyof typeof costLabels)[]).map(key => {
          const value = breakdown?.[key]
          return typeof value === "number" ? <div key={key}><dt>{costLabels[key]}</dt><dd>{euro.format(value)}</dd></div> : null
        })}
      </dl>
    </details>
  </div>
}
