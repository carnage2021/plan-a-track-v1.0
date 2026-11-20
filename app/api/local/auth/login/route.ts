import { NextResponse } from "next/server";
import { authenticate, tokenFor } from "@/lib/local/auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
  const user = body?.email && body.password ? await authenticate(body.email, body.password) : null;
  if (!user) return NextResponse.json({ error: "Invalid login or password." }, { status: 401 });
  const accessToken = await tokenFor(user);
  return NextResponse.json({ access_token: accessToken, expires_at: Math.floor(Date.now() / 1000) + 7 * 86400, user });
}
