import { updatePlumberJob } from "@/lib/store";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const input: unknown = await request.json().catch(() => null);
  if (!input || typeof input !== "object" || !("slot" in input) ||
      typeof input.slot !== "string" || !input.slot.trim()) {
    return Response.json({ error: "Invalid plumber slot." }, { status: 400 });
  }

  const { id } = await params;
  const outcome = updatePlumberJob(id, { kind: "slot_confirmed", payload: { slot: input.slot.trim() } });
  if (outcome === "missing") return Response.json({ error: "Case not found." }, { status: 404 });
  if (outcome === "conflict") {
    return Response.json({ error: "The plumber job cannot accept this update in its current state." }, { status: 409 });
  }
  return Response.json({ ok: true });
}
