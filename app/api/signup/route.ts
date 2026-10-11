import { NextResponse } from "next/server";
import { tenantRow } from "@/lib/db";
import { defaultTenant } from "@/lib/seed";
import { seedTenant } from "@/lib/starter";
import { adminClient } from "@/lib/supabase/admin";

/**
 * Creates a caterer account: the login, the tenant, the owner's profile and the starter data.
 * It runs with the service role because a brand-new user has no tenant yet, so row-level
 * security would (correctly) refuse every one of these inserts from the browser.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { name?: string; business?: string; email?: string; password?: string; samples?: boolean } | null;
  const name = body?.name?.trim() ?? "";
  const business = body?.business?.trim() ?? "";
  const email = body?.email?.trim().toLowerCase() ?? "";
  const password = body?.password ?? "";
  if (!name || !business) return NextResponse.json({ error: "Enter your name and your business name." }, { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Use a password of at least 8 characters." }, { status: 400 });

  const sb = adminClient();
  const created = await sb.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
  if (created.error || !created.data.user) {
    const taken = /already|registered|exists/i.test(created.error?.message ?? "");
    return NextResponse.json({ error: taken ? "An account with this email already exists. Sign in instead." : (created.error?.message ?? "Could not create the account.") }, { status: taken ? 409 : 500 });
  }
  const userId = created.data.user.id;
  let tenantId: string | undefined;
  try {
    const samples = body?.samples !== false;
    // Sample accounts keep the demo contact details so documents look complete; real ones start blank.
    const base = samples ? defaultTenant : { ...defaultTenant, tagline: "", city: "", phone: "", email: "", address: "", gstin: "", bankName: "", bankAccount: "", ifsc: "", upiId: "" };
    const tenant = await sb.from("tenants").insert(tenantRow({ ...base, name: business })).select("id").single();
    if (tenant.error) throw new Error(tenant.error.message);
    tenantId = tenant.data.id as string;
    const profile = await sb.from("profiles").insert({ id: userId, tenant_id: tenantId, name, role: "owner" });
    if (profile.error) throw new Error(profile.error.message);
    await seedTenant(sb, tenantId, userId, samples);
    return NextResponse.json({ ok: true });
  } catch (e) {
    // Leave nothing half-made behind: the tenant delete cascades to everything seeded so far.
    if (tenantId) await sb.from("tenants").delete().eq("id", tenantId);
    await sb.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not set up the account." }, { status: 500 });
  }
}
