import { randomUUID } from "node:crypto";
import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import building from "../data/building.json";
import plumber from "../connectors/plumber_krause.json";
import { findAffectedUnits, findRiser } from "./building";
import { now, resetClock } from "./clock";
import { buildCostPayload } from "./cost";

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

type StoredState = DemoState & { openAiCostByCase?: Record<string, number> };

const statePath = join(process.cwd(), "data", "state.json");
const cache = globalThis as typeof globalThis & {
  dirigentState?: StoredState;
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

function currentState(): StoredState {
  if (!cache.dirigentState) {
    try {
      cache.dirigentState = JSON.parse(readFileSync(statePath, "utf8")) as StoredState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      cache.dirigentState = initialState();
    }
  }
  return cache.dirigentState;
}

function saveState(state: StoredState) {
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
  const { cases, events, connectors } = currentState();
  return structuredClone({ cases, events, connectors });
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

  const payload = { ...proposal.payload, shared } as NewEvent["payload"];
  if (confirmed && !job && typeof input.payload.unit_id === "string") {
    const units = Array.isArray(payload.water_shutoff_units) ? payload.water_shutoff_units : [shared.unit_id];
    payload.water_shutoff_units = [...new Set([...units, input.payload.unit_id])];
  }
  const revised = { ...proposal, payload };
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

function appendCaseCost(state: StoredState, caseId: string): StoredState {
  const events = state.events.filter((event) => event.case_id === caseId);
  const seconds = events.reduce((total, event) => {
    const duration = event.payload.duration_s;
    return event.kind === "call_ended" && typeof duration === "number" &&
      Number.isFinite(duration) && duration > 0 ? total + duration : total;
  }, 0);
  const payload = buildCostPayload(seconds, state.openAiCostByCase?.[caseId] ?? 0);
  const previous = events.findLast((event) => event.kind === "cost");
  if (previous && JSON.stringify(previous.payload) === JSON.stringify(payload)) return state;

  const event = stampEvent({ case_id: caseId, kind: "cost", actor: "dirigent", payload });
  return { ...state, events: [...state.events, event] };
}

export function addEvent(input: NewEvent, openAiEur = 0): DemoEvent {
  const state = currentState();
  const event = stampEvent(input);
  const next = { ...state, events: refreshPlumberJob([...state.events, event], event) };
  const caseId = input.case_id;
  if (caseId && openAiEur > 0) {
    next.openAiCostByCase = {
      ...state.openAiCostByCase,
      [caseId]: (state.openAiCostByCase?.[caseId] ?? 0) + openAiEur,
    };
  }

  const affectsCost = input.kind === "call_ended" || openAiEur > 0;
  saveState(caseId && affectsCost && state.cases.some((item) => item.id === caseId && item.status === "resolved")
    ? appendCaseCost(next, caseId) : next);
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

export function approvePartnerJob(caseId: string, partnerId: string): "approved" | "already_approved" | "missing" | "not_ready" {
  const state = currentState();
  const demoCase = state.cases.find((item) => item.id === caseId);
  if (!demoCase) return "missing";

  const events = state.events.filter((event) => event.case_id === caseId && belongsToPartner(event, partnerId));
  if (events.some((event) => event.kind === "partner_job")) return "already_approved";

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

  const riser = partnerId === plumber.partner_id && demoCase.type === "water_leak"
    ? findRiser(demoCase.unit_id) : null;
  if (riser) {
    const proposedUnits = Array.isArray(proposal.payload.water_shutoff_units)
      ? proposal.payload.water_shutoff_units : [];
    const units = [...new Set([demoCase.unit_id, ...proposedUnits])]
      .filter((unit): unit is string => typeof unit === "string" && riser.units.includes(unit));
    approvalEvents.push(
      { case_id: caseId, kind: "water_shutoff_requested", actor: "dirigent", payload: { riser_id: riser.id, units } },
      {
        case_id: caseId, kind: "message", actor: "dirigent",
        payload: {
          to: "caretaker",
          text: `Bitte Wasser in Wohnung ${units.join(" und ")} am Absperrventil der Wohnung abstellen.`,
        },
      },
    );
  }

  saveState({
    ...state,
    cases: state.cases.map((item) => item.id === caseId ? dispatched : item),
    events: [...state.events, ...approvalEvents.map(stampEvent)],
  });
  return "approved";
}

export function proposePartnerSlot(caseId: string, partnerId: string, slot: string) {
  const state = currentState();
  if (!state.cases.some(({ id }) => id === caseId)) return "missing";
  const events = state.events.filter((event) => event.case_id === caseId && belongsToPartner(event, partnerId));
  if (!events.some((event) => event.kind === "partner_job") ||
      events.some((event) => event.kind === "slot_confirmed" || event.kind === "result")) return "conflict";

  const previous = events.findLast((event) => event.kind === "slot_proposed");
  if (previous?.payload.slot === slot) return "ok";
  addEvent({ case_id: caseId, kind: "slot_proposed", actor: "partner_call", payload: { partner_id: partnerId, slot } });
  return "ok";
}

export function confirmPartnerSlot(caseId: string, partnerId: string) {
  const state = currentState();
  if (!state.cases.some(({ id }) => id === caseId)) return "missing";
  const proposal = state.events.findLast((event) => event.case_id === caseId &&
    event.kind === "slot_proposed" && belongsToPartner(event, partnerId));
  const slot = proposal?.payload.slot;
  if (typeof slot !== "string" || !slot.trim()) return "conflict";
  return updatePartnerJob(caseId, partnerId, { kind: "slot_confirmed", payload: { slot } });
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
  const plumberAppointment = scheduled && job.payload.role === "plumber";
  if (plumberAppointment) {
    const { affected } = findAffectedUnits(demoCase.unit_id, demoCase.type);
    for (const unit of affected) {
      if (unit.risk === "high") unitIds.add(unit.unit_id);
    }
  }
  if (!scheduled) {
    for (const event of events) {
      if (event.kind === "affected" && typeof event.payload.unit_id === "string") {
        unitIds.add(event.payload.unit_id);
      }
    }
  }
  const recipients = new Set(building.units.filter((unit) => unitIds.has(unit.id)).map((unit) => unit.tenant_id));
  if (plumberAppointment) recipients.add(building.parties.caretaker.id);
  const partnerLabel = String(job.payload.role);
  const reportingTenant = building.units.find((unit) => unit.id === demoCase.unit_id)?.tenant_id;
  const appointment = update.kind === "slot_confirmed" && /^\d{1,2}:\d{2}$/.test(update.payload.slot)
    ? `um ${update.payload.slot}` : update.kind === "slot_confirmed" ? update.payload.slot : "";
  for (const to of recipients) {
    updates.push({
      case_id: caseId, kind: "message", actor: "dirigent",
      payload: {
        to,
        text: update.kind === "slot_confirmed"
          ? plumberAppointment
            ? to === building.parties.caretaker.id
              ? `Bitte ${appointment} vor Ort sein und ${[...unitIds].join(" und ")} für Sanitär Krause aufschließen.`
              : `Der Installateur kommt ${appointment}. Sie müssen nicht zu Hause sein, der Hausmeister schließt auf.`
            : `The ${partnerLabel} is scheduled for ${update.payload.slot}.`
          :
          job.payload.role === "plumber" && to === reportingTenant
            ? "Auftrag abgeschlossen."
            : `The ${partnerLabel} has completed work for unit ${demoCase.unit_id}.`,
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
    const shutoff = events.findLast((event) => event.kind === "water_status_confirmed");
    const units = shutoff?.payload.units;
    if (job.payload.role === "plumber" && shutoff?.payload.status === "off" && Array.isArray(units)) {
      updates.push({
        case_id: caseId, kind: "message", actor: "dirigent",
        payload: {
          to: "caretaker",
          text: `Bitte Wasser in Wohnung ${units.join(" und ")} am Absperrventil der Wohnung wieder anstellen und bestätigen.`,
        },
      });
    }
  }

  const next = {
    ...state,
    cases: state.cases.map((item) => item.id === caseId ? { ...item, status } : item),
    events: [...state.events, ...updates.map(stampEvent)],
  };
  saveState(status === "resolved" ? appendCaseCost(next, caseId) : next);
  return "ok";
}

export function confirmWaterStatus(caseId: string, status: "off" | "restored") {
  const state = currentState();
  const demoCase = state.cases.find((item) => item.id === caseId);
  if (!demoCase) return "missing";

  const events = state.events.filter((event) => event.case_id === caseId);
  const request = events.findLast((event) => event.kind === "water_shutoff_requested");
  const riser = findRiser(demoCase.unit_id);
  const requestedUnits = request?.payload.units;
  if (!riser || !Array.isArray(requestedUnits) || request?.payload.riser_id !== riser.id) return "conflict";

  const units = requestedUnits.filter((unit): unit is string => typeof unit === "string" && riser.units.includes(unit));
  if (!units.length) return "conflict";

  const latest = events.findLast((event) => event.kind === "water_status_confirmed");
  if (latest?.payload.status === status) return "ok";
  if (status === "off" ? latest || demoCase.status === "resolved" :
    latest?.payload.status !== "off" || !events.some((event) => event.kind === "result" && belongsToPartner(event, plumber.partner_id))) {
    return "conflict";
  }

  const updates: NewEvent[] = [{
    case_id: caseId, kind: "water_status_confirmed", actor: "caretaker",
    payload: { riser_id: riser.id, units, status },
  }];
  const recipients = new Set(building.units.filter((unit) => units.includes(unit.id)).map((unit) => unit.tenant_id));
  for (const to of recipients) {
    updates.push({
      case_id: caseId, kind: "message", actor: "dirigent",
      payload: {
        to,
        text: status === "off"
          ? "Wasser ist vorübergehend abgestellt."
          : "Das Wasser ist wieder an.",
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
