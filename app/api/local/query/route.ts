import { NextResponse } from "next/server";
import { userFromToken } from "@/lib/local/auth";
import { executeQuery } from "@/lib/local/database";
import type { QueryRequest } from "@/lib/local/protocol";

export async function POST(request: Request) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const user = token ? await userFromToken(token) : null;
  const body = (await request.json().catch(() => null)) as QueryRequest | null;
  if (!body?.action) return NextResponse.json({ data: null, error: { message: "Invalid database request." } }, { status: 400 });
  const result = await executeQuery(body, { userId: user?.id ?? null });
  return NextResponse.json(result, { status: result.error ? 400 : 200 });
}
