import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

/*
 * Staff logins, created by the owner: a login ID and a password, no email needed. Supabase Auth still
 * wants an email, so the ID is stored as <id>@staff.invalid (a domain that can never receive mail).
 * Only the owner of a business may call this, and only for people in that business.
 */

const roles = ["owner", "sales", "operations", "kitchen", "store", "accountant"];
const staffEmail = (id: string) => `${id}@staff.invalid`;
const validId = (id: string) => /^[a-z0-9][a-z0-9._-]{2,29}$/.test(id);

async function owner(request: Request, sb: ReturnType<typeof adminClient>) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const { data } = token ? await sb.auth.getUser(token) : { data: { user: null } };
  if (!data.user) return null;
  const { data: p } = await sb.from("profiles").select("tenant_id, role").eq("id", data.user.id).maybeSingle();
  return p?.role === "owner" ? { id: data.user.id, tenantId: p.tenant_id as string } : null;
}

export async function GET(request: Request) {
  const sb = adminClient();
  const me = await owner(request, sb);
  if (!me) return NextResponse.json({ error: "Only the owner can manage logins." }, { status: 403 });
  const { data: team } = await sb.from("profiles").select("id, branch_id").eq("tenant_id", me.tenantId);
  // The login each person signs in with: their staff ID, or their email for the owner.
  const logins: Record<string, string> = {};
  for (const p of team ?? []) {
    const { data } = await sb.auth.admin.getUserById(p.id);
    const email = data.user?.email ?? "";
    logins[p.id] = email.endsWith("@staff.invalid") ? email.replace("@staff.invalid", "") : email;
  }
  const branches = Object.fromEntries((team ?? []).map((p) => [p.id, p.branch_id ?? ""]));
  return NextResponse.json({ logins, branches });
}

/* eslint-disable @typescript-eslint/no-explicit-any -- the body is checked field by field */
export async function POST(request: Request) {
  const sb = adminClient();
  const me = await owner(request, sb);
  if (!me) return NextResponse.json({ error: "Only the owner can manage logins." }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as Record<string, any>;
  const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
  const password = String(body.password ?? "");
  const member = async () => {
    const { data } = await sb.from("profiles").select("id, role").eq("id", String(body.userId)).eq("tenant_id", me.tenantId).maybeSingle();
    return data;
  };

  switch (body.action) {
    case "create": {
      const loginId = String(body.loginId ?? "").trim().toLowerCase();
      const name = String(body.name ?? "").trim();
      if (!name) return fail("Enter the person's name.");
      if (!validId(loginId)) return fail("Login ID: 3 to 30 letters or numbers; dots, dashes and underscores allowed.");
      if (password.length < 8) return fail("Use a password of at least 8 characters.");
      if (!roles.includes(body.role) || body.role === "owner") return fail("Choose a role.");
      // Seats come from the plan: included users plus any extra users bought.
      const { data: t } = await sb.from("tenants").select("plan_id, extra_users").eq("id", me.tenantId).single();
      if (t?.plan_id) {
        const { data: plan } = await sb.from("plans").select("included_users").eq("id", t.plan_id).single();
        const { count } = await sb.from("profiles").select("id", { count: "exact", head: true }).eq("tenant_id", me.tenantId);
        if (plan && (count ?? 0) >= plan.included_users + (t.extra_users ?? 0)) return fail(`Your plan includes ${plan.included_users + (t.extra_users ?? 0)} team members. Add extra users from Plan and billing.`);
      }
      const created = await sb.auth.admin.createUser({ email: staffEmail(loginId), password, email_confirm: true, user_metadata: { name, login_id: loginId } });
      if (created.error || !created.data.user) return fail(/already|registered|exists/i.test(created.error?.message ?? "") ? `The login ID "${loginId}" is taken. Try adding your business name, like ${loginId}.${String(body.suffix ?? "team")}.` : (created.error?.message ?? "Could not create the login."), 409);
      const profile = await sb.from("profiles").insert({ id: created.data.user.id, tenant_id: me.tenantId, name, phone: String(body.phone ?? ""), role: body.role });
      if (profile.error) {
        await sb.auth.admin.deleteUser(created.data.user.id);
        return fail(profile.error.message, 500);
      }
      if (body.inviteId) await sb.from("team_invites").delete().eq("id", String(body.inviteId)).eq("tenant_id", me.tenantId);
      return NextResponse.json({ ok: true, id: created.data.user.id });
    }
    case "reset_password": {
      const m = await member();
      if (!m) return fail("Not in your team.", 404);
      if (password.length < 8) return fail("Use a password of at least 8 characters.");
      const { error } = await sb.auth.admin.updateUserById(m.id, { password });
      return error ? fail(error.message, 500) : NextResponse.json({ ok: true });
    }
    case "set_role": {
      const m = await member();
      if (!m || m.id === me.id) return fail("You cannot change your own role.");
      if (!roles.includes(body.role) || body.role === "owner") return fail("Choose a role.");
      const { error } = await sb.from("profiles").update({ role: body.role }).eq("id", m.id);
      return error ? fail(error.message, 500) : NextResponse.json({ ok: true });
    }
    case "set_branch": {
      const m = await member();
      if (!m) return fail("Not in your team.", 404);
      const branchId = body.branchId ? String(body.branchId) : null;
      if (branchId) {
        const { data: b } = await sb.from("branches").select("id").eq("id", branchId).eq("tenant_id", me.tenantId).maybeSingle();
        if (!b) return fail("Unknown branch.");
      }
      const { error } = await sb.from("profiles").update({ branch_id: branchId }).eq("id", m.id);
      return error ? fail(error.message, 500) : NextResponse.json({ ok: true });
    }
    case "remove": {
      const m = await member();
      if (!m || m.id === me.id) return fail("You cannot remove yourself.");
      // Deleting the login removes the profile with it; their past work keeps the record with no name attached.
      const { error } = await sb.auth.admin.deleteUser(m.id);
      return error ? fail(error.message, 500) : NextResponse.json({ ok: true });
    }
    default:
      return fail("Unknown action.");
  }
}
