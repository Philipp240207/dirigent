import { randomUUID } from "node:crypto";
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { after } from "next/server";
import { now } from "@/lib/clock";
import { buildLeakTimeline } from "@/lib/dirigent";
import { uploadsDirectory } from "@/lib/photos";
import { startPartnerCall } from "@/lib/plumberCall";
import { addEvent, approvePartnerJob, saveNewCase, type DemoCase, type NewEvent } from "@/lib/store";

export function POST() {
  if (process.env.NEXT_PUBLIC_MOCK === "true") {
    return Response.json({ error: "Demo shortcut is unavailable in mock mode." }, { status: 404 });
  }

  const id = randomUUID();
  const demoCase: DemoCase = {
    id, type: "water_leak", unit_id: "3.1", status: "pending_approval", created_at: now().toISOString(),
  };
  const description = "Water is dripping from the living-room ceiling.";
  const filename = `${randomUUID()}.jpg`;
  mkdirSync(uploadsDirectory, { recursive: true });
  copyFileSync(join(process.cwd(), "fixtures", "demo-ceiling.jpg"), join(uploadsDirectory, filename));

  const event = (kind: string, payload: NewEvent["payload"]): NewEvent =>
    ({ case_id: id, kind, actor: "dirigent", payload });
  const { events } = buildLeakTimeline(demoCase, description);
  saveNewCase(demoCase, [
    { ...event("case_created", { type: demoCase.type, unit_id: "3.1", tenant_id: "t31", description }), actor: "tenant" },
    event("affected", { unit_id: "3.1", risk: "confirmed" }),
    ...events,
  ]);
  addEvent(event("photo", {
    url: `/api/uploads/${filename}`,
    assessment: { damage: "Visible water stain on the ceiling", severity: 4, urgent: true, electrics: false },
  }));
  addEvent(event("call_started", {
    to_tenant_id: "t21", language: "de", purpose: "Check for water damage below the reported leak.",
    attempt: 1, dry_run: true,
  }));
  addEvent(event("call_ended", {
    to_tenant_id: "t21", attempt: 1, outcome: "answered", damage_found: true,
    duration_s: 0, summary: "Simulated report of a wet ceiling.",
  }));
  addEvent(event("affected", { unit_id: "2.1", risk: "confirmed" }));

  const partnerId = "plumber_krause";
  if (approvePartnerJob(id, partnerId) !== "approved") {
    return Response.json({ error: "The demo plumber job could not be approved." }, { status: 500 });
  }
  after(() => startPartnerCall(id, partnerId, "dispatch"));
  return Response.json({ case_id: id });
}
