import building from "../data/building.json";
import { findAffectedUnits } from "./building";
import { type ResidentCall } from "./calls";
import { buildPlumberProposal } from "./contextPass";
import type { DemoCase, NewEvent } from "./store";

export function buildLeakTimeline(demoCase: DemoCase, description: string) {
  const { id, unit_id, type } = demoCase;
  const ceilingLeak = /\b(?:ceiling|zimmerdecke|decke|plafond)\b/i.test(description);
  const { affected, likelySource } = findAffectedUnits(unit_id, type, { ceilingLeak });
  const events: NewEvent[] = [];
  const residentCalls: ResidentCall[] = [];
  const record = (kind: string, payload: NewEvent["payload"]) => {
    events.push({ case_id: id, kind, actor: "dirigent", payload });
  };

  for (const unit of affected) {
    record("affected", unit);
    if (unit.risk !== "high") continue;

    const residentUnit = building.units.find((flat) => flat.id === unit.unit_id);
    const resident = building.parties.tenants.find((tenant) => tenant.id === residentUnit?.tenant_id);
    if (!resident) continue;

    const purpose = `High water risk: ${unit.unit_id} is directly below ${unit_id} on the same riser.`;
    const call: ResidentCall = {
      caseId: id,
      tenantId: resident.id,
      unitId: unit.unit_id,
      name: resident.name,
      language: resident.language,
      phoneEnv: resident.phone_env,
      purpose,
    };
    record("reasoning", { text: `Queuing a resident call to ${unit.unit_id}. ${purpose}` });
    residentCalls.push(call);
  }

  if (likelySource) {
    const source = building.units.find((unit) => unit.id === likelySource.unit_id);
    if (source) {
      record("reasoning", { text: `Likely source ${source.id}. ${likelySource.reason}` });
      record("message", {
        to: source.tenant_id,
        text: "Water is coming through the ceiling of the apartment below yours. Could you check for any signs of a leak and let property management know what you find? Please confirm when you can provide access if we arrange a plumber visit.",
      });
    }
  }

  record("partner_job_proposed", buildPlumberProposal(
    unit_id,
    affected.filter((unit) => unit.risk !== "source").map((unit) => unit.unit_id),
    ceilingLeak,
  ));
  record("status_change", { status: "pending_approval" });

  return { events, residentCalls };
}
