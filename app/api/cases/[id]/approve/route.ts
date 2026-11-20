import { approvePartnerJob } from "@/lib/store";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const input = await request.json().catch(() => null);
  if (typeof input?.partner_id !== "string" || !input.partner_id.trim()) {
    return Response.json({ error: "Provide partner_id." }, { status: 400 });
  }
  const { id } = await params;
  const result = approvePartnerJob(id, input.partner_id.trim());

  if (result === "missing") return Response.json({ error: "Case not found." }, { status: 404 });
  if (result === "not_ready") {
    return Response.json({ error: "No partner job is awaiting approval." }, { status: 409 });
  }
  return Response.json({ ok: true });
}
