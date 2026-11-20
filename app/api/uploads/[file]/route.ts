import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { photoTypes, uploadsDirectory } from "@/lib/photos";
import { getState } from "@/lib/store";

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const match = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.(jpg|png|webp)$/.exec(file);
  const missingPhoto = () => Response.json({ error: "Photo not found." }, { status: 404 });
  if (!match || !getState().events.some((event) =>
    event.kind === "photo" && event.payload.url === `/api/uploads/${file}`,
  )) return missingPhoto();

  try {
    const bytes = await readFile(join(uploadsDirectory, file));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": photoTypes[match[1] as keyof typeof photoTypes],
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return missingPhoto();
    throw error;
  }
}
