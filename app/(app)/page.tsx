"use client";

import { CalendarCheck, CalendarDays, Check, ChevronRight, IndianRupee, PhoneCall, Presentation, Wallet } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/shared/badges";
import { Avatar, EmptyState, EventCard, PageHeader, ProgressBar, StatCard } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/primitives";
import { paidAmount, priceQuote } from "@/lib/pricing";
import { useStock } from "@/components/supply/common";
import { useStaff } from "@/lib/staff";
import { useCurrentUser, useStore } from "@/lib/store";
import { fmtQty } from "@/lib/supply";
import { useSupply } from "@/lib/supply-store";
import { useUi } from "@/lib/ui";
import { cn, daysFromToday, fmtDate, isoDate, money, moneyShort, parseDate, relativeDay } from "@/lib/utils";

function OpenTasks() {
  const ready = useStaff((s) => s.ready);
  const tasks = useStaff((s) => s.tasks);
  const workers = useStaff((s) => s.workers);
  const open = tasks.filter((t) => t.status !== "done" && t.status !== "verified");
  if (!ready || tasks.length === 0) return null;
  return (
    <Card>
      <CardTitle action={<Button variant="ghost" asChild><Link href="/staff">Staff and Tasks</Link></Button>}>Open tasks</CardTitle>
      {open.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-text-muted">Every task is done.</p>
      ) : (
        <ul className="mt-2 divide-y">
          {open.slice(0, 6).map((t) => (
            <li key={t.id}>
              <Link href={`/orders/${t.orderId}?tab=staff`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-surface-muted/60 md:px-5">
                <span className="truncate">{t.title}</span>
                <span className={cn("shrink-0 text-xs", t.workerId ? "text-text-muted" : "text-warning")}>{workers.find((w) => w.id === t.workerId)?.name ?? "Not assigned"}</span>
              </Link>
            </li>
          ))}
          {open.length > 6 && <li className="px-4 py-2 text-xs text-text-muted md:px-5">and {open.length - 6} more</li>}
        </ul>
      )}
    </Card>
  );
}

function LowStock() {
  const ready = useSupply((s) => s.ready);
  const ingredients = useSupply((s) => s.ingredients);
  const stock = useStock();
  const low = ingredients.filter((i) => i.reorderLevel > 0 && (stock.get(i.id) ?? 0) < i.reorderLevel);
  if (!ready || ingredients.length === 0) return null;
  return (
    <Card>
      <CardTitle action={<Button variant="ghost" asChild><Link href="/purchase">Purchase and Stock</Link></Button>}>Low stock</CardTitle>
      {low.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-text-muted">Everything is above its reorder level.</p>
      ) : (
        <ul className="tnum mt-2 divide-y">
          {low.slice(0, 6).map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm md:px-5">
              <span className="truncate">{i.name}</span>
              <span className="shrink-0 text-warning">{fmtQty(stock.get(i.id) ?? 0)} of {fmtQty(i.reorderLevel)} {i.unit}</span>
            </li>
          ))}
          {low.length > 6 && <li className="px-4 py-2 text-xs text-text-muted md:px-5">and {low.length - 6} more</li>}
        </ul>
      )}
    </Card>
  );
}

export default function DashboardPage() {
  const t = useTranslations("home");
  const user = useCurrentUser();
  const { orders, enquiries, clients, items, packages, tenant } = useStore();
  const openPayment = useUi((s) => s.openPayment);
  const openEnquiry = useUi((s) => s.openEnquiry);
  const seesMoney = ["owner", "sales", "accountant"].includes(user.role);
  const seesSales = ["owner", "sales"].includes(user.role);

  const data = React.useMemo(() => {
    const name = (id: string) => clients.find((c) => c.id === id)?.name ?? "";
    const live = orders.filter((o) => o.status !== "cancelled");
    const upcoming = live
      .flatMap((o) => o.functions.map((f) => ({ order: o, fn: f, in: daysFromToday(f.date) })))
      .filter((x) => x.in >= 0 && x.in <= 7)
      .sort((a, b) => a.fn.date.localeCompare(b.fn.date) || a.fn.time.localeCompare(b.fn.time));
    const dues = live
      .map((o) => {
        const total = priceQuote(o, items, packages, tenant.slabs).grand;
        const first = [...o.functions].sort((a, b) => a.date.localeCompare(b.date))[0];
        return { order: o, name: name(o.clientId), due: total - paidAmount(o.payments), total, eventIn: first ? daysFromToday(first.date) : 0 };
      })
      .filter((d) => d.due > 0)
      .sort((a, b) => a.eventIn - b.eventIn);
    const followUps = enquiries
      .filter((e) => e.followUpAt && !["booked", "lost"].includes(e.stage))
      .map((e) => ({ e, name: name(e.clientId), in: daysFromToday(e.followUpAt!) }))
      .filter((x) => x.in <= 1)
      .sort((a, b) => a.in - b.in);
    const now = new Date();
    const payments = orders.flatMap((o) => o.payments);
    const collectedIn = (month: string) => payments.filter((p) => p.date.startsWith(month)).reduce((s, p) => s + p.amount, 0);
    const collected = collectedIn(isoDate(now).slice(0, 7));
    const chart = Array.from({ length: 6 }, (_, i) => {
      const month = isoDate(new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)).slice(0, 7);
      return { label: parseDate(`${month}-01`).toLocaleDateString("en-IN", { month: "short" }), amount: collectedIn(month) };
    });
    return { upcoming, dues, followUps, collected, chart, totalDue: dues.reduce((s, d) => s + d.due, 0) };
  }, [orders, enquiries, clients, items, packages, tenant.slabs]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("morning") : hour < 17 ? t("afternoon") : t("evening");
  const checklist = [
    { label: "Add your logo", done: !!tenant.logo, href: "/settings" },
    { label: "Upload your menu", done: items.length > 0, href: "/menu" },
    { label: "Add workers", done: false, href: "/staff", note: "Phase 4" },
    { label: "Create your first order", done: orders.length > 0, href: "/booking" },
  ];
  const doneCount = checklist.filter((c) => c.done).length;

  return (
    <>
      <PageHeader
        title={`${greeting}, ${user.name.split(" ")[0]}`}
        subtitle={`${fmtDate(isoDate(new Date()), { weekday: "long", day: "numeric", month: "long" })} · ${t("subtitle")}`}
        action={seesSales && <Button variant="primary" className="max-md:hidden" asChild><Link href="/booking"><Presentation strokeWidth={1.75} />Start a booking</Link></Button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("eventsThisWeek")} value={String(data.upcoming.length)} sub={data.upcoming[0] ? `Next: ${data.upcoming[0].fn.name}, ${relativeDay(data.upcoming[0].fn.date).toLowerCase()}` : "Nothing scheduled"} icon={CalendarCheck} tone="success" href="/calendar" />
        {seesMoney && <StatCard label={t("paymentsDue")} value={moneyShort(data.totalDue)} sub={`${data.dues.length} orders with a balance`} icon={Wallet} tone="warning" href="/orders" />}
        {seesSales && <StatCard label={t("followUps")} value={String(data.followUps.length)} sub={data.followUps.some((f) => f.in < 0) ? "Some are overdue" : "Due today or tomorrow"} icon={PhoneCall} tone="info" href="/enquiries" />}
        {seesMoney && <StatCard label={t("monthRevenue")} value={moneyShort(data.collected)} sub={`${tenant.name}`} icon={IndianRupee} />}
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">{t("next7")}</h2>
          <Button variant="ghost" asChild><Link href="/calendar"><CalendarDays strokeWidth={1.75} />Calendar</Link></Button>
        </div>
        {data.upcoming.length === 0 ? (
          <EmptyState icon={CalendarDays} title={t("noEvents")} help="Confirmed and tentative functions show up here as their dates get close." action={seesSales && <Button variant="primary" asChild><Link href="/booking">Start a booking</Link></Button>} />
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {data.upcoming.map(({ order, fn }) => <EventCard key={fn.id} order={order} functionId={fn.id} />)}
          </div>
        )}
      </section>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {seesMoney && (
            <Card>
              <CardTitle action={<Button variant="ghost" onClick={() => openPayment()}>Record payment</Button>}>Payments due</CardTitle>
              <ul className="mt-2 divide-y">
                {data.dues.length === 0 && <li className="px-5 py-6 text-center text-sm text-text-muted">Every order is fully paid.</li>}
                {data.dues.map((d) => (
                  <li key={d.order.id}>
                    <Link href={`/orders/${d.order.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-muted/60 md:px-5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{d.name}</p>
                        <p className="truncate text-xs text-text-muted">{d.order.eventType} · event {relativeDay(d.order.functions[0]?.date ?? "").toLowerCase()}</p>
                        <ProgressBar value={((d.total - d.due) / d.total) * 100} tone={d.eventIn <= 3 ? "danger" : "warning"} className="mt-2" label="Payment received" />
                      </div>
                      <div className="text-right">
                        <p className="tnum text-sm font-semibold">{money(d.due)}</p>
                        <Badge tone={d.eventIn <= 3 ? "danger" : "warning"}>{d.eventIn < 0 ? "Overdue" : d.eventIn <= 3 ? "Due now" : "Due soon"}</Badge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {seesSales && (
            <Card>
              <CardTitle action={<Button variant="ghost" onClick={() => openEnquiry()}>New enquiry</Button>}>Pending follow-ups</CardTitle>
              <ul className="mt-2 divide-y">
                {data.followUps.length === 0 && <li className="px-5 py-6 text-center text-sm text-text-muted">No follow-ups due. Nice.</li>}
                {data.followUps.map(({ e, name, in: n }) => (
                  <li key={e.id}>
                    <button type="button" onClick={() => openEnquiry(e.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-muted/60 md:px-5">
                      <Avatar name={name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{name}</p>
                        <p className="tnum truncate text-xs text-text-muted">{e.eventType} · {e.pax} guests · {fmtDate(e.date, { day: "numeric", month: "short" })}</p>
                      </div>
                      <Badge tone={n < 0 ? "danger" : n === 0 ? "warning" : "neutral"}>{n < 0 ? "Missed" : relativeDay(e.followUpAt!)}</Badge>
                      <ChevronRight className="size-5 text-text-muted" strokeWidth={1.75} />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {seesMoney && (
            <Card>
              <CardTitle>{t("revenue")}</CardTitle>
              <div className="h-56 px-2 pb-3 pt-4 md:px-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.chart} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                    <YAxis width={52} tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} tickFormatter={(v: number) => moneyShort(v)} />
                    <Tooltip cursor={{ fill: "var(--surface-muted)" }} formatter={(v) => [money(Number(v)), "Collected"]} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text)", fontSize: 12 }} />
                    <Bar dataKey="amount" fill="var(--primary)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
          {user.role === "owner" && (
            <Card>
              <CardTitle action={<span className="tnum text-xs text-text-muted">{doneCount} of {checklist.length} done</span>}>{t("setup")}</CardTitle>
              <div className="px-4 pt-3 md:px-5"><ProgressBar value={(doneCount / checklist.length) * 100} tone="primary" label="Setup progress" /></div>
              <ul className="mt-2 divide-y">
                {checklist.map((c) => (
                  <li key={c.label}>
                    <Link href={c.href} className="flex h-12 items-center gap-3 px-4 text-sm hover:bg-surface-muted/60 md:px-5">
                      <span className={cn("grid size-6 place-items-center rounded-full border", c.done ? "border-success bg-success/10 text-success" : "text-transparent")}><Check className="size-4" strokeWidth={2.5} /></span>
                      <span className={cn("flex-1", c.done && "text-text-muted line-through")}>{c.label}</span>
                      {c.note && <Badge>{c.note}</Badge>}
                      <ChevronRight className="size-5 text-text-muted" strokeWidth={1.75} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <LowStock />
          <OpenTasks />
        </div>
      </div>
    </>
  );
}
