import { confirmPartnerSlot } from "@/lib/store";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const input = await request.json().catch(() => null);
  if (typeof input?.partner_id !== "string" || !input.partner_id.trim()) {
    return Response.json({ error: "Provide partner_id." }, { status: 400 });
  }

  const { id } = await params;
  const result = confirmPartnerSlot(id, input.partner_id.trim());
  if (result === "missing") return Response.json({ error: "Case not found." }, { status: 404 });
  if (result === "conflict") {
    return Response.json({ error: "No appointment proposal can be confirmed for this partner." }, { status: 409 });
  }
  return Response.json({ ok: true });
}
