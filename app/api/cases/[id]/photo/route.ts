import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assessPhoto, maxPhotoBytes, photoExtension, photoTypes, uploadsDirectory } from "@/lib/photos";
import { addEvent, getState } from "@/lib/store";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caseExists = () => getState().cases.some((item) => item.id === id);
  const missingCase = () => Response.json({ error: "Case not found." }, { status: 404 });
  if (!caseExists()) return missingCase();

  if (Number(request.headers.get("content-length")) > maxPhotoBytes + 64 * 1024) {
    return Response.json({ error: "The photo must be 8 MiB or smaller." }, { status: 413 });
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Provide a photo in the multipart file field." }, { status: 400 });
  }
  if (file.size > maxPhotoBytes) {
    return Response.json({ error: "The photo must be 8 MiB or smaller." }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const extension = photoExtension(bytes);
  if (!extension) {
    return Response.json({ error: "Use a JPEG, PNG, or WebP photo." }, { status: 415 });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL_MAIN?.trim();
  if (!apiKey || !model) {
    return Response.json({ error: "Set OPENAI_API_KEY and OPENAI_MODEL_MAIN to enable assessment." }, { status: 503 });
  }

  let photo;
  try {
    photo = await assessPhoto(bytes, photoTypes[extension], apiKey, model);
  } catch {
    return Response.json({ error: "Photo assessment failed. Check the configured OpenAI key and vision model, then retry." }, { status: 502 });
  }
  if (!caseExists()) return missingCase();

  const { assessment, openAiEur } = photo;
  const fileName = `${randomUUID()}.${extension}`;
  const path = join(uploadsDirectory, fileName);
  const url = `/api/uploads/${fileName}`;
  mkdirSync(uploadsDirectory, { recursive: true });
  writeFileSync(path, bytes, { flag: "wx" });
  try {
    addEvent({ case_id: id, kind: "photo", actor: "dirigent", payload: { url, assessment } }, openAiEur);
  } catch (error) {
    rmSync(path, { force: true });
    throw error;
  }

  return Response.json({ url, assessment });
}
