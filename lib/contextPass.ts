import building from "../data/building.json";
import plumber from "../connectors/plumber_krause.json";

export function buildPlumberProposal(
  unitId: string,
  affectedUnits: string[],
  ceilingLeak: boolean,
) {
  const access = building.infrastructure.access;

  // Only controlled building fields and fixed summaries enter the handoff.
  // Tenant free text can contain rent or payment information.
  const shared = {
    address: building.address,
    unit_id: unitId,
    access_info:
      `Main door code: ${access.main_door_code}. Key safe: ${access.key_safe}. Cellar key: ${access.cellar_key}.`,
    affected_units: affectedUnits,
    problem_description: ceilingLeak
      ? `Water is reported coming through the ceiling of apartment ${unitId}.`
      : `A water leak is reported in apartment ${unitId}.`,
    cost_estimate_eur: 350,
  };

  const deniedFields = new Set(plumber.handover.never);
  const allowedDetails = Object.fromEntries(
    Object.entries(shared).filter(([field]) => !deniedFields.has(field)),
  );
  const withheld = new Set([
    ...Array.from(deniedFields),
    "tenant_report_free_text",
    ...building.parties.tenants.flatMap((tenant) =>
      Object.keys(tenant).filter((field) => field !== "share_with"),
    ),
  ]);

  return {
    partner_id: plumber.partner_id,
    role: plumber.role,
    status: "awaiting_approval",
    shared: allowedDetails,
    withheld: Array.from(withheld).sort(),
    briefing: "Investigate the leak and inspect the affected units. The cost estimate is for the demo.",
  } as const;
}
