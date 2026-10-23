"use client";

import { ChevronLeft, ChevronRight, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { StatusBadge, statusToneOf } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card, Chip } from "@/components/ui/primitives";
import { festivalsOn } from "@/lib/festivals";
import { datesBetween, serviceLine, useFoodTypes } from "@/lib/services";
import { useCurrentUser, useStore } from "@/lib/store";
import { tithiLabel } from "@/lib/tithi";
import { useUi } from "@/lib/ui";
import { addDays, cn, fmtDate, fmtTime, isoDate, num, parseDate } from "@/lib/utils";

interface CalEvent {
  id: string;
  date: string;
  time: string;
  /** "Gala Dinner · Night · 9 pm to 11 pm" */
  service: string;
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

/** The tithi at sunrise beside the date; Purnima, Amavasya and Ekadashi stand out in gold. */
function TithiTag({ date, className }: { date: string; className?: string }) {
  const locale = useStore((s) => s.locale);
  const t = tithiLabel(date, locale);
  return <span title={t.full} className={cn("truncate text-xs font-medium leading-6 md:text-sm", t.special ? "font-semibold text-accent-gold" : "text-text-muted", className)}>{t.short}</span>;
}

/** Festival names for a day, as small gold labels. */
function FestivalTags({ date, className }: { date: string; className?: string }) {
  const names = festivalsOn(date);
  if (!names.length) return null;
  return (
    <span className={cn("flex flex-col gap-0.5", className)}>
      {names.map((n) => <span key={n} title={n} className="line-clamp-2 overflow-hidden rounded bg-accent-gold/15 px-0.5 py-0.5 text-[9px] font-semibold leading-tight tracking-tight text-accent-gold md:px-1.5 md:text-xs md:tracking-normal">{n}</span>)}
    </span>
  );
}

/** The next festivals from today, so the team can see busy seasons coming. */
function UpcomingFestivals({ today, onPick, bookings }: { today: string; onPick: (date: string) => void; bookings: (date: string) => number }) {
  const list = React.useMemo(() => {
    const out: { date: string; names: string[] }[] = [];
    for (let i = 0; i < 120 && out.length < 6; i++) {
      const d = isoDate(addDays(parseDate(today), i));
      const names = festivalsOn(d);
      if (names.length) out.push({ date: d, names });
    }
    return out;
  }, [today]);
  if (!list.length) return null;
  return (
    <div className="mt-5 border-t pt-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="size-4 text-accent-gold" strokeWidth={1.75} />Coming festivals</h3>
      <div className="-mx-2 mt-2">
        {list.map(({ date, names }) => (
          <button key={date} type="button" onClick={() => onPick(date)} className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-surface-muted">
            <span className="tnum w-14 shrink-0 text-xs text-text-muted">{fmtDate(date, { day: "numeric", month: "short" })}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{names.join(", ")}</span>
            {bookings(date) > 0 && <span className="tnum shrink-0 text-xs text-text-muted">{bookings(date)} booked</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const { orders, enquiries, clients, locale } = useStore();
  const role = useCurrentUser().role;
  const openEnquiry = useUi((s) => s.openEnquiry);
  const today = isoDate(new Date());
  const [view, setView] = React.useState<"month" | "week" | "agenda">("month");
  const [cursor, setCursor] = React.useState(today);
  const [selected, setSelected] = React.useState(today);
  const canSell = role === "owner" || role === "sales";
  const foodTypes = useFoodTypes();

  const byDate = React.useMemo(() => {
    const name = (id: string) => clients.find((c) => c.id === id)?.name ?? "";
    const events: CalEvent[] = [
      ...orders.flatMap((o) => o.functions.map((f) => ({ id: f.id, date: f.date, time: f.time, service: serviceLine(f, foodTypes), title: `${name(o.clientId)} · ${f.name}`, sub: f.venue, pax: f.pax, status: o.status, href: `/orders/${o.id}` }))),
      // An open enquiry shows on the day of each service it asks for, or on every day of the event.
      ...(canSell
        ? enquiries
            .filter((e) => !["booked", "lost"].includes(e.stage))
            .flatMap((e) =>
              e.services?.length
                ? e.services.map((f) => ({ id: `${e.id}-${f.id}`, date: f.date, time: f.time, service: serviceLine(f, foodTypes), title: `${name(e.clientId)} · ${f.name}`, sub: f.venue || e.venue, pax: f.pax, status: "enquiry", enquiryId: e.id }))
                : datesBetween(e.date, e.endDate).map((d) => ({ id: `${e.id}-${d}`, date: d, time: "", service: "", title: `${name(e.clientId)} · ${e.eventType}`, sub: e.venue, pax: e.pax, status: "enquiry", enquiryId: e.id })),
            )
        : []),
    ];
    const map = new Map<string, CalEvent[]>();
    for (const e of events.sort((a, b) => a.time.localeCompare(b.time))) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return map;
  }, [orders, enquiries, clients, canSell, foodTypes]);


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

  const EventRow = ({ e }: { e: CalEvent }) => {
    const body = (
      <>
        <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", dotCls[statusToneOf(e.status)])} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{e.title}</span>
          <span className="tnum block truncate text-xs text-text-muted">{e.service ? `${e.service} · ` : ""}{num(e.pax)} guests{e.sub ? ` · ${e.sub}` : ""}</span>
        </span>
        <StatusBadge status={e.status} />
      </>
    );
    const cls = "flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-muted";
    return e.href ? <Link href={e.href} className={cls}>{body}</Link> : <button type="button" className={cls} onClick={() => openEnquiry(e.enquiryId)}>{body}</button>;
  };

  return (
    <>
      <PageHeader title="Calendar" subtitle="Functions and enquiries by date, with the tithi and festivals for each day." action={canSell && <Button variant="primary" onClick={() => openEnquiry(undefined, selected)}><Plus strokeWidth={2} /><span className="max-sm:hidden">New enquiry</span></Button>}>
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
                  const outside = parseDate(d).getMonth() !== cur.getMonth();
                  const festivals = festivalsOn(d);
                  return (
                    <button key={d} type="button" onClick={() => setSelected(d)} aria-pressed={selected === d} aria-label={`${fmtDate(d)}${festivals.length ? `, ${festivals.join(", ")}` : ""}, ${events.length} events`} className={cn("flex min-h-20 flex-col border-b border-r p-1 text-left transition-colors duration-150 hover:bg-surface-muted/60 md:min-h-32 md:p-1.5", festivals.length > 0 && "bg-accent-gold/5", selected === d && "bg-primary-soft hover:bg-primary-soft", outside && "text-text-muted/60 opacity-70")}>
                      <span className="flex flex-col items-start md:flex-row md:justify-between md:gap-1">
                        <span className={cn("tnum grid size-6 shrink-0 place-items-center rounded-full text-xs font-medium", d === today && "bg-primary text-primary-fg")}>{parseDate(d).getDate()}</span>
                        <TithiTag date={d} className="max-md:max-w-full max-md:text-[10px] max-md:leading-4 max-md:tracking-tight" />
                      </span>
                      <FestivalTags date={d} className="mt-0.5" />
                      <span className="mt-1 hidden flex-1 flex-col gap-0.5 md:flex">
                        {events.slice(0, 2).map((e) => <span key={e.id} className={cn("truncate rounded px-1.5 py-0.5 text-xs font-medium", pill[statusToneOf(e.status)])}>{e.title}</span>)}
                        {events.length > 2 && <span className="px-1.5 text-xs text-text-muted">+{events.length - 2} more</span>}
                      </span>
                      <span className="mt-1 flex flex-1 flex-wrap content-start gap-0.5 md:hidden">{events.slice(0, 4).map((e) => <span key={e.id} className={cn("size-1.5 rounded-full", dotCls[statusToneOf(e.status)])} />)}</span>
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
                return (
                  <div key={d} className={cn("min-h-20 p-2 md:min-h-96", selected === d && "bg-primary-soft")}>
                    <button type="button" onClick={() => setSelected(d)} className="flex w-full items-center justify-between gap-2 text-left md:block">
                      <span className="text-xs font-medium text-text-muted">{fmtDate(d, { weekday: "short" })}</span>
                      <span className={cn("tnum grid size-7 place-items-center rounded-full font-heading text-sm font-semibold md:mt-1", d === today && "bg-primary text-primary-fg")}>{parseDate(d).getDate()}</span>
                      <TithiTag date={d} className="md:mt-1 md:block" />
                    </button>
                    <FestivalTags date={d} className="mt-1" />
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
                  <div className="px-2 pt-2">
                    <p className="text-sm font-medium">{fmtDate(d, { weekday: "short", day: "numeric", month: "short" })}</p>
                    <TithiTag date={d} className="block" />
                    <FestivalTags date={d} className="mt-1 items-start" />
                  </div>
                  <div>{events.map((e) => <EventRow key={e.id} e={e} />)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4 lg:sticky lg:top-20">
          <h2 className="font-heading text-lg font-semibold">{fmtDate(selected, { weekday: "long", day: "numeric", month: "long" })}</h2>
          <p className={cn("mt-1 text-sm", tithiLabel(selected).special ? "font-medium text-accent-gold" : "text-text-muted")}>{tithiLabel(selected).full}{locale !== "en" && ` · ${tithiLabel(selected, locale).short}`}</p>
          {festivalsOn(selected).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {festivalsOn(selected).map((n) => <span key={n} className="inline-flex items-center gap-1 rounded-full bg-accent-gold/15 px-2.5 py-1 text-xs font-semibold text-accent-gold"><Sparkles className="size-3.5" strokeWidth={1.75} />{n}</span>)}
            </div>
          )}
          <div className="-mx-2 mt-3">
            {selectedEvents.map((e) => <EventRow key={e.id} e={e} />)}
            {selectedEvents.length === 0 && <p className="px-2 py-6 text-center text-sm text-text-muted">Nothing booked. This date is free.</p>}
          </div>
          {canSell && selected >= today && <Button className="mt-3 w-full" onClick={() => openEnquiry(undefined, selected)}><Plus strokeWidth={1.75} />Add enquiry on this date</Button>}
          <UpcomingFestivals today={today} onPick={(d) => { setSelected(d); setCursor(d); }} bookings={(d) => byDate.get(d)?.length ?? 0} />
        </Card>
      </div>
    </>
  );
}
