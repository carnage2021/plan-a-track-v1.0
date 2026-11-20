import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { userFromToken } from "@/lib/local/auth";
import { adminPool } from "@/lib/local/database";

const root = process.env.UPLOAD_DIR ?? "/var/lib/plan-a-track/uploads";
const clean = (value: string) => value.split("/").filter((part) => part && part !== "." && part !== "..").join("/");

export async function POST(request: Request) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const user = token ? await userFromToken(token) : null;
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const profile = await adminPool.query<{ tenant_id: string }>("select tenant_id from public.profiles where id=$1", [user.id]);
  const tenantId = profile.rows[0]?.tenant_id;
  if (!tenantId) return NextResponse.json({ error: "Account profile not found." }, { status: 403 });
  const form = await request.formData();
  const file = form.get("file");
  const bucket = clean(String(form.get("bucket") ?? "media"));
  const objectPath = clean(String(form.get("path") ?? ""));
  if (!(file instanceof File) || bucket !== "media" || !objectPath.startsWith(`${tenantId}/`)) return NextResponse.json({ error: "Invalid upload path." }, { status: 400 });
  const target = path.join(root, bucket, objectPath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ path: objectPath });
}
