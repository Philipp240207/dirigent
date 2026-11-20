import "server-only"
import { getState } from "@/lib/store"

// Build browser-facing records only from released plumber jobs and their outcomes.
export function releasedJobs() {
  const { cases, events } = getState()
  return cases.toReversed().flatMap(item => {
    const history = events.filter(event => event.case_id === item.id)
    const sent = history.findLast(event => event.kind === "partner_job" && event.payload.partner_id === "plumber_krause" && event.payload.status === "sent")
    if (!sent || !["dispatched", "scheduled", "resolved"].includes(item.status)) return []
    const shared = sent.payload.shared as Record<string, unknown> | undefined
    const plumberUpdates = history.filter(event => event.payload.partner_id === "plumber_krause" || event.payload.partner_id == null)
    const result = plumberUpdates.findLast(event => event.kind === "result")?.payload
    const slot = plumberUpdates.findLast(event => event.kind === "slot_confirmed")?.payload.slot
    return [{
      id: item.id, unit: item.unit_id, status: item.status,
      address: typeof shared?.address === "string" ? shared.address : "",
      caretaker: typeof shared?.caretaker_contact === "string" ? shared.caretaker_contact : "",
      scope: typeof shared?.problem_description === "string" ? shared.problem_description : "",
      slot: typeof slot === "string" ? slot : "",
      work: typeof result?.work_description === "string" ? result.work_description : "",
      cost: typeof result?.cost_eur === "number" ? result.cost_eur : null,
    }]
  })
}
