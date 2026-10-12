import { NextResponse } from "next/server";
import { seedSupply } from "@/lib/starter";
import { adminClient } from "@/lib/supabase/admin";

/**
 * Loads the starter ingredients, recipes, vendors and crockery into the caller's account.
 * For accounts created before phase 3; new signups get this automatically. Owner only.
 */
export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const sb = adminClient();
  const { data: auth } = await sb.auth.getUser(token);
  if (!auth.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { data: profile } = await sb.from("profiles").select("tenant_id, role").eq("id", auth.user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "This login is not linked to a catering account." }, { status: 403 });
  if (profile.role !== "owner") return NextResponse.json({ error: "Only the owner can load starter data." }, { status: 403 });
  try {
    const added = await seedSupply(sb, profile.tenant_id);
    return NextResponse.json({ ok: true, added });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not load the starter data." }, { status: 500 });
  }
}
