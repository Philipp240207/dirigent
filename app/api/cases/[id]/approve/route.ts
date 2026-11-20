import { approvePlumberJob } from "@/lib/store";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = approvePlumberJob(id);

  if (result === "missing") return Response.json({ error: "Case not found." }, { status: 404 });
  if (result === "not_ready") {
    return Response.json({ error: "No plumber job is awaiting approval." }, { status: 409 });
  }
  return Response.json({ ok: true });
}
