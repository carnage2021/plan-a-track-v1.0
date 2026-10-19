"use client";

import { Cake, CalendarHeart, Check, DatabaseZap, Heart, MessageCircle, RotateCcw, Search, Send, Users } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/badges";
import { EmptyState, PageHeader, StatCard } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Card, CardTitle, Chip, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { defaultTemplates, fillTemplate, logWhatsApp, useMessages, type Audience } from "@/lib/messages";
import { priceQuote } from "@/lib/pricing";
import { useStaff } from "@/lib/staff";
import { useStore } from "@/lib/store";
import type { Client, Order } from "@/lib/types";
import { addDays, cn, daysFromToday, fmtDate, isoDate, money, parseDate, whatsappLink, localDay } from "@/lib/utils";

/** Opens WhatsApp with the message ready and records it in the log. */
function SendButton({ template, name, phone, body, orderId, sent, onSent, compact }: { template: string; name: string; phone: string; body: string; orderId?: string; sent?: boolean; onSent?: () => void; compact?: boolean }) {
  if (!phone) return <span className="text-xs text-text-muted">No phone</span>;
  return (
    <Button variant={sent ? "ghost" : compact ? "secondary" : "primary"} asChild>
      <a href={whatsappLink(phone, body)} target="_blank" rel="noreferrer" onClick={() => { logWhatsApp(template, name, phone, body, orderId)(); onSent?.(); }}>
        {sent ? <Check strokeWidth={1.75} /> : <Send strokeWidth={1.75} />}{sent ? "Sent" : "Send"}
      </a>
    </Button>
  );
}

/** Days until the next time this date comes round, ignoring the year. */
function daysToNext(iso: string) {
  const today = new Date();
  const [, m, d] = iso.split("-").map(Number);
  let next = new Date(today.getFullYear(), m - 1, d);
  if (isoDate(next) < isoDate(today)) next = new Date(today.getFullYear() + 1, m - 1, d);
  return daysFromToday(isoDate(next));
}

function Greetings() {
  const clients = useStore((s) => s.clients);
  const business = useStore((s) => s.tenant.name);
  const template = useMessages((s) => s.template);
  const log = useMessages((s) => s.log);
  const year = String(new Date().getFullYear());
  const list = clients
    .flatMap((c) => [
      c.birthday ? { c, kind: "birthday" as const, in: daysToNext(c.birthday) } : null,
      c.anniversary ? { c, kind: "anniversary" as const, in: daysToNext(c.anniversary) } : null,
    ])
    .filter((x): x is { c: Client; kind: "birthday" | "anniversary"; in: number } => !!x && x.in <= 7)
    .sort((a, b) => a.in - b.in);
  const withDates = clients.filter((c) => c.birthday || c.anniversary).length;
  return (
    <Card>
      <CardTitle action={<span className="text-xs text-text-muted">{withDates} clients have dates saved</span>}>Birthdays and anniversaries this week</CardTitle>
      {list.length === 0 ? (
        <p className="px-5 pb-6 text-sm text-text-muted">None in the next 7 days. Add birthdays and anniversaries on the Clients page and they show here when they come round.</p>
      ) : (
        <ul className="divide-y">
          {list.map(({ c, kind, in: n }) => {
            const body = fillTemplate(template(kind), { client: c.name, business });
            const sent = log.some((m) => m.templateKey === kind && m.phone === c.phone && localDay(m.at).startsWith(year));
            return (
              <li key={`${c.id}-${kind}`} className="flex items-center gap-3 px-4 py-3 md:px-5">
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", kind === "birthday" ? "bg-accent-gold/15 text-accent-gold" : "bg-danger/10 text-danger")}>{kind === "birthday" ? <Cake className="size-5" strokeWidth={1.75} /> : <Heart className="size-5" strokeWidth={1.75} />}</span>
                <span className="min-w-0 flex-1"><span className="block font-medium">{c.name}</span><span className="block text-xs text-text-muted">{kind === "birthday" ? "Birthday" : "Anniversary"} {n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`}</span></span>
                <SendButton template={kind} name={c.name} phone={c.phone} body={body} sent={sent} compact={n > 0} />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function EventMessages() {
  const { orders, clients, tenant, items, packages } = useStore();
  const { tasks, workers } = useStaff();
  const template = useMessages((s) => s.template);
  const log = useMessages((s) => s.log);
  const tomorrow = isoDate(addDays(new Date(), 1));
  const name = (o: Order) => clients.find((c) => c.id === o.clientId);
  const live = orders.filter((o) => o.status !== "cancelled" && o.status !== "tentative");
  const upcoming = live.flatMap((o) => o.functions.filter((f) => f.date === tomorrow).map((f) => ({ o, f })));
  const done = live.filter((o) => {
    const last = [...o.functions].sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? "";
    return last && daysFromToday(last) < 0 && daysFromToday(last) >= -7;
  });
  const duty = tasks.filter((t) => t.workerId && upcoming.some((u) => u.f.id === t.functionId));
  const byWorker = [...new Set(duty.map((t) => t.workerId!))].map((id) => ({ w: workers.find((x) => x.id === id), list: duty.filter((t) => t.workerId === id) })).filter((x) => x.w);
  const sentFor = (key: string, orderId?: string, phone?: string) => log.some((m) => m.templateKey === key && (orderId ? m.orderId === orderId : true) && (phone ? m.phone === phone : true) && daysFromToday(localDay(m.at)) >= -1);
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card>
        <CardTitle>Tomorrow&apos;s events: update the client</CardTitle>
        {upcoming.length === 0 ? <p className="px-5 pb-6 text-sm text-text-muted">No functions tomorrow.</p> : (
          <ul className="divide-y">
            {upcoming.map(({ o, f }) => {
              const c = name(o);
              const body = fillTemplate(template("event_update"), { client: c?.name ?? "", business: tenant.name, event: `${f.name} (${o.eventType})`, date: fmtDate(f.date, { day: "numeric", month: "short" }), order: o.number });
              return <li key={f.id} className="flex items-center gap-3 px-4 py-3 md:px-5"><span className="min-w-0 flex-1"><span className="block font-medium">{c?.name}</span><span className="block text-xs text-text-muted">{f.name} · {f.venue}</span></span><SendButton template="event_update" name={c?.name ?? ""} phone={c?.phone ?? ""} body={body} orderId={o.id} sent={sentFor("event_update", o.id)} /></li>;
            })}
          </ul>
        )}
      </Card>
      <Card>
        <CardTitle>Duty reminders for tomorrow</CardTitle>
        {byWorker.length === 0 ? <p className="px-5 pb-6 text-sm text-text-muted">Nobody is on duty tomorrow, or tasks are not assigned yet.</p> : (
          <ul className="divide-y">
            {byWorker.map(({ w, list }) => {
              const fn = upcoming.find((u) => u.f.id === list[0].functionId);
              const body = fillTemplate(template("duty_reminder"), { client: w!.name, business: tenant.name, event: `${fn?.f.name} (${list.map((t) => t.title).join(", ")})${list[0].startTime ? ` from ${list[0].startTime}` : ""} at ${fn?.f.venue}`, date: fmtDate(tomorrow, { weekday: "short", day: "numeric", month: "short" }) });
              return <li key={w!.id} className="flex items-center gap-3 px-4 py-3 md:px-5"><span className="min-w-0 flex-1"><span className="block font-medium">{w!.name}</span><span className="block truncate text-xs text-text-muted">{list.map((t) => t.title).join(", ")}</span></span><SendButton template="duty_reminder" name={w!.name} phone={w!.phone} body={body} sent={sentFor("duty_reminder", undefined, w!.phone)} /></li>;
            })}
          </ul>
        )}
      </Card>
      <Card className="xl:col-span-2">
        <CardTitle>Thank you and feedback: events of the last 7 days</CardTitle>
        {done.length === 0 ? <p className="px-5 pb-6 text-sm text-text-muted">No events finished in the last week.</p> : (
          <ul className="divide-y">
            {done.map((o) => {
              const c = name(o);
              const body = fillTemplate(template("thank_you"), { client: c?.name ?? "", business: tenant.name, event: o.eventType.toLowerCase(), order: o.number, amount: money(priceQuote(o, items, packages, tenant.slabs).grand) });
              return <li key={o.id} className="flex items-center gap-3 px-4 py-3 md:px-5"><span className="min-w-0 flex-1"><span className="block font-medium">{c?.name}</span><span className="block text-xs text-text-muted">{o.eventType} · {o.number}</span></span><SendButton template="thank_you" name={c?.name ?? ""} phone={c?.phone ?? ""} body={body} orderId={o.id} sent={log.some((m) => m.templateKey === "thank_you" && m.orderId === o.id)} /></li>;
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Bulk() {
  const { clients, orders, tenant } = useStore();
  const template = useMessages((s) => s.template);
  const [audience, setAudience] = React.useState<"all" | "recent" | "vip" | "repeat">("recent");
  const [key, setKey] = React.useState("festival");
  const [festival, setFestival] = React.useState("Diwali");
  const [text, setText] = React.useState(() => template("festival"));
  const [q, setQ] = React.useState("");
  const [sent, setSent] = React.useState<Set<string>>(new Set());
  const yearAgo = isoDate(addDays(new Date(), -365));
  const recent = new Set(orders.filter((o) => o.functions.some((f) => f.date >= yearAgo)).map((o) => o.clientId));
  const list = clients.filter((c) => c.phone && (audience === "all" || (audience === "recent" ? recent.has(c.id) : c.tags.includes(audience))) && c.name.toLowerCase().includes(q.toLowerCase()));
  const pick = (k: string) => { setKey(k); setText(template(k)); setSent(new Set()); };
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.2fr] lg:items-start">
      <Card className="space-y-4 p-4 md:p-5">
        <Field label="Who gets it"><Select value={audience} onChange={(e) => { setAudience(e.target.value as typeof audience); setSent(new Set()); }}><option value="recent">Clients with an event in the last 12 months</option><option value="all">All clients</option><option value="vip">VIP clients</option><option value="repeat">Repeat clients</option></Select></Field>
        <div className="flex flex-wrap gap-2">{["festival", "offer", "thank_you"].map((k) => <Chip key={k} active={key === k} onClick={() => pick(k)}>{defaultTemplates.find((t) => t.key === k)?.label}</Chip>)}<Chip active={key === "custom"} onClick={() => { setKey("custom"); setText(""); }}>Write your own</Chip></div>
        {key === "festival" && <Field label="Festival"><Input value={festival} onChange={(e) => setFestival(e.target.value)} placeholder="Diwali, Navratri, Eid, Christmas" /></Field>}
        <Field label="Message" hint="{client} becomes each person's name."><Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} /></Field>
        <div className="rounded-xl bg-[#e7f8ee] p-3 text-sm text-gray-900 dark:bg-[#123b26] dark:text-gray-100"><p className="text-xs font-medium text-[#128c4b]">Preview</p><p className="mt-1 whitespace-pre-line">{fillTemplate(text, { client: list[0]?.name ?? "Client", business: tenant.name, festival })}</p></div>
        <p className="text-xs text-text-muted">WhatsApp opens once per person with the message ready, so nothing is sent without you pressing send. Sending to a whole list in one go needs a WhatsApp Business API provider.</p>
      </Card>
      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4 md:p-5">
          <div className="relative min-w-40 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" strokeWidth={1.75} /><Input aria-label="Search" className="pl-9" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <p className="tnum text-sm"><span className="font-semibold">{sent.size}</span><span className="text-text-muted"> of {list.length} sent</span></p>
        </div>
        {list.length === 0 ? <p className="border-t px-5 py-8 text-center text-sm text-text-muted">No clients with a phone number in this group.</p> : (
          <ul className="max-h-[32rem] divide-y overflow-y-auto border-t">
            {list.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-2.5 md:px-5">
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{c.name}</span><span className="tnum block text-xs text-text-muted">{c.phone}</span></span>
                <SendButton template={key} name={c.name} phone={c.phone} body={fillTemplate(text, { client: c.name, business: tenant.name, festival })} sent={sent.has(c.id)} compact onSent={() => setSent((s) => new Set(s).add(c.id))} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

const audienceLabel: Record<Audience, string> = { client: "To clients", vendor: "To vendors", worker: "To workers", everyone: "Everyone" };

function Templates() {
  const { overrides, template, saveTemplate } = useMessages();
  const [edit, setEdit] = React.useState<Record<string, string>>({});
  return (
    <div className="space-y-6">
      {(["client", "vendor", "worker"] as Audience[]).map((a) => (
        <section key={a}>
          <h2 className="mb-2 font-heading font-semibold">{audienceLabel[a]}</h2>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {defaultTemplates.filter((t) => t.audience === a).map((t) => {
              const value = edit[t.key] ?? template(t.key);
              const dirty = value !== template(t.key);
              return (
                <Card key={t.key} className="space-y-2 p-4">
                  <p className="flex items-center gap-2 font-medium">{t.label}{overrides[t.key] && <Badge tone="primary">Your wording</Badge>}</p>
                  <Textarea rows={3} aria-label={`${t.label} message`} value={value} onChange={(e) => setEdit({ ...edit, [t.key]: e.target.value })} />
                  <div className="flex gap-2">
                    <Button variant="primary" disabled={!dirty || !value.trim()} onClick={() => { saveTemplate(t.key, value.trim()); setEdit((all) => Object.fromEntries(Object.entries(all).filter(([k]) => k !== t.key))); toast.success(`${t.label} saved`); }}>Save</Button>
                    {overrides[t.key] && <Button variant="ghost" onClick={() => { saveTemplate(t.key, null); setEdit((all) => Object.fromEntries(Object.entries(all).filter(([k]) => k !== t.key))); toast("Back to the default wording"); }}><RotateCcw strokeWidth={1.75} />Default</Button>}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
      <p className="text-xs text-text-muted">Use {"{client}"}, {"{business}"}, {"{event}"}, {"{order}"}, {"{amount}"}, {"{date}"} and {"{festival}"}; they are filled in when the message is sent.</p>
    </div>
  );
}

function Log() {
  const log = useMessages((s) => s.log);
  const [q, setQ] = React.useState("");
  const label = (k: string) => defaultTemplates.find((t) => t.key === k)?.label ?? ({ trip: "Trip to driver", outsource_order: "Outsource order", custom: "Custom" } as Record<string, string>)[k] ?? k;
  const shown = log.filter((m) => `${m.name} ${m.phone} ${m.body}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Card>
      <div className="p-4 md:p-5"><div className="relative max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" strokeWidth={1.75} /><Input aria-label="Search messages" className="pl-9" placeholder="Search by name, number or text" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
      {shown.length === 0 ? <p className="border-t px-5 py-8 text-center text-sm text-text-muted">No messages yet. Receipts, reminders, quotations and greetings sent from the app are listed here.</p> : (
        <ul className="divide-y border-t">
          {shown.map((m) => (
            <li key={m.id} className="px-4 py-3 md:px-5">
              <p className="flex flex-wrap items-center gap-2 text-sm"><span className="font-medium">{m.name || m.phone}</span><Badge>{label(m.templateKey)}</Badge><span className="tnum text-xs text-text-muted">{fmtDate(localDay(m.at), { day: "numeric", month: "short" })} {new Date(m.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span></p>
              <p className="mt-1 line-clamp-2 text-sm text-text-muted">{m.body}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function MessagesPage() {
  const ready = useMessages((s) => s.ready);
  const log = useMessages((s) => s.log);
  const month = isoDate(new Date()).slice(0, 7);
  return (
    <>
      <PageHeader title="Messages" subtitle="Greetings, event updates, reminders and offers on WhatsApp, with every message on record." />
      {!ready ? (
        <EmptyState icon={DatabaseZap} title="One database step is pending" help="Run supabase/migrations/0009_reports_messages_access.sql in the Supabase SQL editor, then reload this page. It adds message templates, the message log and client birthdays." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCard label="Sent this month" value={String(log.filter((m) => localDay(m.at).startsWith(month)).length)} sub="From every screen" icon={MessageCircle} />
            <StatCard label="Greetings this year" value={String(log.filter((m) => ["birthday", "anniversary", "festival"].includes(m.templateKey) && localDay(m.at).startsWith(month.slice(0, 4))).length)} sub="Birthdays, anniversaries, festivals" icon={CalendarHeart} tone="success" />
            <StatCard label="Reminders sent" value={String(log.filter((m) => m.templateKey === "reminder" && parseDate(localDay(m.at)) >= addDays(new Date(), -30)).length)} sub="Last 30 days" icon={Users} tone="info" />
          </div>
          <Tabs defaultValue="today" className="mt-6">
            <TabsList>
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="bulk">Greetings and offers</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="log">Sent<Badge>{log.length}</Badge></TabsTrigger>
            </TabsList>
            <TabsContent value="today" className="space-y-4"><Greetings /><EventMessages /></TabsContent>
            <TabsContent value="bulk"><Bulk /></TabsContent>
            <TabsContent value="templates"><Templates /></TabsContent>
            <TabsContent value="log"><Log /></TabsContent>
          </Tabs>
        </>
      )}
    </>
  );
}
