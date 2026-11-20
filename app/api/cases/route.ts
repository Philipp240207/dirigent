import { randomUUID } from "node:crypto";
import building from "@/data/building.json";
import { buildLeakTimeline } from "@/lib/dirigent";
import { saveNewCase, type DemoCase } from "@/lib/store";

export async function POST(request: Request) {
  const input: unknown = await request.json().catch(() => null);
  if (!input || typeof input !== "object" ||
      !("unit_id" in input) || typeof input.unit_id !== "string" ||
      !("description" in input) || typeof input.description !== "string" ||
      !input.description.trim() ||
      !("tenant_language" in input) || typeof input.tenant_language !== "string" ||
      !input.tenant_language.trim()) {
    return Response.json({ error: "Provide unit_id, description, and tenant_language." }, { status: 400 });
  }

  const unit = building.units.find((flat) => flat.id === input.unit_id);
  if (!unit) return Response.json({ error: "Unknown apartment." }, { status: 404 });

  const demoCase: DemoCase = {
    id: randomUUID(),
    type: "water_leak",
    unit_id: unit.id,
    status: "open",
    created_at: new Date().toISOString(),
  };

  const timeline = buildLeakTimeline(demoCase, input.description);
  saveNewCase({ ...demoCase, status: "pending_approval" }, [
    {
      case_id: demoCase.id,
      kind: "case_created",
      actor: "tenant",
      payload: {
        type: demoCase.type,
        unit_id: unit.id,
        tenant_id: unit.tenant_id,
        description: input.description.trim(),
      },
    },
    ...timeline,
  ]);

  return Response.json({ case_id: demoCase.id });
}
