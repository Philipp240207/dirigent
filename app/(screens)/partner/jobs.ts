import { buildings, scenarioBuilding, type Building } from "../../../client/buildings"
import { demoJob, demoReport, demoResult, demoSlot } from "../../../client/state"

export const jobStatuses = ["New", "Scheduled", "Completed"] as const
export type JobStatus = typeof jobStatuses[number]

type Job = {
  id: string
  title: string
  apartment: string
  building: Building
  scope: string
  priority: "Urgent" | "Standard"
  slot: string
  result: { cost: number; description: string }
  initialStatus: JobStatus
  example: boolean
  access?: string
  availability?: string
  assessment?: string
  affectedUnits?: string[]
}

const { case_id: caseId } = demoReport
const { shared, briefing } = demoJob.payload
const { slot } = demoSlot.payload
const { cost_eur: cost, work_description: description } = demoResult.payload

if (!caseId || !shared?.unit_id || !briefing || !slot || cost === undefined || !description) {
  throw new Error("The demo fixture is missing required plumber job details.")
}
export const mainJob: Job = {
  id: caseId,
  title: "Water leak",
  apartment: shared.unit_id,
  building: scenarioBuilding,
  scope: briefing,
  priority: "Urgent",
  slot,
  result: { cost, description },
  initialStatus: "New",
  example: false,
  access: shared.access_info,
  availability: shared.tenant_availability,
  assessment: shared.damage_assessment,
  affectedUnits: shared.affected_units,
}

export const jobs: Job[] = [
  mainJob,
  {
    id: "example-drain", title: "Blocked kitchen drain", apartment: "3.1",
    building: buildings[1], scope: "Inspect the kitchen trap and clear the blockage.",
    priority: "Standard", slot: "17:30", initialStatus: "New", example: true,
    result: { cost: 95, description: "Cleared the kitchen trap and tested the drain." },
  },
  {
    id: "example-tap", title: "Dripping bathroom tap", apartment: "1.2",
    building: buildings[2], scope: "Check the bathroom tap and replace the seal if needed.",
    priority: "Standard", slot: "18:00", initialStatus: "Scheduled", example: true,
    result: { cost: 80, description: "Replaced the tap seal and checked for leaks." },
  },
]

export function jobStatus(job: Job, session: string, examples: string): JobStatus | null {
  if (!job.example) {
    if (session === "reported") return "Completed"
    if (session === "confirmed") return "Scheduled"
    return session === "sent" ? "New" : null
  }
  const status = (JSON.parse(examples || "{}") as Record<string, JobStatus>)[job.id]
  return status ?? job.initialStatus
}
