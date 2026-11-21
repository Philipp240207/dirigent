import { after } from "next/server";
import { startPartnerCall } from "@/lib/plumberCall";
import { getState } from "@/lib/store";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const input = await request.json().catch(() => null);
  if (input?.partner_id !== "plumber_krause" || input.mode !== "report") {
    return Response.json({ error: "Provide the plumber partner_id and report mode." }, { status: 400 });
  }
  const { id } = await params;
  const { cases, events } = getState();
  if (!cases.some((item) => item.id === id)) {
    return Response.json({ error: "Case not found." }, { status: 404 });
  }
  const jobEvents = events.filter((event) => event.case_id === id && event.payload.partner_id === input.partner_id);
  if (!jobEvents.some((event) => event.kind === "partner_job") ||
      jobEvents.some((event) => event.kind === "result")) {
    return Response.json({ error: "The plumber job is unavailable for reporting." }, { status: 409 });
  }
  after(() => startPartnerCall(id, "plumber_krause", "report"));
  return Response.json({ ok: true });
}
