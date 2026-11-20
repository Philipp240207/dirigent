import { getState } from "@/lib/store";

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const caseId = searchParams.get("case_id");
  const partnerId = searchParams.get("partner_id");
  const headers = { "Cache-Control": "no-store" };
  if (!caseId || !partnerId) return Response.json({ error: "Provide case_id and partner_id." }, { status: 400, headers });

  const { cases, events } = getState();
  const demoCase = cases.find((item) => item.id === caseId);
  if (!demoCase) return Response.json({ error: "Case not found." }, { status: 404, headers });

  const job = events.findLast((event) => event.case_id === caseId &&
    event.kind === "partner_job" && event.payload.partner_id === partnerId);
  if (!job) {
    return Response.json({ error: "The job has not been released." }, { status: 403, headers });
  }

  const { partner_id, role, status, shared, withheld, briefing } = job.payload;
  return Response.json({
    case: {
      id: demoCase.id,
      type: demoCase.type,
      unit_id: demoCase.unit_id,
      status: demoCase.status,
      created_at: demoCase.created_at,
    },
    partner_id, role, status, shared, withheld, briefing,
  }, { headers });
}
