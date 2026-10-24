"use client";

import { ClipboardList, Contact, FileText, MessageCircle, MessagesSquare, Phone, Search, Star } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { ReferralPanel } from "@/components/sales/referral-panel";
import { Badge, StatusBadge } from "@/components/shared/badges";
import { Avatar, EmptyState, PageHeader } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Card, Chip, Skeleton } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { paidAmount, priceQuote } from "@/lib/pricing";
import { useStore } from "@/lib/store";
import type { Client, Locale } from "@/lib/types";
import { cn, fmtDate, money, num, whatsappLink } from "@/lib/utils";

const typeLabel: Record<Client["type"], string> = { retail: "Family", corporate: "Corporate", agency: "Partner agency" };
const langLabel: Record<Locale, string> = { en: "English", hi: "Hindi", gu: "Gujarati" };
type Filter = "all" | "vip" | "repeat" | "corporate" | "agency" | "due";

/** Every client with what they have booked, paid and still owe. */
function useClientRows() {
  const { clients, orders, enquiries, quotations, items, packages, tenant } = useStore();
  return React.useMemo(
    () =>
      clients
        .map((c) => {
          const mine = orders.filter((o) => o.clientId === c.id);
          const live = mine.filter((o) => o.status !== "cancelled");
          const billed = live.reduce((s, o) => s + priceQuote(o, items, packages, tenant.slabs).grand, 0);
          const paid = mine.reduce((s, o) => s + paidAmount(o.payments), 0);
          const dates = live.flatMap((o) => o.functions.map((f) => f.date)).sort();
          return {
            c,
            orders: mine,
            enquiries: enquiries.filter((e) => e.clientId === c.id),
            quotations: quotations.filter((q) => q.clientId === c.id && q.status !== "superseded"),
            billed,
            paid,
            due: Math.max(0, billed - paid),
            guests: live.reduce((s, o) => s + o.functions.reduce((g, f) => g + f.pax, 0), 0),
            lastDate: dates[dates.length - 1],
          };
        })
        .sort((a, b) => (b.lastDate ?? "").localeCompare(a.lastDate ?? "") || a.c.name.localeCompare(b.c.name)),
    [clients, orders, enquiries, quotations, items, packages, tenant.slabs],
  );
}
type Row = ReturnType<typeof useClientRows>[number];

function Tags({ c }: { c: Client }) {
  return (
    <>
      {c.tags.includes("vip") && <Badge tone="gold"><Star strokeWidth={2} />VIP</Badge>}
      {c.tags.includes("repeat") && <Badge tone="info">Repeat</Badge>}
    </>
  );
}

function ClientSheet({ row, onClose }: { row: Row; onClose: () => void }) {
  const saveClient = useStore((s) => s.saveClient);
  const tenantName = useStore((s) => s.tenant.name);
  const [form, setForm] = React.useState<Client>(row.c);
  const set = <K extends keyof Client>(k: K, v: Client[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggleTag = (t: "vip" | "repeat") => set("tags", form.tags.includes(t) ? form.tags.filter((x) => x !== t) : [...form.tags, t]);
  const changed = JSON.stringify(form) !== JSON.stringify(row.c);
  const payments = row.orders.flatMap((o) => o.payments.map((p) => ({ ...p, order: o.number }))).sort((a, b) => b.date.localeCompare(a.date));
  // One timeline, newest first, so the whole relationship reads top to bottom.
  const history = [
    ...row.enquiries.map((e) => ({ key: e.id, date: e.createdAt, icon: MessagesSquare, title: `Enquiry · ${e.eventType}`, sub: `${num(e.pax)} guests on ${fmtDate(e.date, { day: "numeric", month: "short", year: "numeric" })}`, status: e.stage, href: "/enquiries" })),
    ...row.quotations.map((q) => ({ key: q.id, date: q.createdAt, icon: FileText, title: `Quotation ${q.number}${q.version > 1 ? ` v${q.version}` : ""}`, sub: q.eventType, status: q.status, href: `/quotations/${q.id}` })),
    ...row.orders.map((o) => ({ key: o.id, date: o.createdAt, icon: ClipboardList, title: `Order ${o.number}`, sub: `${o.eventType} · ${o.functions.map((f) => f.name).join(", ")}`, status: o.status, href: `/orders/${o.id}` })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={row.c.name}
      description={`${typeLabel[row.c.type]}${row.lastDate ? ` · last event ${fmtDate(row.lastDate)}` : ""}`}
      wide
      footer={<><Button variant="ghost" onClick={onClose}>Close</Button><Button variant="primary" disabled={!changed || !form.name.trim()} onClick={() => { saveClient({ ...form, name: form.name.trim() }); toast.success("Client updated"); onClose(); }}>Save changes</Button></>}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <Button asChild><a href={whatsappLink(row.c.phone, `Namaste ${row.c.name}, this is ${tenantName}.`)} target="_blank" rel="noreferrer"><MessageCircle strokeWidth={1.75} />WhatsApp</a></Button>
          <Button variant="ghost" asChild><a href={`tel:${row.c.phone.replace(/\s/g, "")}`}><Phone strokeWidth={1.75} />{row.c.phone}</a></Button>
        </div>

        <dl className="tnum grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[["Orders", num(row.orders.filter((o) => o.status !== "cancelled").length)], ["Guests served", num(row.guests)], ["Billed", money(row.billed)], [row.due ? "Balance due" : "Paid in full", money(row.due ? row.due : row.paid)]].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-surface-muted p-3"><dt className="text-xs text-text-muted">{k}</dt><dd className={cn("font-heading text-lg font-bold", k === "Balance due" && "text-warning")}>{v}</dd></div>
          ))}
        </dl>

        <ReferralPanel client={row.c} />

        <section>
          <h3 className="font-heading text-base font-semibold">History</h3>
          {history.length === 0 ? <p className="mt-2 text-sm text-text-muted">Nothing yet.</p> : (
            <ul className="mt-2 divide-y rounded-xl border">
              {history.map((h) => (
                <li key={h.key}>
                  <Link href={h.href} className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-muted/60">
                    <h.icon className="size-5 shrink-0 text-text-muted" strokeWidth={1.75} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{h.title}</span><span className="block truncate text-xs text-text-muted">{fmtDate(h.date, { day: "numeric", month: "short", year: "numeric" })} · {h.sub}</span></span>
                    <StatusBadge status={h.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {payments.length > 0 && (
          <section>
            <h3 className="font-heading text-base font-semibold">Payments</h3>
            <ul className="tnum mt-2 divide-y text-sm">
              {payments.map((p) => <li key={p.id} className="flex justify-between gap-3 py-2"><span className="min-w-0 truncate">{p.receiptNo} · {p.order}<span className="block text-xs text-text-muted">{fmtDate(p.date)}{p.note ? ` · ${p.note}` : ""}</span></span><span className="shrink-0 font-medium">{money(p.amount)}</span></li>)}
            </ul>
          </section>
        )}

        <section className="space-y-3">
          <h3 className="font-heading text-base font-semibold">Details</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name"><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label="Mobile number"><Input inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
            <Field label="Email"><Input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value || undefined)} /></Field>
            <Field label="GSTIN" hint="For corporate invoices."><Input className="uppercase" maxLength={15} value={form.gstin ?? ""} onChange={(e) => set("gstin", e.target.value || undefined)} /></Field>
            <Field label="Client type"><Select value={form.type} onChange={(e) => set("type", e.target.value as Client["type"])}>{(Object.keys(typeLabel) as Client["type"][]).map((t) => <option key={t} value={t}>{typeLabel[t]}</option>)}</Select></Field>
            <Field label="Documents in"><Select value={form.language} onChange={(e) => set("language", e.target.value as Locale)}>{(Object.keys(langLabel) as Locale[]).map((l) => <option key={l} value={l}>{langLabel[l]}</option>)}</Select></Field>
            <Field label="Birthday" hint="For an automatic greeting each year."><Input type="date" value={form.birthday ?? ""} onChange={(e) => set("birthday", e.target.value || undefined)} /></Field>
            <Field label="Anniversary"><Input type="date" value={form.anniversary ?? ""} onChange={(e) => set("anniversary", e.target.value || undefined)} /></Field>
            <Field label="Address" className="sm:col-span-2"><Textarea value={form.address ?? ""} onChange={(e) => set("address", e.target.value || undefined)} /></Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip active={form.tags.includes("vip")} onClick={() => toggleTag("vip")}><Star strokeWidth={1.75} />VIP</Chip>
            <Chip active={form.tags.includes("repeat")} onClick={() => toggleTag("repeat")}>Repeat client</Chip>
          </div>
        </section>
      </div>
    </Sheet>
  );
}

function Clients() {
  const router = useRouter();
  const openId = useSearchParams().get("id");
  const rows = useClientRows();
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const q = query.trim().toLowerCase();
  const shown = rows
    .filter((r) => !q || r.c.name.toLowerCase().includes(q) || r.c.phone.replace(/\s/g, "").includes(q.replace(/\s/g, "")))
    .filter((r) => (filter === "all" ? true : filter === "vip" || filter === "repeat" ? r.c.tags.includes(filter) : filter === "due" ? r.due > 0 : r.c.type === filter));
  const current = rows.find((r) => r.c.id === openId);
  const open = (id: string | null) => router.replace(id ? `/clients?id=${id}` : "/clients", { scroll: false });
  const filters: [Filter, string, number][] = [
    ["all", "All", rows.length],
    ["vip", "VIP", rows.filter((r) => r.c.tags.includes("vip")).length],
    ["repeat", "Repeat", rows.filter((r) => r.c.tags.includes("repeat")).length],
    ["corporate", "Corporate", rows.filter((r) => r.c.type === "corporate").length],
    ["agency", "Partner agency", rows.filter((r) => r.c.type === "agency").length],
    ["due", "Balance due", rows.filter((r) => r.due > 0).length],
  ];

  return (
    <>
      <PageHeader title="Clients" subtitle={`${rows.length} clients · ${money(rows.reduce((s, r) => s + r.due, 0))} still to collect`} />
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-text-muted" strokeWidth={1.75} />
        <span className="sr-only">Search clients</span>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or mobile number" className="!h-11 bg-surface pl-10" />
      </label>
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
        {filters.map(([id, label, n]) => <Chip key={id} active={filter === id} onClick={() => setFilter(id)}>{label}<span className="tnum text-xs">{n}</span></Chip>)}
      </div>

      {shown.length === 0 ? (
        <div className="mt-4"><EmptyState icon={Contact} title="No clients match" help="Clients are added for you when you save an enquiry, a quotation or a booking." /></div>
      ) : (
        <>
          <Card className="mt-4 hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left text-xs text-text-muted"><tr><th className="px-4 py-3 font-medium">Client</th><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 text-right font-medium">Orders</th><th className="px-4 py-3 text-right font-medium">Billed</th><th className="px-4 py-3 text-right font-medium">Due</th><th className="px-4 py-3 font-medium">Last event</th></tr></thead>
              <tbody className="tnum divide-y">
                {shown.map((r) => (
                  <tr key={r.c.id} tabIndex={0} onClick={() => open(r.c.id)} onKeyDown={(e) => e.key === "Enter" && open(r.c.id)} className="cursor-pointer hover:bg-surface-muted/60">
                    <td className="px-4 py-3"><span className="flex items-center gap-3"><Avatar name={r.c.name} /><span className="min-w-0"><span className="flex items-center gap-1.5 font-medium">{r.c.name}<Tags c={r.c} /></span><span className="block text-xs text-text-muted">{r.c.phone}</span></span></span></td>
                    <td className="px-4 py-3 text-text-muted">{typeLabel[r.c.type]}</td>
                    <td className="px-4 py-3 text-right">{r.orders.length || "–"}</td>
                    <td className="px-4 py-3 text-right">{r.billed ? money(r.billed) : "–"}</td>
                    <td className={cn("px-4 py-3 text-right font-medium", r.due > 0 && "text-warning")}>{r.due ? money(r.due) : "–"}</td>
                    <td className="px-4 py-3 text-text-muted">{r.lastDate ? fmtDate(r.lastDate, { day: "numeric", month: "short", year: "numeric" }) : r.enquiries.length ? "Enquiry only" : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <ul className="mt-4 space-y-3 md:hidden">
            {shown.map((r) => (
              <li key={r.c.id}>
                <button type="button" onClick={() => open(r.c.id)} className="flex w-full items-center gap-3 rounded-xl border bg-surface p-4 text-left shadow-card">
                  <Avatar name={r.c.name} />
                  <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-1.5 font-medium">{r.c.name}<Tags c={r.c} /></span><span className="tnum block text-xs text-text-muted">{typeLabel[r.c.type]} · {r.orders.length} orders</span></span>
                  <span className={cn("tnum shrink-0 text-sm font-semibold", r.due > 0 && "text-warning")}>{r.due ? `${money(r.due)} due` : r.billed ? "Paid" : ""}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {current && <ClientSheet key={current.c.id} row={current} onClose={() => open(null)} />}
    </>
  );
}

export default function ClientsPage() {
  return (
    <React.Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <Clients />
    </React.Suspense>
  );
}
