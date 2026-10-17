"use client";

import { CalendarCheck, CalendarDays, Check, ChevronRight, MessagesSquare, PhoneCall, Presentation, Users } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Badge } from "@/components/shared/badges";
import { Avatar, EmptyState, EventCard, PageHeader, ProgressBar, StatCard } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/primitives";
import { OpenIssues } from "@/components/ops/order-ops";
import { useStock } from "@/components/supply/common";
import { useStaff } from "@/lib/staff";
import { useCurrentUser, useStore } from "@/lib/store";
import { fmtQty } from "@/lib/supply";
import { useSupply } from "@/lib/supply-store";
import { useUi } from "@/lib/ui";
import { cn, daysFromToday, fmtDate, isoDate, num, relativeDay } from "@/lib/utils";

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
  const { orders, enquiries, clients, items, tenant } = useStore();
  const workers = useStaff((s) => s.workers.length);
  const openEnquiry = useUi((s) => s.openEnquiry);
  const seesSales = ["owner", "sales"].includes(user.role);

  const data = React.useMemo(() => {
    const name = (id: string) => clients.find((c) => c.id === id)?.name ?? "";
    const live = orders.filter((o) => o.status !== "cancelled");
    const upcoming = live
      .flatMap((o) => o.functions.map((f) => ({ order: o, fn: f, in: daysFromToday(f.date) })))
      .filter((x) => x.in >= 0 && x.in <= 7)
      .sort((a, b) => a.fn.date.localeCompare(b.fn.date) || a.fn.time.localeCompare(b.fn.time));
    const followUps = enquiries
      .filter((e) => e.followUpAt && !["booked", "lost"].includes(e.stage))
      .map((e) => ({ e, name: name(e.clientId), in: daysFromToday(e.followUpAt!) }))
      .filter((x) => x.in <= 1)
      .sort((a, b) => a.in - b.in);
    const openEnquiries = enquiries.filter((e) => !["booked", "lost"].includes(e.stage)).length;
    return { upcoming, followUps, openEnquiries, guests: upcoming.reduce((s, x) => s + x.fn.pax, 0) };
  }, [orders, enquiries, clients]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("morning") : hour < 17 ? t("afternoon") : t("evening");
  const checklist = [
    { label: "Add your logo", done: !!tenant.logo, href: "/settings" },
    { label: "Upload your menu", done: items.length > 0, href: "/menu" },
    { label: "Add workers", done: workers > 0, href: "/staff" },
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
        <StatCard label="Guests this week" value={num(data.guests)} sub="Across the functions in the next 7 days" icon={Users} href="/kitchen" />
        {seesSales && <StatCard label={t("followUps")} value={String(data.followUps.length)} sub={data.followUps.some((f) => f.in < 0) ? "Some are overdue" : "Due today or tomorrow"} icon={PhoneCall} tone="info" href="/enquiries" />}
        {seesSales && <StatCard label="Open enquiries" value={String(data.openEnquiries)} sub="Not yet booked or lost" icon={MessagesSquare} href="/enquiries" />}
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
            {data.upcoming.map(({ order, fn }) => <EventCard key={fn.id} order={order} functionId={fn.id} showMoney={false} />)}
          </div>
        )}
      </section>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
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
                      <ChevronRight className="size-5 text-text-muted" strokeWidth={1.75} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <OpenIssues />
          <LowStock />
          <OpenTasks />
        </div>
      </div>
    </>
  );
}
