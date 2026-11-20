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

export function addEvent(input: NewEvent): DemoEvent {
  const state = currentState();
  const event = { ...structuredClone(input), id: randomUUID(), at: new Date().toISOString() };
  saveState({ ...state, events: [...state.events, event] });
  return structuredClone(event);
}

export function saveNewCase(demoCase: DemoCase, inputs: NewEvent[]) {
  const state = currentState();
  const events = inputs.map((input) => ({
    ...structuredClone(input),
    id: randomUUID(),
    at: new Date().toISOString(),
  }));
  saveState({
    ...state,
    cases: [...state.cases, structuredClone(demoCase)],
    events: [...state.events, ...events],
  });
}

export function reset() {
  saveState(initialState());
}
