"use client";

import { AlertCircle, BellRing, IndianRupee, Printer, ReceiptText, Search, Undo2, Wallet } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BillingGate, DocumentSheet, LedgerTable, MilestoneBadge, RemindButton, useLedger } from "@/components/billing/order-billing";
import { modeLabel } from "@/components/sales/payment-sheet";
import { Badge } from "@/components/shared/badges";
import { EmptyState, PageHeader, StatCard } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, Chip, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { ageBands, balanceOf, scheduleRows, useBilling, type CreditNote, type Invoice, type ScheduleRow } from "@/lib/billing";
import { priceQuote } from "@/lib/pricing";
import { useStore } from "@/lib/store";
import type { Client, Order } from "@/lib/types";
import { printLight, useUi } from "@/lib/ui";
import { cn, fmtDate, isoDate, money, moneyShort, parseDate } from "@/lib/utils";

interface OrderDue { order: Order; client?: Client; due: number; overdue: number; rows: ScheduleRow[] }

/** Every order's balance and schedule, worked out once for the whole page. */
function useBook() {
  const { orders, clients, items, packages, tenant } = useStore();
  const { credits, milestones, scheduleFor } = useBilling();
  return React.useMemo(() => {
    const book: OrderDue[] = orders.map((order) => {
      const grand = priceQuote(order, items, packages, tenant.slabs).grand;
      const { bill, received, due } = balanceOf(order, grand, credits);
      const rows = order.status === "cancelled" ? [] : scheduleRows(scheduleFor(order), bill, received);
      const overdue = rows.filter((r) => r.state === "overdue").reduce((s, r) => s + r.amount - r.covered, 0);
      return { order, client: clients.find((c) => c.id === order.clientId), due, overdue, rows };
    });
    return book;
    // milestones is read through scheduleFor
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, clients, items, packages, tenant.slabs, credits, milestones, scheduleFor]);
}

function ClientStatement({ client, onClose }: { client: Client | null; onClose: () => void }) {
  const orders = useStore((s) => s.orders);
  const tenant = useStore((s) => s.tenant);
  const mine = React.useMemo(() => orders.filter((o) => o.clientId === client?.id), [orders, client]);
  const rows = useLedger(mine);
  const balance = rows[rows.length - 1]?.balance ?? 0;
  return (
    <Sheet open={!!client} onOpenChange={(o) => !o && onClose()} title={`${client?.name ?? ""}: statement`} description="Every charge, payment, credit note and refund, with the running balance." wide footer={<Button onClick={printLight}><Printer strokeWidth={1.75} />Print or PDF</Button>}>
      <article className="overflow-hidden rounded-xl border bg-surface print:border-0" style={{ "--brand": tenant.brandColor } as React.CSSProperties}>
        <header className="flex items-center justify-between gap-3 bg-brand px-5 py-4 text-brand-fg">
          <div><p className="font-heading text-lg font-bold">{tenant.name}</p><p className="text-xs opacity-80">Statement of account</p></div>
          <p className="tnum text-right text-xs opacity-80">{client?.name}<br />{fmtDate(isoDate(new Date()))}</p>
        </header>
        <LedgerTable rows={rows} />
        <p className="tnum flex justify-between border-t px-5 py-3 font-medium"><span>{balance > 0 ? "Balance payable" : balance < 0 ? "In credit" : "Settled"}</span><span className={balance > 0 ? "text-warning" : ""}>{money(Math.abs(balance))}</span></p>
      </article>
    </Sheet>
  );
}

function Outstanding({ book, onClient }: { book: OrderDue[]; onClient: (c: Client) => void }) {
  const [q, setQ] = React.useState("");
  const byClient = React.useMemo(() => {
    const map = new Map<string, { client: Client; due: number; orders: number; bands: number[] }>();
    for (const b of book) {
      if (!b.client || b.due <= 0) continue;
      const row = map.get(b.client.id) ?? { client: b.client, due: 0, orders: 0, bands: ageBands.map(() => 0) };
      row.due += b.due;
      row.orders += 1;
      // Each unpaid milestone lands in the band for how late it is; anything not yet due is current.
      let placed = 0;
      for (const r of b.rows) {
        const left = r.amount - r.covered;
        if (left <= 0) continue;
        const i = ageBands.findIndex((band) => band.test(r.state === "overdue" ? r.daysLate : 0));
        row.bands[i] += left;
        placed += left;
      }
      row.bands[0] += Math.max(0, b.due - placed);
      map.set(b.client.id, row);
    }
    return [...map.values()].sort((a, b) => b.bands.slice(1).reduce((s, x) => s + x, 0) - a.bands.slice(1).reduce((s, x) => s + x, 0) || b.due - a.due);
  }, [book]);
  const shown = byClient.filter((r) => r.client.name.toLowerCase().includes(q.toLowerCase()));
  const totals = ageBands.map((_, i) => byClient.reduce((s, r) => s + r.bands[i], 0));
  if (byClient.length === 0) return <EmptyState icon={Wallet} title="Nothing outstanding" help="Every order is paid up to date. Balances appear here by client, sorted by how late they are." />;
  return (
    <Card>
      <div className="p-4 md:p-5"><div className="relative max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" strokeWidth={1.75} /><Input aria-label="Search clients" className="pl-9" placeholder="Search clients" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
      <div className="overflow-x-auto">
        <table className="tnum w-full min-w-[720px] text-left text-sm">
          <thead className="border-y bg-surface-muted/50 text-xs text-text-muted">
            <tr><th className="px-4 py-2 font-medium md:px-5">Client</th>{ageBands.map((b) => <th key={b.id} className="py-2 text-right font-medium">{b.label}</th>)}<th className="px-4 py-2 text-right font-medium md:px-5">Total due</th></tr>
          </thead>
          <tbody className="divide-y">
            {shown.map((r) => (
              <tr key={r.client.id} className="cursor-pointer hover:bg-surface-muted/60" onClick={() => onClient(r.client)}>
                <td className="px-4 py-3 md:px-5"><span className="block font-medium">{r.client.name}</span><span className="block text-xs text-text-muted">{r.orders} {r.orders === 1 ? "order" : "orders"} · {r.client.phone}</span></td>
                {r.bands.map((v, i) => <td key={i} className={cn("py-3 text-right", v > 0 && i > 0 && "font-medium text-danger", v === 0 && "text-text-muted")}>{v ? money(v) : "-"}</td>)}
                <td className="px-4 py-3 text-right font-semibold md:px-5">{money(r.due)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 font-medium">
            <tr><td className="px-4 py-3 md:px-5">All clients</td>{totals.map((v, i) => <td key={i} className="py-3 text-right">{money(v)}</td>)}<td className="px-4 py-3 text-right md:px-5">{money(totals.reduce((s, v) => s + v, 0))}</td></tr>
          </tfoot>
        </table>
      </div>
      <p className="border-t px-4 py-3 text-xs text-text-muted md:px-5">Tap a client for their full statement. Ageing counts from each milestone&apos;s due date in the order&apos;s payment schedule.</p>
    </Card>
  );
}

function Reminders({ book }: { book: OrderDue[] }) {
  const list = book.flatMap((b) => b.rows.filter((r) => r.remind).map((row) => ({ ...b, row }))).sort((a, b) => a.row.dueDate.localeCompare(b.row.dueDate));
  if (list.length === 0) return <EmptyState icon={BellRing} title="No reminders to send" help="Milestones due in the next three days and overdue ones show here, with a ready WhatsApp message for each." />;
  return (
    <Card>
      <ul className="tnum divide-y">
        {list.map(({ order, client, row }) => (
          <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3 md:px-5">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium"><Link href={`/orders/${order.id}?tab=payments`} className="hover:underline">{client?.name}</Link><MilestoneBadge row={row} /></p>
              <p className="text-sm text-text-muted">{row.label} · {order.eventType} · due {fmtDate(row.dueDate, { day: "numeric", month: "short" })}{row.remindedAt && ` · last reminded ${fmtDate(row.remindedAt.slice(0, 10), { day: "numeric", month: "short" })}`}</p>
            </div>
            <p className="font-heading text-lg font-bold">{money(row.amount - row.covered)}</p>
            <RemindButton order={order} row={row} />
          </li>
        ))}
      </ul>
      <p className="border-t px-4 py-3 text-xs text-text-muted md:px-5">Reminders open WhatsApp with the message ready to send. Fully automatic sending arrives with the WhatsApp API in phase 6.</p>
    </Card>
  );
}

function Received() {
  const orders = useStore((s) => s.orders);
  const clients = useStore((s) => s.clients);
  const credits = useBilling((s) => s.credits);
  const [range, setRange] = React.useState<"month" | "last" | "all">("month");
  const now = new Date();
  const month = isoDate(now).slice(0, 7);
  const last = isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7);
  const all = React.useMemo(() => orders.flatMap((o) => o.payments.map((p) => ({ p, o, client: clients.find((c) => c.id === o.clientId)?.name ?? "" }))).sort((a, b) => b.p.date.localeCompare(a.p.date)), [orders, clients]);
  const shown = all.filter(({ p }) => (range === "all" ? true : p.date.startsWith(range === "month" ? month : last)));
  const refunds = credits.filter((c) => c.refundAmount && (range === "all" || c.issuedOn.startsWith(range === "month" ? month : last)));
  const chart = Array.from({ length: 6 }, (_, i) => {
    const m = isoDate(new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)).slice(0, 7);
    return { label: parseDate(`${m}-01`).toLocaleDateString("en-IN", { month: "short" }), amount: all.filter(({ p }) => p.date.startsWith(m)).reduce((s, x) => s + x.p.amount, 0) };
  });
  const byMode = Object.entries(shown.reduce<Record<string, number>>((acc, { p }) => ({ ...acc, [p.mode]: (acc[p.mode] ?? 0) + p.amount }), {}));
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px] lg:items-start">
      <Card>
        <div className="flex flex-wrap items-center gap-2 p-4 md:p-5">
          <Chip active={range === "month"} onClick={() => setRange("month")}>This month</Chip>
          <Chip active={range === "last"} onClick={() => setRange("last")}>Last month</Chip>
          <Chip active={range === "all"} onClick={() => setRange("all")}>All</Chip>
          <p className="tnum ml-auto text-sm"><span className="text-text-muted">Received </span><span className="font-semibold">{money(shown.reduce((s, x) => s + x.p.amount, 0))}</span></p>
        </div>
        {shown.length === 0 ? <p className="border-t px-5 py-6 text-center text-sm text-text-muted">No payments in this period.</p> : (
          <ul className="tnum divide-y border-t">
            {shown.map(({ p, o, client }) => (
              <li key={p.id}><Link href={`/orders/${o.id}?tab=payments`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-surface-muted/60 md:px-5">
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{client} · {p.note || "Payment"}</span><span className="block truncate text-xs text-text-muted">{p.receiptNo} · {fmtDate(p.date)} · {modeLabel(p.mode)}</span></span>
                <span className="font-semibold">{money(p.amount)}</span>
              </Link></li>
            ))}
            {refunds.map((c) => <li key={c.id} className="flex items-center gap-3 px-4 py-3 text-sm md:px-5"><span className="min-w-0 flex-1"><span className="block truncate font-medium">Refund · {c.reason}</span><span className="block text-xs text-text-muted">{c.number} · {fmtDate(c.issuedOn)}</span></span><span className="font-semibold text-danger">-{money(c.refundAmount)}</span></li>)}
          </ul>
        )}
      </Card>
      <div className="space-y-4">
        <Card>
          <p className="px-4 pt-4 font-heading font-semibold md:px-5">Collections, last 6 months</p>
          <div className="h-52 px-2 pb-3 pt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                <YAxis width={52} tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} tickFormatter={(v: number) => moneyShort(v)} />
                <Tooltip cursor={{ fill: "var(--surface-muted)" }} formatter={(v) => [money(Number(v)), "Collected"]} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text)", fontSize: 12 }} />
                <Bar dataKey="amount" fill="var(--primary)" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        {byMode.length > 0 && (
          <Card className="p-4 md:p-5">
            <p className="font-heading font-semibold">By mode</p>
            <dl className="tnum mt-2 space-y-1.5 text-sm">{byMode.sort((a, b) => b[1] - a[1]).map(([m, v]) => <div key={m} className="flex justify-between"><dt className="text-text-muted">{modeLabel(m as Order["payments"][number]["mode"])}</dt><dd className="font-medium">{money(v)}</dd></div>)}</dl>
          </Card>
        )}
      </div>
    </div>
  );
}

type Doc = { kind: "invoice"; invoice: Invoice } | { kind: "credit"; note: CreditNote };

function Documents() {
  const { invoices, credits } = useBilling();
  const orders = useStore((s) => s.orders);
  const clients = useStore((s) => s.clients);
  const [open, setOpen] = React.useState<{ doc: Doc; order: Order } | null>(null);
  const list = [
    ...invoices.map((invoice) => ({ date: invoice.issuedOn, number: invoice.number, orderId: invoice.orderId, title: invoice.kind === "tax" ? "Tax invoice" : "Proforma", amount: invoice.total, doc: { kind: "invoice", invoice } as Doc })),
    ...credits.map((note) => ({ date: note.issuedOn, number: note.number, orderId: note.orderId, title: note.refundAmount ? "Credit note and refund" : "Credit note", amount: -note.amount, doc: { kind: "credit", note } as Doc })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
  if (list.length === 0) return <EmptyState icon={ReceiptText} title="No invoices yet" help="Proforma and tax invoices and credit notes are raised from each order's Payments tab, and listed here with their numbers." />;
  return (
    <Card>
      <ul className="tnum divide-y">
        {list.map((d) => {
          const order = orders.find((o) => o.id === d.orderId);
          return (
            <li key={d.number}>
              <button type="button" disabled={!order} onClick={() => order && setOpen({ doc: d.doc, order })} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-surface-muted/60 md:px-5">
                {d.amount < 0 ? <Undo2 className="size-5 shrink-0 text-text-muted" strokeWidth={1.75} /> : <ReceiptText className="size-5 shrink-0 text-text-muted" strokeWidth={1.75} />}
                <span className="min-w-0 flex-1"><span className="flex items-center gap-2 font-medium">{d.number}<Badge tone={d.title === "Tax invoice" ? "success" : d.amount < 0 ? "warning" : "neutral"}>{d.title}</Badge></span><span className="block truncate text-xs text-text-muted">{clients.find((c) => c.id === order?.clientId)?.name} · {order?.number} · {fmtDate(d.date)}</span></span>
                <span className={cn("font-semibold", d.amount < 0 && "text-danger")}>{d.amount < 0 ? `-${money(-d.amount)}` : money(d.amount)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {open && <DocumentSheet doc={open.doc} order={open.order} onClose={() => setOpen(null)} />}
    </Card>
  );
}

function Ledgers({ book, onClient }: { book: OrderDue[]; onClient: (c: Client) => void }) {
  const [q, setQ] = React.useState("");
  const rows = React.useMemo(() => {
    const map = new Map<string, { client: Client; due: number; orders: number }>();
    for (const b of book) {
      if (!b.client) continue;
      const r = map.get(b.client.id) ?? { client: b.client, due: 0, orders: 0 };
      r.due += b.due;
      r.orders += 1;
      map.set(b.client.id, r);
    }
    return [...map.values()].sort((a, b) => a.client.name.localeCompare(b.client.name));
  }, [book]);
  const shown = rows.filter((r) => r.client.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Card>
      <div className="p-4 md:p-5"><div className="relative max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" strokeWidth={1.75} /><Input aria-label="Search clients" className="pl-9" placeholder="Search clients" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
      <ul className="tnum divide-y border-t">
        {shown.map((r) => (
          <li key={r.client.id}><button type="button" onClick={() => onClient(r.client)} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-surface-muted/60 md:px-5">
            <span className="min-w-0 flex-1"><span className="block font-medium">{r.client.name}</span><span className="block text-xs text-text-muted">{r.orders} {r.orders === 1 ? "order" : "orders"}</span></span>
            {r.due > 0 ? <span className="font-semibold text-warning">{money(r.due)} due</span> : <Badge tone="success">Settled</Badge>}
          </button></li>
        ))}
      </ul>
    </Card>
  );
}

export default function PaymentsPage() {
  const openPayment = useUi((s) => s.openPayment);
  const orders = useStore((s) => s.orders);
  const book = useBook();
  const [client, setClient] = React.useState<Client | null>(null);
  const month = isoDate(new Date()).slice(0, 7);
  const outstanding = book.reduce((s, b) => s + b.due, 0);
  const overdue = book.reduce((s, b) => s + b.overdue, 0);
  const collected = orders.flatMap((o) => o.payments).filter((p) => p.date.startsWith(month)).reduce((s, p) => s + p.amount, 0);
  const reminders = book.reduce((s, b) => s + b.rows.filter((r) => r.remind).length, 0);
  return (
    <>
      <PageHeader title="Payments" subtitle="What clients owe and when, reminders, receipts, invoices and statements." action={<Button variant="primary" onClick={() => openPayment()}><Wallet strokeWidth={1.75} />Record payment</Button>} />
      <BillingGate>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Outstanding" value={moneyShort(outstanding)} sub={`${book.filter((b) => b.due > 0).length} orders with a balance`} icon={Wallet} tone="warning" />
          <StatCard label="Overdue" value={moneyShort(overdue)} sub={overdue ? "Past a milestone's due date" : "Nothing late"} icon={AlertCircle} tone={overdue ? "warning" : "success"} />
          <StatCard label="Collected this month" value={moneyShort(collected)} sub={fmtDate(`${month}-01`, { month: "long", year: "numeric" })} icon={IndianRupee} tone="success" />
          <StatCard label="Reminders to send" value={String(reminders)} sub="Due in 3 days or overdue" icon={BellRing} tone="info" />
        </div>
        <Tabs defaultValue="outstanding" className="mt-6">
          <TabsList>
            <TabsTrigger value="outstanding">Outstanding</TabsTrigger>
            <TabsTrigger value="reminders">Reminders{reminders > 0 && <Badge tone="warning">{reminders}</Badge>}</TabsTrigger>
            <TabsTrigger value="received">Received</TabsTrigger>
            <TabsTrigger value="documents">Invoices and credit notes</TabsTrigger>
            <TabsTrigger value="ledgers">Client ledgers</TabsTrigger>
          </TabsList>
          <TabsContent value="outstanding"><Outstanding book={book} onClient={setClient} /></TabsContent>
          <TabsContent value="reminders"><Reminders book={book} /></TabsContent>
          <TabsContent value="received"><Received /></TabsContent>
          <TabsContent value="documents"><Documents /></TabsContent>
          <TabsContent value="ledgers"><Ledgers book={book} onClient={setClient} /></TabsContent>
        </Tabs>
        <ClientStatement client={client} onClose={() => setClient(null)} />
      </BillingGate>
    </>
  );
}
