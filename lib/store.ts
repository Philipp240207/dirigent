import { randomUUID } from "node:crypto";
import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import building from "../data/building.json";
import plumber from "../connectors/plumber_krause.json";

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
const cache = globalThis as typeof globalThis & { dirigentState?: DemoState };

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
  return { ...structuredClone(input), id: randomUUID(), at: new Date().toISOString() };
}

export function addEvent(input: NewEvent): DemoEvent {
  const state = currentState();
  const event = stampEvent(input);
  saveState({ ...state, events: [...state.events, event] });
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

export function approvePlumberJob(caseId: string): "approved" | "missing" | "not_ready" {
  const state = currentState();
  const demoCase = state.cases.find((item) => item.id === caseId);
  if (!demoCase) return "missing";

  const events = state.events.filter((event) => event.case_id === caseId);
  if (events.some((event) => event.kind === "partner_job")) return "approved";

  const proposal = events.findLast((event) => event.kind === "partner_job_proposed");
  if (demoCase.status !== "pending_approval" || !proposal ||
      proposal.payload.partner_id !== plumber.partner_id ||
      proposal.payload.status !== "awaiting_approval") {
    return "not_ready";
  }

  const dispatched: DemoCase = { ...demoCase, status: "dispatched" };
  const approvalEvents: NewEvent[] = [
    {
      case_id: caseId,
      kind: "partner_job_approved",
      actor: "property_manager",
      payload: { partner_id: plumber.partner_id },
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

type PlumberUpdate =
  | { kind: "slot_confirmed"; payload: { slot: string } }
  | { kind: "result"; payload: { cost_eur: number; work_description: string } };

export function updatePlumberJob(caseId: string, update: PlumberUpdate) {
  const state = currentState();
  const demoCase = state.cases.find((item) => item.id === caseId);
  if (!demoCase) return "missing";

  const events = state.events.filter((event) => event.case_id === caseId);
  if (!events.some((event) => event.kind === "partner_job" &&
      event.payload.partner_id === plumber.partner_id)) return "conflict";

  const previous = events.findLast((event) => event.kind === update.kind);
  if (previous && Object.entries(update.payload).every(([key, value]) => previous.payload[key] === value)) {
    return "ok";
  }

  const scheduled = update.kind === "slot_confirmed";
  if (demoCase.status !== "dispatched" && (scheduled || demoCase.status !== "scheduled")) {
    return "conflict";
  }

  const status = scheduled ? "scheduled" : "resolved";
  const updates: NewEvent[] = [
    { case_id: caseId, actor: "partner_call", ...update },
  ];
  if (update.kind === "result") {
    updates.push({
      case_id: caseId, kind: "maintenance_log", actor: "dirigent",
      payload: { unit_id: demoCase.unit_id, partner_id: plumber.partner_id, ...update.payload },
    });
  }
  updates.push({ case_id: caseId, kind: "status_change", actor: "dirigent", payload: { status } });

  const unitIds = new Set([demoCase.unit_id]);
  if (!scheduled) {
    for (const event of events) {
      if (event.kind === "affected" && typeof event.payload.unit_id === "string") {
        unitIds.add(event.payload.unit_id);
      }
    }
  }
  const recipients = new Set(building.units.filter((unit) => unitIds.has(unit.id)).map((unit) => unit.tenant_id));
  for (const to of recipients) {
    updates.push({
      case_id: caseId, kind: "message", actor: "dirigent",
      payload: {
        to,
        text: scheduled ? `The plumber is scheduled for ${update.payload.slot}.` :
          `The plumbing repair for unit ${demoCase.unit_id} is complete.`,
      },
    });
  }
  if (update.kind === "result") {
    updates.push({
      case_id: caseId, kind: "message", actor: "dirigent",
      payload: {
        to: "owner",
        text: `Plumbing repair for unit ${demoCase.unit_id} completed for EUR ${update.payload.cost_eur}. ${update.payload.work_description}`,
      },
    });
  }

  saveState({
    ...state,
    cases: state.cases.map((item) => item.id === caseId ? { ...item, status } : item),
    events: [...state.events, ...updates.map(stampEvent)],
  });
  return "ok";
}

export function reset() {
  saveState(initialState());
}
