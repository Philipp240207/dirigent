import "server-only"
import { getState } from "@/lib/store"

// Build browser-facing records only from released partner jobs and that partner's own updates.
export function releasedJobs(partnerId: string) {
  const { cases, events } = getState()
  return cases.toReversed().flatMap(item => {
    const history = events.filter(event => event.case_id === item.id)
    const sent = history.findLast(event => event.kind === "partner_job" && event.payload.partner_id === partnerId && event.payload.status === "sent")
    if (!sent) return []
    const shared = sent.payload.shared as Record<string, unknown> | undefined
    // Early plumber updates were written without a partner_id.
    const updates = history.filter(event => event.payload.partner_id === partnerId ||
      (partnerId === "plumber_krause" && event.payload.partner_id == null))
    const result = updates.findLast(event => event.kind === "result")?.payload
    const slot = updates.findLast(event => event.kind === "slot_confirmed")?.payload.slot
    const status = result ? "resolved" : typeof slot === "string" ? "scheduled" : "dispatched"
    const briefing = typeof sent.payload.briefing === "string" ? sent.payload.briefing : ""
    const assessment = shared?.damage_assessment as { damage?: unknown } | string | undefined
    const affected = Array.isArray(shared?.affected_units) ? shared.affected_units.filter((unit): unit is string => typeof unit === "string") : []
    return [{
      id: item.id, unit: item.unit_id, status,
      role: typeof sent.payload.role === "string" ? sent.payload.role : "",
      availability: typeof shared?.tenant_availability === "string" ? shared.tenant_availability : "",
      assessment: typeof assessment === "string" ? assessment : typeof assessment?.damage === "string" ? assessment.damage : "",
      affectedUnits: affected,
      address: typeof shared?.address === "string" ? shared.address : "",
      caretaker: typeof shared?.caretaker_contact === "string" ? shared.caretaker_contact : "",
      scope: typeof shared?.problem_description === "string" ? shared.problem_description : briefing,
      slot: typeof slot === "string" ? slot : "",
      work: typeof result?.work_description === "string" ? result.work_description : "",
      cost: typeof result?.cost_eur === "number" ? result.cost_eur : null,
    }]
  })
}
