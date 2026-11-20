import { randomUUID } from "node:crypto";
import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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

export function reset() {
  saveState(initialState());
}
