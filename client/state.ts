import fixture from "../fixtures/demo-events.json"

const demoEvents = fixture.events
export const demoReport = demoEvents.find((event) => event.kind === "case_created" && event.payload.type === "water_leak")!
const approvalGate = demoEvents.findIndex((event) => event.pause_until_approved)
const approvalTime = demoEvents[approvalGate].at_s
const connectorStart = demoEvents.findIndex((event) => event.kind === "connector_drafted")
const leakEvents = demoEvents.slice(0, connectorStart)
const connectorEvents = demoEvents.slice(connectorStart)
export const demoEnd = leakEvents[leakEvents.length - 1].at_s
export const demoConnectorEnd = connectorEvents[connectorEvents.length - 1].at_s
export const demoConnectorDraft = connectorEvents.find((event) => event.kind === "connector_drafted")!
export const demoConnectorActivation = connectorEvents.find((event) => event.kind === "connector_activated")!
export const demoMoveIn = connectorEvents.find((event) => event.kind === "case_created")!

export function readDemo(elapsed: number, approved: boolean) {
  return leakEvents.filter((event, index) =>
    event.at_s <= elapsed && (approved || index <= approvalGate),
  )
}

export function readConnectorDemo(elapsed: number) {
  return connectorEvents.filter((event) => event.at_s <= elapsed)
}

export function advanceDemo(elapsed: number, approved: boolean) {
  return Math.min(elapsed + 1, approved ? demoEnd : approvalTime)
}

const plumberEvents = demoEvents.filter((event) => event.case_id === demoReport.case_id)
export const demoJob = plumberEvents.find((event) => event.kind === "partner_job")!
export const demoSlot = plumberEvents.find((event) => event.kind === "slot_confirmed")!
export const demoResult = plumberEvents.find((event) => event.kind === "result")!

const demoSessionKey = "dirigent-demo-session"
const demoSessionChanged = "dirigent-demo-session-changed"

export function subscribeDemoSession(listener: () => void) {
  window.addEventListener(demoSessionChanged, listener)
  return () => window.removeEventListener(demoSessionChanged, listener)
}

export function readDemoSession() {
  return window.sessionStorage.getItem(demoSessionKey) ?? ""
}

export function writeDemoSession(value: string) {
  if (value) window.sessionStorage.setItem(demoSessionKey, value)
  else {
    window.sessionStorage.removeItem(demoSessionKey)
    window.sessionStorage.removeItem(exampleJobsKey)
  }
  window.dispatchEvent(new Event(demoSessionChanged))
}

export function emptyDemoSession() {
  return ""
}

const exampleJobsKey = "dirigent-example-jobs"

export function readExampleJobs() {
  return window.sessionStorage.getItem(exampleJobsKey) ?? ""
}

export function writeExampleJob(id: string, status: string) {
  const jobs = JSON.parse(readExampleJobs() || "{}") as Record<string, string>
  window.sessionStorage.setItem(exampleJobsKey, JSON.stringify({ ...jobs, [id]: status }))
  window.dispatchEvent(new Event(demoSessionChanged))
}
