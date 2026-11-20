import { reset } from "@/lib/store";

export function POST() {
  reset();
  return Response.json({ ok: true });
}
