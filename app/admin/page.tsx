"use client";

import { Building2, IndianRupee, LifeBuoy, LogIn, Megaphone, Plus, RefreshCw, ShieldAlert, Sparkles, TrendingDown, Users } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/badges";
import { MoneyInput, StatCard } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Card, Chip, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger, ToggleRow } from "@/components/ui/primitives";
import { Modal, Sheet } from "@/components/ui/sheet";
import { navItems } from "@/lib/nav";
import { supabase } from "@/lib/supabase/client";
import { cn, daysFromToday, fmtDate, money, moneyShort, localDay } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any -- the admin API returns database rows as they are */
type Row = Record<string, any>;
interface Overview { me: { email: string }; accounts: Row[]; plans: Row[]; invoices: Row[]; tickets: Row[]; announcements: Row[]; changelog: Row[]; audit: Row[]; modules: { table: string; n: number }[] }

async function api(method: "GET" | "POST", body?: Row) {
  const { data } = await supabase().auth.getSession();
  const res = await fetch("/api/admin", { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error ?? "Request failed"), { status: res.status });
  return json;
}

const statusTone: Record<string, "info" | "success" | "warning" | "danger"> = { trial: "info", active: "success", overdue: "warning", suspended: "danger" };
/** Monthly value of an account's subscription: annual plans count a twelfth. */
function mrr(a: Row, plans: Row[]) {
  const p = plans.find((x) => x.id === a.plan_id);
  if (!p || a.status !== "active") return 0;
  const base = a.billing_cycle === "annual" ? Number(p.annual_price) / 12 : Number(p.monthly_price);
  const addons = (p.addons as Row[]).filter((x) => (a.addons as string[]).includes(x.key)).reduce((s, x) => s + Number(x.price), 0);
  return base + addons + a.extra_users * Number(p.extra_user_price);
}

function Dashboard({ o }: { o: Overview }) {
  const monthStart = new Date().toISOString().slice(0, 8) + "01";
  const total = o.accounts.reduce((s, a) => s + mrr(a, o.plans), 0);
  const active = o.accounts.filter((a) => a.status === "active").length;
  const trials = o.accounts.filter((a) => a.status === "trial").length;
  const churned = o.audit.filter((x) => x.action === "set_status" && /to suspended$/.test(x.detail) && daysFromToday(localDay(x.at)) >= -30).length;
  const signups = o.accounts.filter((a) => a.created_at >= monthStart).length;
  const label: Record<string, string> = { orders: "Orders", quotations: "Quotations", enquiries: "Enquiries", payments: "Payments", tasks: "Staff tasks", expenses: "Expenses", menu_items: "Menu", purchase_orders: "Purchase", invoices: "Invoices", clients: "Clients", event_functions: "Functions", workers: "Staff", vendors: "Vendors" };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Monthly recurring revenue" value={moneyShort(total)} sub={`${moneyShort(total * 12)} a year`} icon={IndianRupee} tone="success" />
        <StatCard label="Paying accounts" value={String(active)} sub={`${trials} on trial`} icon={Building2} />
        <StatCard label="Churn, last 30 days" value={String(churned)} sub={`${active + churned ? Math.round((churned / (active + churned)) * 100) : 0}% of paying accounts`} icon={TrendingDown} tone={churned ? "warning" : "neutral"} />
        <StatCard label="Signups this month" value={String(signups)} sub={`${o.accounts.reduce((s, a) => s + a.ordersThisMonth, 0)} orders created this month`} icon={Users} tone="info" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4 md:p-5">
          <p className="font-heading font-semibold">Most used, last 30 days</p>
          {o.modules.length === 0 ? <p className="mt-2 text-sm text-text-muted">Usage appears once caterers have the activity log (0009).</p> : (
            <ul className="tnum mt-3 space-y-2 text-sm">{o.modules.slice(0, 8).map((m) => <li key={m.table}><div className="flex justify-between"><span>{label[m.table] ?? m.table}</span><span className="text-text-muted">{m.n} changes</span></div><div className="mt-1 h-1.5 rounded-full bg-surface-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(m.n / o.modules[0].n) * 100}%` }} /></div></li>)}</ul>
          )}
        </Card>
        <Card className="p-4 md:p-5">
          <p className="font-heading font-semibold">Needs attention</p>
          <ul className="mt-3 space-y-2 text-sm">
            {o.accounts.filter((a) => a.status === "trial" && a.trial_ends_at && daysFromToday(localDay(a.trial_ends_at)) <= 3).map((a) => <li key={a.id} className="flex justify-between"><span>{a.name}</span><Badge tone="warning">Trial {daysFromToday(localDay(a.trial_ends_at)) < 0 ? "ended" : `ends in ${daysFromToday(localDay(a.trial_ends_at))}d`}</Badge></li>)}
            {o.accounts.filter((a) => a.status === "overdue").map((a) => <li key={a.id} className="flex justify-between"><span>{a.name}</span><Badge tone="warning">Overdue</Badge></li>)}
            {o.accounts.filter((a) => a.status === "active" && a.paid_until && daysFromToday(a.paid_until) < 0).map((a) => <li key={a.id} className="flex justify-between"><span>{a.name}</span><Badge tone="danger">Paid period over</Badge></li>)}
            {o.tickets.filter((t) => t.status === "open").length > 0 && <li className="flex justify-between"><span>Support tickets waiting</span><Badge tone="warning">{o.tickets.filter((t) => t.status === "open").length}</Badge></li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function AccountSheet({ a, o, onClose, refresh }: { a: Row; o: Overview; onClose: () => void; refresh: () => void }) {
  const [planId, setPlanId] = React.useState<string>(a.plan_id ?? "");
  const [cycle, setCycle] = React.useState<string>(a.billing_cycle);
  const [addons, setAddons] = React.useState<string[]>(a.addons ?? []);
  const [extra, setExtra] = React.useState<number>(a.extra_users ?? 0);
  const [confirm, setConfirm] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);
  const [busy, setBusy] = React.useState("");
  const plan = o.plans.find((p) => p.id === planId);
  const run = async (action: string, body: Row, done: string) => {
    setBusy(action);
    try {
      const res = await api("POST", { action, tenantId: a.id, ...body });
      toast.success(done);
      if (action === "impersonate") window.open(res.link, "_blank", "noopener");
      if (action === "delete_tenant") onClose();
      refresh();
    } catch (e) {
      toast.error("Not done", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy("");
    }
  };
  const invoices = o.invoices.filter((i) => i.tenant_id === a.id);
  return (
    <Sheet open onOpenChange={(v) => !v && onClose()} title={a.name} description={`${a.owner} · ${a.ownerEmail} · since ${fmtDate(localDay(a.created_at))}`} wide>
      <div className="space-y-6">
        <dl className="tnum grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Status", <Badge key="s" tone={statusTone[a.status]}>{a.status}</Badge>], ["Team", a.team], ["Orders", a.orders], ["Functions this month", a.events]].map(([k, v]) => <div key={String(k)} className="rounded-xl bg-surface-muted p-3"><dt className="text-xs text-text-muted">{k}</dt><dd className="font-heading text-lg font-bold">{v}</dd></div>)}
        </dl>
        <div className="flex flex-wrap gap-2">
          {(["active", "overdue", "suspended"] as const).filter((s) => s !== a.status).map((s) => <Button key={s} variant={s === "suspended" ? "ghost" : "secondary"} loading={busy === "set_status"} onClick={() => run("set_status", { status: s }, `Marked ${s}`)}>{s === "active" ? "Activate" : s === "overdue" ? "Mark overdue" : "Pause account"}</Button>)}
          <Button variant="ghost" loading={busy === "extend_trial"} onClick={() => run("extend_trial", { days: 7 }, "Trial extended by 7 days")}>Extend trial 7 days</Button>
          <Button variant="ghost" loading={busy === "impersonate"} onClick={() => run("impersonate", {}, "Sign-in link opened in a new tab; it is in the audit log")}><LogIn strokeWidth={1.75} />Sign in as owner</Button>
        </div>
        <div className="space-y-3 rounded-xl border p-4">
          <p className="font-medium">Plan</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Plan"><Select value={planId} onChange={(e) => setPlanId(e.target.value)}><option value="">No plan</option>{o.plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
            <Field label="Billing"><Select value={cycle} onChange={(e) => setCycle(e.target.value)}><option value="monthly">Monthly</option><option value="annual">Annual</option></Select></Field>
            <Field label="Extra users"><Input type="number" min={0} value={extra} onChange={(e) => setExtra(Math.max(0, Number(e.target.value)))} /></Field>
          </div>
          {plan && (plan.addons as Row[]).length > 0 && <div className="flex flex-wrap gap-2">{(plan.addons as Row[]).map((x) => <Chip key={x.key} active={addons.includes(x.key)} onClick={() => setAddons(addons.includes(x.key) ? addons.filter((k) => k !== x.key) : [...addons, x.key])}>{x.label} +{money(x.price)}</Chip>)}</div>}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" loading={busy === "set_plan"} onClick={() => run("set_plan", { planId, cycle, addons, extraUsers: extra }, "Plan saved")}>Save plan</Button>
            <Button loading={busy === "record_payment"} disabled={!a.plan_id} onClick={() => run("record_payment", {}, "Payment recorded and invoice issued")}><IndianRupee strokeWidth={1.75} />Record a {a.billing_cycle === "annual" ? "year's" : "month's"} payment</Button>
          </div>
          <p className="text-xs text-text-muted">{a.paid_until ? `Paid until ${fmtDate(a.paid_until)}.` : "No payment recorded yet."} Recording a payment issues a GST invoice for the saved plan and extends the paid period.</p>
        </div>
        {invoices.length > 0 && <ul className="tnum divide-y rounded-xl border text-sm">{invoices.map((i) => <li key={i.id} className="flex justify-between gap-3 px-4 py-2"><span>{i.number}<span className="block text-xs text-text-muted">{i.description} · {fmtDate(i.period_start)} to {fmtDate(i.period_end)}</span></span><span className="font-medium">{money(Number(i.total))}</span></li>)}</ul>}
        <div className="rounded-xl border border-danger/30 p-4">
          <p className="font-medium text-danger">Delete this account</p>
          <p className="text-xs text-text-muted">Removes the caterer, every record and every login. This cannot be undone.</p>
          <Button variant="ghost" className="mt-2 text-danger" onClick={() => setDeleting(true)}>Delete account</Button>
        </div>
      </div>
      <Modal open={deleting} onOpenChange={setDeleting} title={`Delete ${a.name}?`} description="Type the business name to confirm." footer={<><Button variant="ghost" onClick={() => setDeleting(false)}>Keep</Button><Button variant="danger" disabled={confirm !== a.name} loading={busy === "delete_tenant"} onClick={() => run("delete_tenant", { confirm }, "Account deleted")}>Delete forever</Button></>}>
        <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={a.name} />
      </Modal>
    </Sheet>
  );
}

function Accounts({ o, refresh }: { o: Overview; refresh: () => void }) {
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [open, setOpen] = React.useState<string | null>(null);
  const shown = o.accounts.filter((a) => (status === "all" || a.status === status) && `${a.name} ${a.ownerEmail} ${a.city}`.toLowerCase().includes(q.toLowerCase()));
  const openRow = o.accounts.find((a) => a.id === open);
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 p-4 md:p-5">
        <Input aria-label="Search accounts" className="max-w-xs" placeholder="Search by name, email or city" value={q} onChange={(e) => setQ(e.target.value)} />
        {["all", "trial", "active", "overdue", "suspended"].map((s) => <Chip key={s} active={status === s} onClick={() => setStatus(s)} className="capitalize">{s}</Chip>)}
      </div>
      <div className="overflow-x-auto">
        <table className="tnum w-full min-w-[820px] text-left text-sm">
          <thead className="border-y bg-surface-muted/50 text-xs text-text-muted"><tr><th className="px-4 py-2 font-medium md:px-5">Caterer</th><th className="py-2 font-medium">Plan</th><th className="py-2 font-medium">Status</th><th className="py-2 font-medium">Trial or paid until</th><th className="py-2 font-medium">Last login</th><th className="py-2 text-right font-medium">Orders this month</th><th className="px-4 py-2 text-right font-medium md:px-5">MRR</th></tr></thead>
          <tbody className="divide-y">
            {shown.map((a) => (
              <tr key={a.id} className="cursor-pointer hover:bg-surface-muted/60" onClick={() => setOpen(a.id)}>
                <td className="px-4 py-3 md:px-5"><span className="block font-medium">{a.name}</span><span className="block text-xs text-text-muted">{a.ownerEmail}{a.city && ` · ${a.city}`} · joined {fmtDate(localDay(a.created_at), { day: "numeric", month: "short" })}</span></td>
                <td className="py-3">{o.plans.find((p) => p.id === a.plan_id)?.name ?? <span className="text-text-muted">None</span>}<span className="block text-xs text-text-muted">{a.plan_id && a.billing_cycle}</span></td>
                <td className="py-3"><Badge tone={statusTone[a.status]}>{a.status}</Badge></td>
                <td className="py-3">{a.status === "trial" ? (a.trial_ends_at ? fmtDate(localDay(a.trial_ends_at), { day: "numeric", month: "short" }) : "-") : a.paid_until ? fmtDate(a.paid_until, { day: "numeric", month: "short", year: "2-digit" }) : "-"}</td>
                <td className="py-3">{a.lastLogin ? fmtDate(localDay(a.lastLogin), { day: "numeric", month: "short" }) : "Never"}</td>
                <td className="py-3 text-right">{a.ordersThisMonth}</td>
                <td className="px-4 py-3 text-right font-medium md:px-5">{money(Math.round(mrr(a, o.plans)))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {openRow && <AccountSheet a={openRow} o={o} onClose={() => setOpen(null)} refresh={refresh} />}
    </Card>
  );
}

const blankPlan = { name: "", monthly_price: 0, annual_price: 0, first_year_price: null as number | null, included_users: 3, extra_user_price: 0, events_per_month: 0, branches: 1, storage_mb: 1024, modules: [] as string[], addons: [] as Row[], active: true, sort: 9 };

function Plans({ o, refresh }: { o: Overview; refresh: () => void }) {
  const [edit, setEdit] = React.useState<Row | null>(null);
  const set = (patch: Row) => setEdit((e) => (e ? { ...e, ...patch } : e));
  const save = async () => {
    try {
      await api("POST", { action: "save_plan", plan: edit });
      toast.success("Plan saved");
      setEdit(null);
      refresh();
    } catch (e) {
      toast.error("Not saved", { description: e instanceof Error ? e.message : undefined });
    }
  };
  const modules = navItems.filter((n) => n.key !== "home" && n.key !== "settings");
  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {o.plans.map((p) => (
          <Card key={p.id} className={cn("p-4", !p.active && "opacity-60")}>
            <p className="flex items-center justify-between font-heading text-lg font-semibold">{p.name}{!p.active && <Badge>Hidden</Badge>}</p>
            <p className="tnum text-2xl font-bold">{money(Number(p.monthly_price))}<span className="text-sm font-normal text-text-muted"> / month</span></p>
            <p className="tnum text-xs text-text-muted">{money(Number(p.annual_price))} a year{p.first_year_price != null ? `, first year ${money(Number(p.first_year_price))}` : ""}</p>
            <ul className="mt-2 space-y-0.5 text-sm text-text-muted"><li>{p.included_users} users, +{money(Number(p.extra_user_price))} each extra</li><li>{p.events_per_month || "Unlimited"} bookings a month · {p.branches} branches · {p.storage_mb / 1024} GB</li><li>{p.modules.length ? `${p.modules.length} modules` : "All modules"}{p.addons.length ? ` · ${p.addons.length} add-ons` : ""}</li></ul>
            <Button variant="ghost" className="mt-2" onClick={() => setEdit({ ...p })}>Edit</Button>
          </Card>
        ))}
        <button type="button" onClick={() => setEdit({ ...blankPlan })} className="grid min-h-40 place-items-center rounded-2xl border-2 border-dashed text-text-muted hover:border-primary hover:text-primary"><span className="flex items-center gap-2"><Plus strokeWidth={1.75} />New plan</span></button>
      </div>
      <Sheet open={!!edit} onOpenChange={(v) => !v && setEdit(null)} title={edit?.id ? `Edit ${edit.name}` : "New plan"} wide footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" onClick={save}>Save plan</Button></>}>
        {edit && (
          <div className="space-y-4">
            <Field label="Name"><Input value={edit.name} onChange={(e) => set({ name: e.target.value })} /></Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Monthly price"><MoneyInput value={Number(edit.monthly_price)} onChange={(v) => set({ monthly_price: v })} /></Field>
              <Field label="Annual renewal price"><MoneyInput value={Number(edit.annual_price)} onChange={(v) => set({ annual_price: v })} /></Field>
              <Field label="First-year price" hint="Leave 0 to use the renewal price"><MoneyInput value={Number(edit.first_year_price ?? 0)} onChange={(v) => set({ first_year_price: v || null })} /></Field>
              <Field label="Users included"><Input type="number" min={1} value={edit.included_users} onChange={(e) => set({ included_users: Number(e.target.value) })} /></Field>
              <Field label="Price per extra user"><MoneyInput value={Number(edit.extra_user_price)} onChange={(v) => set({ extra_user_price: v })} /></Field>
              <Field label="Bookings a month" hint="0 for unlimited"><Input type="number" min={0} value={edit.events_per_month} onChange={(e) => set({ events_per_month: Number(e.target.value) })} /></Field>
              <Field label="Branches"><Input type="number" min={1} value={edit.branches} onChange={(e) => set({ branches: Number(e.target.value) })} /></Field>
              <Field label="Storage (MB)"><Input type="number" min={100} value={edit.storage_mb} onChange={(e) => set({ storage_mb: Number(e.target.value) })} /></Field>
            </div>
            <div>
              <p className="text-xs font-medium text-text-muted">Modules switched on (none selected means all)</p>
              <div className="mt-2 flex flex-wrap gap-2">{modules.map((m) => <Chip key={m.key} active={edit.modules.includes(m.key)} onClick={() => set({ modules: edit.modules.includes(m.key) ? edit.modules.filter((k: string) => k !== m.key) : [...edit.modules, m.key] })} className="capitalize">{m.key}</Chip>)}</div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-text-muted">Add-ons bought separately (price per month)</p>
              {(edit.addons as Row[]).map((x, i) => (
                <div key={i} className="flex gap-2">
                  <Input aria-label="Add-on name" value={x.label} onChange={(e) => set({ addons: edit.addons.map((y: Row, k: number) => (k === i ? { ...y, label: e.target.value, key: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_") } : y)) })} />
                  <MoneyInput className="w-36" value={Number(x.price)} onChange={(v) => set({ addons: edit.addons.map((y: Row, k: number) => (k === i ? { ...y, price: v } : y)) })} />
                  <Button variant="ghost" onClick={() => set({ addons: edit.addons.filter((_: Row, k: number) => k !== i) })}>Remove</Button>
                </div>
              ))}
              <Button variant="ghost" onClick={() => set({ addons: [...edit.addons, { key: "", label: "", price: 0 }] })}><Plus strokeWidth={1.75} />Add-on</Button>
            </div>
            <ToggleRow checked={edit.active} onCheckedChange={(active) => set({ active })} label="Offered to caterers" help="Hidden plans stay on the accounts that have them." />
          </div>
        )}
      </Sheet>
    </>
  );
}

function Support({ o, refresh }: { o: Overview; refresh: () => void }) {
  const [reply, setReply] = React.useState<Record<string, string>>({});
  const send = async (ticketId: string, close: boolean) => {
    try {
      await api("POST", { action: "reply_ticket", ticketId, reply: reply[ticketId] ?? "", close });
      toast.success(close ? "Closed" : "Reply sent");
      refresh();
    } catch (e) {
      toast.error("Not sent", { description: e instanceof Error ? e.message : undefined });
    }
  };
  const name = (id: string) => o.accounts.find((a) => a.id === id)?.name ?? "Unknown account";
  if (!o.tickets.length) return <p className="py-10 text-center text-sm text-text-muted">No support requests yet. Caterers write in from Help and support in their profile menu.</p>;
  return (
    <div className="space-y-3">
      {o.tickets.map((t) => (
        <Card key={t.id} className="p-4">
          <p className="flex flex-wrap items-center gap-2 font-medium">{t.subject}<Badge tone={t.status === "open" ? "warning" : t.status === "answered" ? "success" : "neutral"}>{t.status}</Badge><span className="text-xs font-normal text-text-muted">{name(t.tenant_id)} · {fmtDate(localDay(t.created_at), { day: "numeric", month: "short" })}</span></p>
          <p className="mt-1 text-sm text-text-muted">{t.body}</p>
          {t.reply && <p className="mt-2 rounded-lg bg-primary-soft p-2 text-sm">{t.reply}</p>}
          {t.status !== "closed" && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Textarea rows={2} className="min-w-60 flex-1" placeholder="Reply" value={reply[t.id] ?? ""} onChange={(e) => setReply({ ...reply, [t.id]: e.target.value })} />
              <div className="flex flex-col gap-2"><Button variant="primary" disabled={!reply[t.id]?.trim()} onClick={() => send(t.id, false)}>Reply</Button><Button variant="ghost" onClick={() => send(t.id, true)}>Close</Button></div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function Publish({ o, refresh }: { o: Overview; refresh: () => void }) {
  const [msg, setMsg] = React.useState("");
  const [tone, setTone] = React.useState("info");
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const call = async (b: Row, done: string) => {
    try {
      await api("POST", b);
      toast.success(done);
      refresh();
    } catch (e) {
      toast.error("Not saved", { description: e instanceof Error ? e.message : undefined });
    }
  };
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="space-y-3 p-4 md:p-5">
        <p className="flex items-center gap-2 font-heading font-semibold"><Megaphone className="size-5" strokeWidth={1.75} />Announcement banner</p>
        <Textarea rows={2} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Scheduled maintenance on Sunday 2 to 3 am." />
        <div className="flex gap-2"><Select className="w-auto" value={tone} onChange={(e) => setTone(e.target.value)}><option value="info">Information</option><option value="warning">Warning</option><option value="success">Good news</option></Select><Button variant="primary" disabled={!msg.trim()} onClick={() => { void call({ action: "save_announcement", message: msg, tone }, "Shown to every caterer"); setMsg(""); }}>Publish</Button></div>
        <ul className="divide-y text-sm">{o.announcements.map((a) => <li key={a.id} className="flex items-center justify-between gap-3 py-2"><span className={cn(!a.active && "text-text-muted line-through")}>{a.message}</span><Button variant="ghost" onClick={() => call({ action: "save_announcement", id: a.id, active: !a.active }, a.active ? "Hidden" : "Shown again")}>{a.active ? "Hide" : "Show"}</Button></li>)}</ul>
      </Card>
      <Card className="space-y-3 p-4 md:p-5">
        <p className="flex items-center gap-2 font-heading font-semibold"><Sparkles className="size-5" strokeWidth={1.75} />Changelog</p>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New: table menu QR codes" />
        <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What changed and where to find it" />
        <Button variant="primary" disabled={!title.trim() || !body.trim()} onClick={() => { void call({ action: "save_changelog", title, body }, "Added to What's new"); setTitle(""); setBody(""); }}>Add to What&apos;s new</Button>
        <ul className="divide-y text-sm">{o.changelog.map((c) => <li key={c.id} className="flex items-center justify-between gap-3 py-2"><span><span className="block font-medium">{c.title}</span><span className="text-xs text-text-muted">{fmtDate(c.published_on)}</span></span><Button variant="ghost" onClick={() => call({ action: "delete_changelog", id: c.id }, "Removed")}>Remove</Button></li>)}</ul>
      </Card>
    </div>
  );
}

function Audit({ o }: { o: Overview }) {
  const name = (id: string | null) => o.accounts.find((a) => a.id === id)?.name ?? (id ? "Deleted account" : "Platform");
  return (
    <Card>
      <ul className="divide-y">
        {o.audit.map((x) => <li key={x.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 text-sm md:px-5"><span><span className="font-medium">{x.action.replace(/_/g, " ")}</span> · {name(x.tenant_id)}<span className="block text-xs text-text-muted">{x.detail}</span></span><span className="tnum text-xs text-text-muted">{fmtDate(localDay(x.at), { day: "numeric", month: "short" })} {new Date(x.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span></li>)}
        {!o.audit.length && <li className="px-5 py-8 text-center text-sm text-text-muted">Nothing yet.</li>}
      </ul>
    </Card>
  );
}

export default function AdminPage() {
  const [o, setO] = React.useState<Overview | null>(null);
  const [error, setError] = React.useState<{ status?: number; message: string } | null>(null);
  const load = React.useCallback(() => {
    api("GET").then((d: Overview) => { setO(d); setError(null); }, (e: Error & { status?: number }) => setError({ status: e.status, message: e.message }));
  }, []);
  React.useEffect(load, [load]);
  if (error) return (
    <div className="grid min-h-dvh place-items-center bg-bg p-6 text-center">
      <div><ShieldAlert className="mx-auto size-10 text-warning" strokeWidth={1.5} /><h1 className="mt-3 font-heading text-xl font-semibold">{error.status === 403 ? "This page is for the platform team" : "Could not load the admin panel"}</h1><p className="mt-1 text-sm text-text-muted">{error.status === 403 ? "Sign in with a platform admin account." : error.message}</p><Button variant="primary" className="mt-4" asChild><Link href="/login">Sign in</Link></Button></div>
    </div>
  );
  if (!o) return <div className="mx-auto max-w-6xl space-y-4 p-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-64" /></div>;
  const open = o.tickets.filter((t) => t.status === "open").length;
  return (
    <div className="min-h-dvh bg-bg text-text">
      <header className="border-b bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 md:px-6">
          <div><h1 className="font-heading text-xl font-bold">Platform admin</h1><p className="text-xs text-text-muted">{o.accounts.length} caterer accounts · signed in as {o.me.email}</p></div>
          <Button variant="ghost" onClick={load}><RefreshCw strokeWidth={1.75} />Refresh</Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        <Tabs defaultValue="dashboard">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="plans">Plans</TabsTrigger>
            <TabsTrigger value="support"><LifeBuoy className="size-4" strokeWidth={1.75} />Support{open > 0 && <Badge tone="warning">{open}</Badge>}</TabsTrigger>
            <TabsTrigger value="publish">Announcements</TabsTrigger>
            <TabsTrigger value="audit">Audit log</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard"><Dashboard o={o} /></TabsContent>
          <TabsContent value="accounts"><Accounts o={o} refresh={load} /></TabsContent>
          <TabsContent value="plans"><Plans o={o} refresh={load} /></TabsContent>
          <TabsContent value="support"><Support o={o} refresh={load} /></TabsContent>
          <TabsContent value="publish"><Publish o={o} refresh={load} /></TabsContent>
          <TabsContent value="audit"><Audit o={o} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
