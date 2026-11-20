import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.env.UPLOAD_DIR ?? "/var/lib/plan-a-track/uploads";
const clean = (parts: string[]) => parts.filter((part) => part && part !== "." && part !== "..");
const type = (name: string) => name.endsWith(".png") ? "image/png" : name.endsWith(".webp") ? "image/webp" : name.endsWith(".gif") ? "image/gif" : name.endsWith(".pdf") ? "application/pdf" : "image/jpeg";

export async function GET(_request: Request, context: { params: Promise<{ bucket: string; path: string[] }> }) {
  const params = await context.params;
  if (params.bucket !== "media") return new Response("Not found", { status: 404 });
  const parts = clean(params.path);
  if (parts.length !== params.path.length) return new Response("Not found", { status: 404 });
  try {
    const body = await readFile(path.join(root, "media", ...parts));
    return new Response(body, { headers: { "Content-Type": type(parts.at(-1) ?? ""), "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch { return new Response("Not found", { status: 404 }); }
}
