import { confirmWaterStatus } from "@/lib/store";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const input = await request.json().catch(() => null);
  if (input?.status !== "off" && input?.status !== "restored") {
    return Response.json({ error: "Provide status off or restored." }, { status: 400 });
  }

  const { id } = await params;
  const result = confirmWaterStatus(id, input.status);
  if (result === "missing") return Response.json({ error: "Case not found." }, { status: 404 });
  if (result === "conflict") {
    return Response.json({ error: "The case is not ready for this water status confirmation." }, { status: 409 });
  }
  return Response.json({ ok: true });
}
