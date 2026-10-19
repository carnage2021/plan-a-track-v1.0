import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

/*
 * The super admin API (plan A1). Every call proves who is calling with their own login token and must
 * belong to platform_admins; only then does it use the service role. Each change is written to admin_audit.
 */

type Sb = ReturnType<typeof adminClient>;

async function caller(request: Request, sb: Sb) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!token) return null;
  const { data } = await sb.auth.getUser(token);
  if (!data.user) return null;
  const { data: row } = await sb.from("platform_admins").select("user_id").eq("user_id", data.user.id).maybeSingle();
  return row ? data.user : null;
}

/** Calendar dates in India, whatever time zone the server runs in. */
const iso = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
const fy = (d = new Date()) => {
  const [y, m] = iso(d).split("-").map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${String(start).slice(2)}-${String(start + 1).slice(2)}`;
};

export async function GET(request: Request) {
  const sb = adminClient();
  const me = await caller(request, sb);
  if (!me) return NextResponse.json({ error: "Platform admins only." }, { status: 403 });

  const monthStart = `${iso(new Date()).slice(0, 7)}-01`;
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [tenants, profiles, users, events, orders, plans, invoices, tickets, announcements, changelog, audit, activity] = await Promise.all([
    sb.from("tenants").select("id,name,city,phone,email,status,plan_id,trial_ends_at,paid_until,billing_cycle,addons,extra_users,created_at").order("created_at", { ascending: false }),
    sb.from("profiles").select("id,tenant_id,name,role"),
    sb.auth.admin.listUsers({ perPage: 1000 }),
    sb.from("event_functions").select("tenant_id").gte("event_date", monthStart).not("order_id", "is", null).range(0, 99999),
    sb.from("orders").select("tenant_id,created_at").range(0, 99999),
    sb.from("plans").select("*").order("sort"),
    sb.from("subscription_invoices").select("*").order("created_at", { ascending: false }).limit(300),
    sb.from("support_tickets").select("*").order("created_at", { ascending: false }).limit(300),
    sb.from("announcements").select("*").order("created_at", { ascending: false }),
    sb.from("changelog").select("*").order("published_on", { ascending: false }),
    sb.from("admin_audit").select("*").order("at", { ascending: false }).limit(200),
    sb.from("activity_log").select("table_name").gte("at", since).range(0, 49999),
  ]);
  const failed = [tenants, profiles, plans, invoices, tickets, announcements, changelog, audit].find((r) => r.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });

  const login = new Map((users.data?.users ?? []).map((u) => [u.id, { email: u.email ?? "", last: u.last_sign_in_at ?? null }]));
  const count = (rows: { tenant_id: string }[] | null) => (rows ?? []).reduce((m, r) => m.set(r.tenant_id, (m.get(r.tenant_id) ?? 0) + 1), new Map<string, number>());
  const eventsBy = count(events.data);
  const ordersBy = count(orders.data);
  const ordersThisMonth = count((orders.data ?? []).filter((o) => o.created_at >= monthStart));
  const accounts = (tenants.data ?? []).map((t) => {
    const team = (profiles.data ?? []).filter((p) => p.tenant_id === t.id);
    const owner = team.find((p) => p.role === "owner");
    const lasts = team.map((p) => login.get(p.id)?.last).filter((x): x is string => !!x).sort();
    return { ...t, owner: owner?.name ?? "", ownerEmail: owner ? (login.get(owner.id)?.email ?? "") : "", team: team.length, lastLogin: lasts[lasts.length - 1] ?? null, events: eventsBy.get(t.id) ?? 0, orders: ordersBy.get(t.id) ?? 0, ordersThisMonth: ordersThisMonth.get(t.id) ?? 0 };
  });
  const modules = activity.error ? [] : [...count((activity.data ?? []).map((a) => ({ tenant_id: a.table_name }))).entries()].map(([table, n]) => ({ table, n })).sort((a, b) => b.n - a.n);
  return NextResponse.json({ me: { id: me.id, email: me.email }, accounts, plans: plans.data, invoices: invoices.data, tickets: tickets.data, announcements: announcements.data, changelog: changelog.data, audit: audit.data, modules });
}

/* eslint-disable @typescript-eslint/no-explicit-any -- action bodies are checked field by field below */
export async function POST(request: Request) {
  const sb = adminClient();
  const me = await caller(request, sb);
  if (!me) return NextResponse.json({ error: "Platform admins only." }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as Record<string, any>;
  const audit = (action: string, tenantId: string | null, detail: string) => sb.from("admin_audit").insert({ admin_id: me.id, tenant_id: tenantId, action, detail });
  const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
  const tenantId = typeof body.tenantId === "string" ? body.tenantId : null;
  const tenant = tenantId ? (await sb.from("tenants").select("*").eq("id", tenantId).maybeSingle()).data : null;
  if (tenantId && !tenant) return fail("Account not found.", 404);

  switch (body.action) {
    case "set_status": {
      if (!["trial", "active", "overdue", "suspended"].includes(body.status)) return fail("Unknown status.");
      const { error } = await sb.from("tenants").update({ status: body.status }).eq("id", tenantId!);
      if (error) return fail(error.message, 500);
      await audit("set_status", tenantId, `${tenant!.status} to ${body.status}`);
      return NextResponse.json({ ok: true });
    }
    case "set_plan": {
      const patch = { plan_id: body.planId || null, billing_cycle: body.cycle === "annual" ? "annual" : "monthly", addons: Array.isArray(body.addons) ? body.addons.map(String) : [], extra_users: Math.max(0, Number(body.extraUsers) || 0) };
      const { error } = await sb.from("tenants").update(patch).eq("id", tenantId!);
      if (error) return fail(error.message, 500);
      await audit("set_plan", tenantId, JSON.stringify(patch));
      return NextResponse.json({ ok: true });
    }
    case "extend_trial": {
      const days = Math.min(90, Math.max(1, Number(body.days) || 7));
      const from = Math.max(Date.now(), tenant!.trial_ends_at ? new Date(tenant!.trial_ends_at).getTime() : 0);
      const { error } = await sb.from("tenants").update({ trial_ends_at: new Date(from + days * 86400000).toISOString(), ...(tenant!.status === "suspended" ? {} : { status: "trial" }) }).eq("id", tenantId!);
      if (error) return fail(error.message, 500);
      await audit("extend_trial", tenantId, `${days} days`);
      return NextResponse.json({ ok: true });
    }
    case "record_payment": {
      // One billing period paid: the invoice is worked out from the plan, add-ons and extra users, plus 18% GST.
      const plan = tenant!.plan_id ? (await sb.from("plans").select("*").eq("id", tenant!.plan_id).maybeSingle()).data : null;
      if (!plan) return fail("Choose a plan for this account first.");
      const annual = tenant!.billing_cycle === "annual";
      const { count: paidBefore } = await sb.from("subscription_invoices").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!);
      const base = annual ? (!paidBefore && plan.first_year_price != null ? Number(plan.first_year_price) : Number(plan.annual_price)) : Number(plan.monthly_price);
      const months = annual ? 12 : 1;
      const addons = (plan.addons as { key: string; label: string; price: number }[]).filter((a) => (tenant!.addons as string[]).includes(a.key));
      const amount = base + addons.reduce((s, a) => s + Number(a.price) * months, 0) + Number(tenant!.extra_users) * Number(plan.extra_user_price) * months;
      const gst = Math.round(amount * 0.18 * 100) / 100;
      const start = tenant!.paid_until && tenant!.paid_until >= iso(new Date()) ? new Date(new Date(tenant!.paid_until).getTime() + 86400000) : new Date();
      const end = new Date(start);
      end.setMonth(end.getMonth() + months);
      end.setDate(end.getDate() - 1);
      const { count: issued } = await sb.from("subscription_invoices").select("id", { count: "exact", head: true });
      const number = `SUB/${fy()}/${String((issued ?? 0) + 1).padStart(4, "0")}`;
      const description = `${plan.name} plan, ${annual ? "annual" : "monthly"}${addons.length ? ` with ${addons.map((a) => a.label).join(", ")}` : ""}${tenant!.extra_users ? `, ${tenant!.extra_users} extra users` : ""}`;
      const inv = await sb.from("subscription_invoices").insert({ tenant_id: tenantId, number, description, period_start: iso(start), period_end: iso(end), amount, gst, total: amount + gst, status: "paid", paid_on: iso(new Date()) }).select("*").single();
      if (inv.error) return fail(inv.error.message, 500);
      await sb.from("tenants").update({ paid_until: iso(end), status: "active" }).eq("id", tenantId!);
      await audit("record_payment", tenantId, `${number} ${amount + gst}`);
      return NextResponse.json({ ok: true, invoice: inv.data });
    }
    case "delete_tenant": {
      if (body.confirm !== tenant!.name) return fail("Type the business name exactly to confirm.");
      const { data: team } = await sb.from("profiles").select("id").eq("tenant_id", tenantId!);
      const { error } = await sb.from("tenants").delete().eq("id", tenantId!);
      if (error) return fail(error.message, 500);
      for (const p of team ?? []) await sb.auth.admin.deleteUser(p.id);
      await audit("delete_tenant", tenantId, tenant!.name);
      return NextResponse.json({ ok: true });
    }
    case "impersonate": {
      // A one-time sign-in link for the account owner, for support. It is logged before it is handed out.
      const { data: owner } = await sb.from("profiles").select("id").eq("tenant_id", tenantId!).eq("role", "owner").limit(1).maybeSingle();
      if (!owner) return fail("This account has no owner login.");
      const { data: u } = await sb.auth.admin.getUserById(owner.id);
      if (!u.user?.email) return fail("The owner has no email to sign in with.");
      const origin = new URL(request.url).origin;
      const link = await sb.auth.admin.generateLink({ type: "magiclink", email: u.user.email, options: { redirectTo: `${origin}/` } });
      if (link.error) return fail(link.error.message, 500);
      await audit("impersonate", tenantId, `Signed in as ${u.user.email} for support`);
      return NextResponse.json({ ok: true, link: link.data.properties.action_link });
    }
    case "reply_ticket": {
      const reply = String(body.reply ?? "").trim();
      const status = body.close ? "closed" : "answered";
      const { data: t, error } = await sb.from("support_tickets").update({ ...(reply ? { reply, replied_at: new Date().toISOString() } : {}), status }).eq("id", String(body.ticketId)).select("tenant_id").single();
      if (error) return fail(error.message, 500);
      await audit("reply_ticket", t.tenant_id, status);
      return NextResponse.json({ ok: true });
    }
    case "save_plan": {
      const p = body.plan ?? {};
      if (!String(p.name ?? "").trim()) return fail("Give the plan a name.");
      const row = { name: String(p.name).trim(), monthly_price: Number(p.monthly_price) || 0, annual_price: Number(p.annual_price) || 0, first_year_price: p.first_year_price === null || p.first_year_price === "" ? null : Number(p.first_year_price), included_users: Number(p.included_users) || 1, extra_user_price: Number(p.extra_user_price) || 0, events_per_month: Number(p.events_per_month) || 0, branches: Number(p.branches) || 1, storage_mb: Number(p.storage_mb) || 1024, modules: Array.isArray(p.modules) ? p.modules : [], addons: Array.isArray(p.addons) ? p.addons : [], active: p.active !== false, sort: Number(p.sort) || 0 };
      const { error } = p.id ? await sb.from("plans").update(row).eq("id", p.id) : await sb.from("plans").insert(row);
      if (error) return fail(error.message, 500);
      await audit("save_plan", null, row.name);
      return NextResponse.json({ ok: true });
    }
    case "save_announcement": {
      const row = { message: String(body.message ?? "").trim(), tone: ["info", "warning", "success"].includes(body.tone) ? body.tone : "info", active: body.active !== false };
      if (!row.message && !body.id) return fail("Write the announcement.");
      const { error } = body.id ? await sb.from("announcements").update(body.message === undefined ? { active: row.active } : row).eq("id", body.id) : await sb.from("announcements").insert(row);
      if (error) return fail(error.message, 500);
      await audit("announcement", null, row.message || (row.active ? "shown" : "hidden"));
      return NextResponse.json({ ok: true });
    }
    case "save_changelog": {
      const row = { title: String(body.title ?? "").trim(), body: String(body.body ?? "").trim() };
      if (!row.title || !row.body) return fail("Give the change a title and a description.");
      const { error } = await sb.from("changelog").insert(row);
      if (error) return fail(error.message, 500);
      await audit("changelog", null, row.title);
      return NextResponse.json({ ok: true });
    }
    case "delete_changelog": {
      const { error } = await sb.from("changelog").delete().eq("id", String(body.id));
      if (error) return fail(error.message, 500);
      return NextResponse.json({ ok: true });
    }
    default:
      return fail("Unknown action.");
  }
}
