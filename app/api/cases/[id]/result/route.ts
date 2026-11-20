import { updatePlumberJob } from "@/lib/store";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const input: unknown = await request.json().catch(() => null);
  if (!input || typeof input !== "object" || !("cost_eur" in input) ||
      typeof input.cost_eur !== "number" || !Number.isFinite(input.cost_eur) || input.cost_eur < 0 ||
      !("work_description" in input) || typeof input.work_description !== "string" ||
      !input.work_description.trim()) {
    return Response.json({ error: "Invalid plumber result." }, { status: 400 });
  }

  const { id } = await params;
  const outcome = updatePlumberJob(id, {
    kind: "result",
    payload: { cost_eur: input.cost_eur, work_description: input.work_description.trim() },
  });
  if (outcome === "missing") return Response.json({ error: "Case not found." }, { status: 404 });
  if (outcome === "conflict") {
    return Response.json({ error: "The plumber job cannot accept this update in its current state." }, { status: 409 });
  }
  return Response.json({ ok: true });
}
