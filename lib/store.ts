import { randomUUID } from "node:crypto";
import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import building from "../data/building.json";
import plumber from "../connectors/plumber_krause.json";
import { findRiser } from "./building";
import { now, resetClock } from "./clock";

export type CaseStatus = "open" | "pending_approval" | "dispatched" | "scheduled" | "resolved";

export type DemoCase = {
  id: string;
  type: string;
  unit_id: string;
  status: CaseStatus;
  created_at: string;
};

export type NewEvent = {
  case_id: string | null;
  kind: string;
  actor: string;
  payload: Record<string, unknown>;
};

type DemoEvent = NewEvent & { id: string; at: string };

type DemoState = {
  cases: DemoCase[];
  events: DemoEvent[];
  connectors: { partner_id: string; role: string; active: boolean }[];
};

const statePath = join(process.cwd(), "data", "state.json");
const cache = globalThis as typeof globalThis & {
  dirigentState?: DemoState;
  dirigentRetryTimers?: Set<ReturnType<typeof setTimeout>>;
};
const retryTimers = cache.dirigentRetryTimers ??= new Set();

export function scheduleRetry(delayMs: number, retry: () => void) {
  const timer = setTimeout(() => {
    retryTimers.delete(timer);
    retry();
  }, delayMs);
  retryTimers.add(timer);
}

function initialState(): DemoState {
  return {
    cases: [],
    events: [],
    connectors: [{ partner_id: plumber.partner_id, role: plumber.role, active: true }],
  };
}

function currentState(): DemoState {
  if (!cache.dirigentState) {
    try {
      cache.dirigentState = JSON.parse(readFileSync(statePath, "utf8")) as DemoState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      cache.dirigentState = initialState();
    }
  }
  return cache.dirigentState;
}

function saveState(state: DemoState) {
  const temporaryPath = `${statePath}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporaryPath, JSON.stringify(state, null, 2) + "\n");
    renameSync(temporaryPath, statePath);
    cache.dirigentState = state;
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}

export function getState(): DemoState {
  return structuredClone(currentState());
}

function stampEvent(input: NewEvent): DemoEvent {
  return { ...structuredClone(input), id: randomUUID(), at: now().toISOString() };
}

function belongsToPartner(event: NewEvent, partnerId: string) {
  const legacyUpdate = event.kind === "slot_confirmed" || event.kind === "result";
  return (event.payload.partner_id ?? (legacyUpdate ? plumber.partner_id : undefined)) === partnerId;
}

function refreshPlumberJob(events: DemoEvent[], input: NewEvent): DemoEvent[] {
  const confirmed = input.kind === "affected" && input.payload.risk === "confirmed";
  if (input.kind !== "photo" && !confirmed) return events;

  const job = events.findLast((event) => event.case_id === input.case_id &&
    belongsToPartner(event, plumber.partner_id) && event.kind === "partner_job");
  const proposal = job ?? events.findLast((event) => event.case_id === input.case_id &&
    belongsToPartner(event, plumber.partner_id) && event.kind === "partner_job_proposed");
  if (!proposal) return events;

  const shared = { ...proposal.payload.shared as Record<string, unknown> };
  if (confirmed) {
    const units = Array.isArray(shared.affected_units) ? shared.affected_units : [];
    if (units.includes(input.payload.unit_id)) return events;
    shared.affected_units = [...units, input.payload.unit_id];
  } else {
    shared.damage_photo = input.payload.url;
    shared.damage_assessment = input.payload.assessment;
  }

  const revised = { ...proposal, payload: { ...proposal.payload, shared } };
  if (!job) return [...events, stampEvent(revised)];

  const notice = stampEvent({
    case_id: input.case_id, kind: "message", actor: "dirigent",
    payload: {
      to: plumber.partner_id,
      text: confirmed
        ? `Damage has been confirmed in unit ${input.payload.unit_id}. The affected units in your job have been updated.`
        : "A new damage photo and assessment are available in your job.",
    },
  });
  return [...events.map((event) => event.id === job.id ? revised : event), notice];
}

export function addEvent(input: NewEvent): DemoEvent {
  const state = currentState();
  const event = stampEvent(input);
  saveState({ ...state, events: refreshPlumberJob([...state.events, event], event) });
  return structuredClone(event);
}

export function saveNewCase(demoCase: DemoCase, inputs: NewEvent[]) {
  const state = currentState();
  const events = inputs.map(stampEvent);
  saveState({
    ...state,
    cases: [...state.cases, structuredClone(demoCase)],
    events: [...state.events, ...events],
  });
}

export function saveLeakTimeline(caseId: string, inputs: NewEvent[]): boolean {
  const state = currentState();
  if (!state.cases.some((item) => item.id === caseId && item.status === "open")) return false;

  const pendingPhoto = state.events.findLast((event) => event.case_id === caseId && event.kind === "photo");
  const events = [...state.events, ...inputs.map(stampEvent)];
  saveState({
    ...state,
    cases: state.cases.map((item) =>
      item.id === caseId ? { ...item, status: "pending_approval" } : item,
    ),
    events: pendingPhoto ? refreshPlumberJob(events, pendingPhoto) : events,
  });
  return true;
}

export function approvePartnerJob(caseId: string, partnerId: string): "approved" | "missing" | "not_ready" {
  const state = currentState();
  const demoCase = state.cases.find((item) => item.id === caseId);
  if (!demoCase) return "missing";

  const events = state.events.filter((event) => event.case_id === caseId && belongsToPartner(event, partnerId));
  if (events.some((event) => event.kind === "partner_job")) return "approved";

  const proposal = events.findLast((event) => event.kind === "partner_job_proposed");
  if (!proposal || demoCase.status === "resolved") {
    return "not_ready";
  }

  const dispatched: DemoCase = { ...demoCase, status: "dispatched" };
  const approvalEvents: NewEvent[] = [
    {
      case_id: caseId,
      kind: "partner_job_approved",
      actor: "property_manager",
      payload: { partner_id: partnerId },
    },
    {
      case_id: caseId,
      kind: "partner_job",
      actor: "dirigent",
      payload: { ...proposal.payload, status: "sent" },
    },
    {
      case_id: caseId,
      kind: "status_change",
      actor: "dirigent",
      payload: { status: dispatched.status },
    },
  ];

  saveState({
    ...state,
    cases: state.cases.map((item) => item.id === caseId ? dispatched : item),
    events: [...state.events, ...approvalEvents.map(stampEvent)],
  });
  return "approved";
}

type PartnerUpdate =
  | { kind: "slot_confirmed"; payload: { slot: string } }
  | { kind: "result"; payload: { cost_eur: number; work_description: string } };

export function updatePartnerJob(caseId: string, partnerId: string, update: PartnerUpdate) {
  const state = currentState();
  const demoCase = state.cases.find((item) => item.id === caseId);
  if (!demoCase) return "missing";

  const events = state.events.filter((event) => event.case_id === caseId);
  const partnerEvents = events.filter((event) => belongsToPartner(event, partnerId));
  const job = partnerEvents.findLast((event) => event.kind === "partner_job");
  if (!job) return "conflict";

  const previous = partnerEvents.findLast((event) => event.kind === update.kind);
  if (previous && Object.entries(update.payload).every(([key, value]) => previous.payload[key] === value)) {
    return "ok";
  }

  const scheduled = update.kind === "slot_confirmed";
  if (previous || partnerEvents.some((event) => event.kind === "result")) return "conflict";

  const otherJobs = events.filter((event) => event.kind === "partner_job" && !belongsToPartner(event, partnerId));
  const otherJobOpen = otherJobs.some((other) => !events.some((event) =>
    event.kind === "result" && belongsToPartner(event, String(other.payload.partner_id)),
  ));
  const status = scheduled ? "scheduled" : otherJobOpen ? demoCase.status : "resolved";
  const updates: NewEvent[] = [
    { case_id: caseId, actor: "partner_call", ...update, payload: { ...update.payload, partner_id: partnerId } },
  ];
  if (update.kind === "result") {
    updates.push({
      case_id: caseId, kind: "maintenance_log", actor: "dirigent",
      payload: { unit_id: demoCase.unit_id, partner_id: partnerId, ...update.payload },
    });
  }
  if (status !== demoCase.status) {
    updates.push({ case_id: caseId, kind: "status_change", actor: "dirigent", payload: { status } });
  }

  const unitIds = new Set([demoCase.unit_id]);
  if (!scheduled) {
    for (const event of events) {
      if (event.kind === "affected" && typeof event.payload.unit_id === "string") {
        unitIds.add(event.payload.unit_id);
      }
    }
  }
  const recipients = new Set(building.units.filter((unit) => unitIds.has(unit.id)).map((unit) => unit.tenant_id));
  const partnerLabel = String(job.payload.role);
  for (const to of recipients) {
    updates.push({
      case_id: caseId, kind: "message", actor: "dirigent",
      payload: {
        to,
        text: scheduled ? `The ${partnerLabel} is scheduled for ${update.payload.slot}.` :
          `The ${partnerLabel} has completed work for unit ${demoCase.unit_id}.`,
      },
    });
  }
  if (update.kind === "result") {
    updates.push({
      case_id: caseId, kind: "message", actor: "dirigent",
      payload: {
        to: "owner",
        text: `Job ${partnerId} for unit ${demoCase.unit_id} completed for EUR ${update.payload.cost_eur}. ${update.payload.work_description}`,
      },
    });
    const riser = findRiser(demoCase.unit_id);
    if (riser && job.payload.role === "plumber" && isWaterOff(caseId)) {
      updates.push({
        case_id: caseId, kind: "message", actor: "dirigent",
        payload: {
          to: "caretaker",
          text: `The plumber has finished. Please reopen the main valve for ${riser.id} at ${riser.main_valve} and confirm once water service is restored.`,
        },
      });
    }
  }

  saveState({
    ...state,
    cases: state.cases.map((item) => item.id === caseId ? { ...item, status } : item),
    events: [...state.events, ...updates.map(stampEvent)],
  });
  return "ok";
}

export function isWaterOff(caseId: string): boolean {
  const latest = currentState().events.findLast((event) =>
    event.case_id === caseId && event.kind === "water_status_confirmed",
  );
  return latest?.payload.status === "off";
}

export function confirmWaterStatus(caseId: string, status: "off" | "restored") {
  const state = currentState();
  const demoCase = state.cases.find((item) => item.id === caseId);
  if (!demoCase) return "missing";

  const riser = findRiser(demoCase.unit_id);
  const events = state.events.filter((event) => event.case_id === caseId);
  if (!riser || !events.some((event) => event.kind === "water_shutoff_requested")) return "conflict";

  const latest = events.findLast((event) => event.kind === "water_status_confirmed");
  if (latest?.payload.status === status) return "ok";
  if (status === "off" ? latest || demoCase.status === "resolved" :
    latest?.payload.status !== "off" || !events.some((event) => event.kind === "result" && belongsToPartner(event, plumber.partner_id))) {
    return "conflict";
  }

  const updates: NewEvent[] = [{
    case_id: caseId, kind: "water_status_confirmed", actor: "caretaker",
    payload: { riser_id: riser.id, status },
  }];
  const recipients = new Set(building.units.filter((unit) => riser.units.includes(unit.id)).map((unit) => unit.tenant_id));
  for (const to of recipients) {
    updates.push({
      case_id: caseId, kind: "message", actor: "dirigent",
      payload: {
        to,
        text: status === "off"
          ? "The water on your riser is off for now while the leak is repaired."
          : "The water on your riser is back on.",
      },
    });
  }
  saveState({ ...state, events: [...state.events, ...updates.map(stampEvent)] });
  return "ok";
}

export function reset() {
  saveState(initialState());
  for (const timer of retryTimers) clearTimeout(timer);
  retryTimers.clear();
  resetClock();
}
