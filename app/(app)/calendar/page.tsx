"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { StatusBadge, statusToneOf } from "@/components/shared/badges";
import { PageHeader, ProgressBar } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card, Chip } from "@/components/ui/primitives";
import { useCurrentUser, useStore } from "@/lib/store";
import { useUi } from "@/lib/ui";
import { addDays, cn, fmtDate, fmtTime, isoDate, num, parseDate } from "@/lib/utils";

interface CalEvent {
  id: string;
  date: string;
  time: string;
  title: string;
  sub: string;
  pax: number;
  status: string;
  href?: string;
  enquiryId?: string;
}

const pill: Record<string, string> = {
  info: "bg-info/10 text-info",
  warning: "bg-warning/10 text-warning",
  success: "bg-success/10 text-success",
  primary: "bg-primary-soft text-primary",
  neutral: "bg-surface-muted text-text-muted",
  danger: "bg-danger/10 text-danger line-through",
};
const dotCls: Record<string, string> = { info: "bg-info", warning: "bg-warning", success: "bg-success", primary: "bg-primary", neutral: "bg-text-muted", danger: "bg-danger" };
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));

export default function CalendarPage() {
  const { orders, enquiries, clients, tenant } = useStore();
  const role = useCurrentUser().role;
  const openEnquiry = useUi((s) => s.openEnquiry);
  const today = isoDate(new Date());
  const [view, setView] = React.useState<"month" | "week" | "agenda">("month");
  const [cursor, setCursor] = React.useState(today);
  const [selected, setSelected] = React.useState(today);
  const canSell = role === "owner" || role === "sales";

  const byDate = React.useMemo(() => {
    const name = (id: string) => clients.find((c) => c.id === id)?.name ?? "";
    const events: CalEvent[] = [
      ...orders.flatMap((o) => o.functions.map((f) => ({ id: f.id, date: f.date, time: f.time, title: `${name(o.clientId)} · ${f.name}`, sub: f.venue, pax: f.pax, status: o.status, href: `/orders/${o.id}` }))),
      ...(canSell ? enquiries.filter((e) => !["booked", "lost"].includes(e.stage)).map((e) => ({ id: e.id, date: e.date, time: "", title: `${name(e.clientId)} · ${e.eventType}`, sub: e.venue, pax: e.pax, status: "enquiry", enquiryId: e.id })) : []),
    ];
    const map = new Map<string, CalEvent[]>();
    for (const e of events.sort((a, b) => a.time.localeCompare(b.time))) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return map;
  }, [orders, enquiries, clients, canSell]);

  /** Guests on confirmed and tentative orders for a date; enquiries do not count against capacity. */
  const load = (date: string) => (byDate.get(date) ?? []).filter((e) => e.href && e.status !== "cancelled").reduce((s, e) => s + e.pax, 0);
  const loadTone = (pax: number) => (pax > tenant.dailyCapacityPax ? "danger" : pax > tenant.dailyCapacityPax * 0.7 ? "warning" : "success");

  const cur = parseDate(cursor);
  const monthStart = new Date(cur.getFullYear(), cur.getMonth(), 1);
  const gridStart = mondayOf(monthStart);
  const weeks = Math.ceil(((monthStart.getDay() + 6) % 7 + new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate()) / 7);
  const monthDays = Array.from({ length: weeks * 7 }, (_, i) => isoDate(addDays(gridStart, i)));
  const weekDays = Array.from({ length: 7 }, (_, i) => isoDate(addDays(mondayOf(cur), i)));
  const agenda = [...byDate.entries()].filter(([d]) => d >= today).sort(([a], [b]) => a.localeCompare(b));
  const step = (dir: number) => setCursor(isoDate(view === "week" ? addDays(cur, 7 * dir) : new Date(cur.getFullYear(), cur.getMonth() + dir, 1)));
  const title = view === "week" ? `${fmtDate(weekDays[0], { day: "numeric", month: "short" })} to ${fmtDate(weekDays[6], { day: "numeric", month: "short", year: "numeric" })}` : fmtDate(cursor, { month: "long", year: "numeric" });
  const selectedEvents = byDate.get(selected) ?? [];
  const selectedLoad = load(selected);

  const EventRow = ({ e }: { e: CalEvent }) => {
    const body = (
      <>
        <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", dotCls[statusToneOf(e.status)])} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{e.title}</span>
          <span className="tnum block truncate text-xs text-text-muted">{e.time ? `${fmtTime(e.time)} · ` : ""}{num(e.pax)} guests{e.sub ? ` · ${e.sub}` : ""}</span>
        </span>
        <StatusBadge status={e.status} />
      </>
    );
    const cls = "flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-muted";
    return e.href ? <Link href={e.href} className={cls}>{body}</Link> : <button type="button" className={cls} onClick={() => openEnquiry(e.enquiryId)}>{body}</button>;
  };

  return (
    <>
      <PageHeader title="Calendar" subtitle={`Kitchen capacity is ${num(tenant.dailyCapacityPax)} guests a day.`} action={canSell && <Button variant="primary" onClick={() => openEnquiry(undefined, selected)}><Plus strokeWidth={2} /><span className="max-sm:hidden">New enquiry</span></Button>}>
        {(["month", "week", "agenda"] as const).map((v) => <Chip key={v} active={view === v} onClick={() => setView(v)} className="capitalize">{v}</Chip>)}
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
        <Card className="overflow-hidden">
          {view !== "agenda" && (
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <Button variant="ghost" size="icon" onClick={() => step(-1)} aria-label="Previous"><ChevronLeft strokeWidth={1.75} /></Button>
              <Button variant="ghost" size="icon" onClick={() => step(1)} aria-label="Next"><ChevronRight strokeWidth={1.75} /></Button>
              <h2 className="flex-1 font-heading text-base font-semibold">{title}</h2>
              <Button onClick={() => { setCursor(today); setSelected(today); }}>Today</Button>
            </div>
          )}

          {view === "month" && (
            <div>
              <div className="grid grid-cols-7 border-b bg-surface-muted text-center text-xs font-medium text-text-muted">{weekdays.map((d) => <div key={d} className="py-2">{d}</div>)}</div>
              <div className="grid grid-cols-7">
                {monthDays.map((d) => {
                  const events = byDate.get(d) ?? [];
                  const pax = load(d);
                  const outside = parseDate(d).getMonth() !== cur.getMonth();
                  return (
                    <button key={d} type="button" onClick={() => setSelected(d)} aria-pressed={selected === d} aria-label={`${fmtDate(d)}, ${events.length} events`} className={cn("flex min-h-16 flex-col border-b border-r p-1 text-left transition-colors duration-150 hover:bg-surface-muted/60 md:min-h-28 md:p-1.5", selected === d && "bg-primary-soft hover:bg-primary-soft", outside && "text-text-muted/60")}>
                      <span className={cn("tnum grid size-6 place-items-center rounded-full text-xs font-medium", d === today && "bg-primary text-primary-fg")}>{parseDate(d).getDate()}</span>
                      <span className="mt-1 hidden flex-1 flex-col gap-0.5 md:flex">
                        {events.slice(0, 2).map((e) => <span key={e.id} className={cn("truncate rounded px-1.5 py-0.5 text-xs font-medium", pill[statusToneOf(e.status)])}>{e.title}</span>)}
                        {events.length > 2 && <span className="px-1.5 text-xs text-text-muted">+{events.length - 2} more</span>}
                      </span>
                      <span className="mt-1 flex flex-1 flex-wrap content-start gap-0.5 md:hidden">{events.slice(0, 4).map((e) => <span key={e.id} className={cn("size-1.5 rounded-full", dotCls[statusToneOf(e.status)])} />)}</span>
                      {pax > 0 && <ProgressBar value={(pax / tenant.dailyCapacityPax) * 100} tone={loadTone(pax)} className="mt-1 h-1 w-full" label="Kitchen load" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {view === "week" && (
            <div className="grid divide-y md:grid-cols-7 md:divide-x md:divide-y-0">
              {weekDays.map((d) => {
                const events = byDate.get(d) ?? [];
                const pax = load(d);
                return (
                  <div key={d} className={cn("min-h-20 p-2 md:min-h-96", selected === d && "bg-primary-soft")}>
                    <button type="button" onClick={() => setSelected(d)} className="flex w-full items-center justify-between gap-2 text-left md:block">
                      <span className="text-xs font-medium text-text-muted">{fmtDate(d, { weekday: "short" })}</span>
                      <span className={cn("tnum grid size-7 place-items-center rounded-full font-heading text-sm font-semibold md:mt-1", d === today && "bg-primary text-primary-fg")}>{parseDate(d).getDate()}</span>
                    </button>
                    {pax > 0 && <ProgressBar value={(pax / tenant.dailyCapacityPax) * 100} tone={loadTone(pax)} className="mt-2 h-1" label="Kitchen load" />}
                    <div className="mt-2 space-y-1">
                      {events.map((e) => (
                        <button key={e.id} type="button" onClick={() => setSelected(d)} className={cn("block w-full rounded-lg px-2 py-1.5 text-left text-xs", pill[statusToneOf(e.status)])}>
                          <span className="block truncate font-medium">{e.title}</span>
                          <span className="tnum block truncate opacity-80">{e.time ? `${fmtTime(e.time)} · ` : ""}{num(e.pax)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {view === "agenda" && (
            <div className="divide-y">
              {agenda.length === 0 && <p className="p-8 text-center text-sm text-text-muted">Nothing coming up.</p>}
              {agenda.map(([d, events]) => (
                <div key={d} className="grid gap-2 p-3 sm:grid-cols-[120px_1fr]">
                  <p className="px-2 pt-2 text-sm font-medium">{fmtDate(d, { weekday: "short", day: "numeric", month: "short" })}</p>
                  <div>{events.map((e) => <EventRow key={e.id} e={e} />)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4 lg:sticky lg:top-20">
          <h2 className="font-heading text-lg font-semibold">{fmtDate(selected, { weekday: "long", day: "numeric", month: "long" })}</h2>
          <div className="mt-3">
            <div className="tnum mb-1.5 flex justify-between text-xs text-text-muted"><span>{num(selectedLoad)} of {num(tenant.dailyCapacityPax)} guests booked</span><span>{Math.round((selectedLoad / tenant.dailyCapacityPax) * 100)}%</span></div>
            <ProgressBar value={(selectedLoad / tenant.dailyCapacityPax) * 100} tone={loadTone(selectedLoad)} className="h-2" label="Kitchen load" />
            {selectedLoad > tenant.dailyCapacityPax && <p className="mt-2 text-xs text-danger">Over capacity. Check staff and kitchen before taking more for this date.</p>}
          </div>
          <div className="-mx-2 mt-3">
            {selectedEvents.map((e) => <EventRow key={e.id} e={e} />)}
            {selectedEvents.length === 0 && <p className="px-2 py-6 text-center text-sm text-text-muted">Nothing booked. This date is free.</p>}
          </div>
          {canSell && selected >= today && <Button className="mt-3 w-full" onClick={() => openEnquiry(undefined, selected)}><Plus strokeWidth={1.75} />Add enquiry on this date</Button>}
        </Card>
      </div>
    </>
  );
}
