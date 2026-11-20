import { getState } from "@/lib/store";

export function GET(request: Request) {
  const caseId = new URL(request.url).searchParams.get("case_id");
  const headers = { "Cache-Control": "no-store" };
  if (!caseId) return Response.json({ error: "Provide case_id." }, { status: 400, headers });

  const { cases, events } = getState();
  const demoCase = cases.find((item) => item.id === caseId);
  if (!demoCase) return Response.json({ error: "Case not found." }, { status: 404, headers });

  const job = events.find((event) => event.case_id === caseId &&
    event.kind === "partner_job" && event.payload.status === "sent");
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
