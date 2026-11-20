import { NextResponse } from "next/server";
import { resetPasswordWithToken } from "@/lib/local/auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { token?: string; password?: string } | null;
  const token = body?.token ?? "";
  const password = body?.password ?? "";
  if (password.length < 8 || password.length > 128) {
    return NextResponse.json({ error: "Use a password between 8 and 128 characters." }, { status: 400 });
  }
  if (!token || !(await resetPasswordWithToken(token, password))) {
    return NextResponse.json({ error: "This reset link is invalid, expired or has already been used." }, { status: 400 });
  }
  return NextResponse.json({ updated: true });
}
