"use client";

import { BellRing, DatabaseZap, FileText, Pencil, Plus, Printer, ReceiptText, Trash2, Undo2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { paymentModes } from "@/components/sales/payment-sheet";
import { Badge } from "@/components/shared/badges";
import { EmptyState, MoneyInput, useOrderMoney } from "@/components/shared/blocks";
import { Num } from "@/components/supply/common";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Card, CardTitle } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { scheduleRows, useBilling, type CreditNote, type Invoice, type Milestone, type MilestoneState, type ScheduleRow } from "@/lib/billing";
import { priceQuote } from "@/lib/pricing";
import { useStore } from "@/lib/store";
import type { Order, PaymentMode } from "@/lib/types";
import { printLight } from "@/lib/ui";
import { cn, fmtDate, money, relativeDay, uid, whatsappLink, localDay } from "@/lib/utils";
import { CreditNoteDocument, InvoiceDocument } from "./documents";
import { logWhatsApp } from "@/lib/messages";

export function BillingGate({ children }: { children: React.ReactNode }) {
  const ready = useBilling((s) => s.ready);
  if (!ready) return <EmptyState icon={DatabaseZap} title="One database step is pending" help="Run supabase/migrations/0007_billing.sql in the Supabase SQL editor, then reload this page. It adds payment schedules, invoices and credit notes." />;
  return <>{children}</>;
}

const stateBadge: Record<MilestoneState, { tone: "success" | "warning" | "danger" | "info" | "neutral"; label: string }> = {
  paid: { tone: "success", label: "Paid" },
  part: { tone: "warning", label: "Part paid" },
  due: { tone: "warning", label: "Due soon" },
  overdue: { tone: "danger", label: "Overdue" },
  upcoming: { tone: "neutral", label: "Upcoming" },
};
export const MilestoneBadge = ({ row }: { row: ScheduleRow }) => <Badge tone={stateBadge[row.state].tone}>{row.state === "overdue" ? `${row.daysLate} ${row.daysLate === 1 ? "day" : "days"} late` : stateBadge[row.state].label}</Badge>;

/** The schedule for one order, lined up against what has been received. */
export function useSchedule(order: Order) {
  const { bill, paid } = useOrderMoney(order);
  const saved = useBilling((s) => s.milestones);
  const scheduleFor = useBilling((s) => s.scheduleFor);
  // The default schedule makes new ids each call; keep one copy per order so rows stay stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- saved is what scheduleFor reads
  const milestones = React.useMemo(() => scheduleFor(order), [order, saved, scheduleFor]);
  return React.useMemo(() => scheduleRows(milestones, bill, paid), [milestones, bill, paid]);
}

export function reminderText(tenantName: string, upiId: string, clientName: string, order: Order, row: ScheduleRow) {
  const left = row.amount - row.covered;
  const when = row.state === "overdue" ? `was due on ${fmtDate(row.dueDate)}` : `is due on ${fmtDate(row.dueDate)}`;
  return `Dear ${clientName}, a gentle reminder that ${money(left)} (${row.label}) for your ${order.eventType} booking ${order.number} ${when}.${upiId ? ` You can pay by UPI to ${upiId}.` : ""} Thank you, ${tenantName}`;
}

export function RemindButton({ order, row, compact }: { order: Order; row: ScheduleRow; compact?: boolean }) {
  const tenant = useStore((s) => s.tenant);
  const client = useStore((s) => s.clients.find((c) => c.id === order.clientId));
  const markReminded = useBilling((s) => s.markReminded);
  return (
    <Button variant={compact ? "ghost" : "secondary"} asChild>
      <a href={whatsappLink(client?.phone ?? "", reminderText(tenant.name, tenant.upiId, client?.name ?? "", order, row))} target="_blank" rel="noreferrer" onClick={() => { markReminded(order, row.id); logWhatsApp("reminder", client?.name ?? "", client?.phone ?? "", reminderText(tenant.name, tenant.upiId, client?.name ?? "", order, row), order.id)(); }}>
        <BellRing strokeWidth={1.75} />{row.remindedAt ? "Remind again" : "Remind"}
      </a>
    </Button>
  );
}

function ScheduleEditor({ order, rows, onDone }: { order: Order; rows: ScheduleRow[]; onDone: () => void }) {
  const saveSchedule = useBilling((s) => s.saveSchedule);
  const { bill } = useOrderMoney(order);
  const [list, setList] = React.useState<Milestone[]>(() => rows.map(({ id, orderId, label, kind, value, dueDate, remindedAt }) => ({ id, orderId, label, kind, value, dueDate, remindedAt })));
  const set = (i: number, patch: Partial<Milestone>) => setList(list.map((m, k) => (k === i ? { ...m, ...patch } : m)));
  const planned = list.slice(0, -1).reduce((s, m) => s + (m.kind === "percent" ? (bill * m.value) / 100 : m.value), 0);
  const save = () => {
    saveSchedule(order.id, [...list].sort((a, b) => a.dueDate.localeCompare(b.dueDate)));
    toast.success("Payment schedule saved");
    onDone();
  };
  return (
    <div className="space-y-3 p-4 md:p-5">
      {list.map((m, i) => (
        <div key={m.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border p-3">
          <Input aria-label="Milestone name" value={m.label} onChange={(e) => set(i, { label: e.target.value })} />
          <Button variant="ghost" size="icon-lg" aria-label={`Remove ${m.label}`} disabled={list.length === 1} onClick={() => setList(list.filter((_, k) => k !== i))}><Trash2 strokeWidth={1.75} /></Button>
          <div className="col-span-2 flex flex-wrap gap-2">
            <Select aria-label="Percentage or amount" className="w-24" value={m.kind} onChange={(e) => set(i, { kind: e.target.value as Milestone["kind"] })}><option value="percent">%</option><option value="amount">₹</option></Select>
            {m.kind === "percent" ? <Num aria-label="Percentage of the total" className="w-24" value={m.value} onChange={(value) => set(i, { value: Math.min(100, value) })} /> : <MoneyInput className="w-36" value={m.value} onChange={(value) => set(i, { value })} />}
            <Input type="date" aria-label="Due date" className="w-auto" value={m.dueDate} onChange={(e) => e.target.value && set(i, { dueDate: e.target.value })} />
          </div>
        </div>
      ))}
      <p className={cn("tnum text-xs", planned > bill ? "text-danger" : "text-text-muted")}>{planned > bill ? `The milestones before the last add up to ${money(planned)}, more than the bill of ${money(bill)}.` : `The last milestone takes whatever is left of the ${money(bill)} bill.`}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => setList([...list, { id: uid(), orderId: order.id, label: "Instalment", kind: "percent", value: 0, dueDate: list[list.length - 1]?.dueDate ?? order.functions[0].date }])}><Plus strokeWidth={1.75} />Add milestone</Button>
        <span className="flex-1" />
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
        <Button variant="primary" disabled={planned > bill || list.some((m) => !m.label.trim())} onClick={save}>Save schedule</Button>
      </div>
    </div>
  );
}

export function ScheduleCard({ order, locked }: { order: Order; locked: boolean }) {
  const rows = useSchedule(order);
  const [editing, setEditing] = React.useState(false);
  return (
    <Card>
      <CardTitle action={!locked && !editing && <Button variant="ghost" onClick={() => setEditing(true)}><Pencil strokeWidth={1.75} />Edit</Button>}>Payment schedule</CardTitle>
      {editing ? (
        <ScheduleEditor order={order} rows={rows} onDone={() => setEditing(false)} />
      ) : (
        <ul className="tnum divide-y">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-3 md:px-5">
              <div className="flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0"><span className="block font-medium">{r.label}{r.kind === "percent" ? ` (${r.value}%)` : ""}</span><span className="block text-xs text-text-muted">Due {fmtDate(r.dueDate, { day: "numeric", month: "short" })}{r.remindedAt && ` · reminded ${relativeDay(localDay(r.remindedAt)).toLowerCase()}`}</span></span>
                <span className="shrink-0 text-right"><span className="block font-medium">{money(r.amount)}</span><MilestoneBadge row={r} /></span>
              </div>
              {!locked && r.remind && <div className="mt-2"><RemindButton order={order} row={r} compact /></div>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function CreditSheet({ order, onClose }: { order: Order; onClose: () => void }) {
  const addCredit = useBilling((s) => s.addCredit);
  const { bill, paid } = useOrderMoney(order);
  const cancelled = order.status === "cancelled";
  const [reason, setReason] = React.useState(cancelled ? `Cancellation${order.cancelNote ? `: ${order.cancelNote}` : ""}` : "");
  const [amount, setAmount] = React.useState(cancelled ? paid : 0);
  const [refund, setRefund] = React.useState(cancelled ? paid : 0);
  const [mode, setMode] = React.useState<PaymentMode>("bank");
  const [busy, setBusy] = React.useState(false);
  // On a cancelled order the bill already equals what was kept, so a credit can only hand that back.
  const maxCredit = cancelled ? paid : bill;
  const save = async () => {
    setBusy(true);
    try {
      const note = await addCredit({ orderId: order.id, reason: reason.trim(), amount, refundAmount: refund, refundMode: refund ? mode : undefined });
      toast.success(`${note.number} issued`, { description: refund ? `${money(refund)} refund recorded` : "The bill is reduced by this amount." });
      onClose();
    } catch (e) {
      toast.error("The credit note was not saved", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title="Credit note or refund" description="For a cancellation, fewer guests or a goodwill adjustment. It gets its own number and prints for the client." footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} disabled={!reason.trim() || amount <= 0 || amount > maxCredit || refund > Math.min(amount, paid)} onClick={save}>Issue credit note</Button></>}>
      <div className="space-y-4">
        <Field label="Reason"><Input autoFocus value={reason} placeholder="Reception reduced from 800 to 650 guests" onChange={(e) => setReason(e.target.value)} /></Field>
        <Field label="Amount to credit" error={amount > maxCredit ? `More than the ${money(maxCredit)} ${cancelled ? "received" : "billed"}` : ""} hint={cancelled ? "This order is cancelled; credit what is being given back." : `Order bill is ${money(bill)}.`}><MoneyInput value={amount} onChange={setAmount} /></Field>
        <Field label="Of which refunded now" error={refund > Math.min(amount, paid) ? "A refund cannot be more than the credit or what was received" : ""} hint={`Received so far: ${money(paid)}. Leave at 0 to adjust against the bill instead.`}><MoneyInput value={refund} onChange={setRefund} /></Field>
        {refund > 0 && (
          <div>
            <span className="mb-1 block text-xs font-medium text-text-muted">Refunded by</span>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{paymentModes.map((m) => <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => setMode(m.id)} className={cn("flex h-14 flex-col items-center justify-center gap-1 rounded-xl border text-xs font-medium", mode === m.id ? "border-primary bg-primary-soft text-primary" : "bg-surface text-text-muted hover:text-text")}><m.icon className="size-5" strokeWidth={1.75} />{m.label}</button>)}</div>
          </div>
        )}
      </div>
    </Sheet>
  );
}

type Doc = { kind: "invoice"; invoice: Invoice } | { kind: "credit"; note: CreditNote };

export function DocumentSheet({ doc, order, onClose }: { doc: Doc | null; order: Order; onClose: () => void }) {
  return (
    <Sheet open={!!doc} onOpenChange={(o) => !o && onClose()} title={doc?.kind === "credit" ? doc.note.number : doc ? doc.invoice.number : ""} wide footer={<Button onClick={printLight}><Printer strokeWidth={1.75} />Print or PDF</Button>}>
      {doc?.kind === "invoice" && <InvoiceDocument invoice={doc.invoice} order={order} />}
      {doc?.kind === "credit" && <CreditNoteDocument note={doc.note} order={order} />}
    </Sheet>
  );
}

/** Invoices and credit notes for one order, and the buttons that raise them. */
export function BillingCard({ order }: { order: Order }) {
  const invoices = useBilling((s) => s.invoices).filter((i) => i.orderId === order.id);
  const credits = useBilling((s) => s.credits).filter((c) => c.orderId === order.id);
  const issueInvoice = useBilling((s) => s.issueInvoice);
  const { totals, paid } = useOrderMoney(order);
  const [doc, setDoc] = React.useState<Doc | null>(null);
  const [credit, setCredit] = React.useState(false);
  const [busy, setBusy] = React.useState<Invoice["kind"] | null>(null);
  const taxInvoice = [...invoices].reverse().find((i) => i.kind === "tax");
  // Once the tax invoice is out, the order total can still move (extra plates, breakage); show the gap.
  const drift = taxInvoice ? totals.grand - taxInvoice.total : 0;
  const issue = async (kind: Invoice["kind"]) => {
    setBusy(kind);
    try {
      const invoice = await issueInvoice(order, kind, paid);
      toast.success(`${invoice.number} issued`);
      setDoc({ kind: "invoice", invoice });
    } catch (e) {
      toast.error("The invoice was not issued", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  };
  const docs = [...invoices.map((invoice) => ({ date: invoice.issuedOn, doc: { kind: "invoice", invoice } as Doc })), ...credits.map((note) => ({ date: note.issuedOn, doc: { kind: "credit", note } as Doc }))].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Card>
      <CardTitle>Invoices and credit notes</CardTitle>
      <div className="flex flex-wrap gap-2 px-4 pb-3 md:px-5">
        {order.status !== "cancelled" && <Button loading={busy === "proforma"} onClick={() => issue("proforma")}><FileText strokeWidth={1.75} />Proforma</Button>}
        {order.status !== "cancelled" && (taxInvoice ? <Button onClick={() => setDoc({ kind: "invoice", invoice: taxInvoice })}><ReceiptText strokeWidth={1.75} />Tax invoice</Button> : <Button variant="primary" loading={busy === "tax"} onClick={() => issue("tax")}><ReceiptText strokeWidth={1.75} />Issue tax invoice</Button>)}
        <Button variant="ghost" onClick={() => setCredit(true)}><Undo2 strokeWidth={1.75} />Credit note or refund</Button>
      </div>
      {drift > 0 && <p className="mx-4 mb-3 rounded-lg bg-warning/10 p-3 text-sm text-warning md:mx-5">The order total is {money(drift)} more than tax invoice {taxInvoice!.number}. Bill the difference with a supplementary invoice in phase 5B, or collect it against this order.</p>}
      {drift < 0 && <p className="mx-4 mb-3 rounded-lg bg-warning/10 p-3 text-sm text-warning md:mx-5">The order total is {money(-drift)} less than tax invoice {taxInvoice!.number}. Issue a credit note for the difference.</p>}
      {docs.length === 0 ? (
        <p className="border-t px-4 py-4 text-sm text-text-muted md:px-5">Nothing issued yet. A proforma asks for payment before the event; the tax invoice is the final bill, usually after it.</p>
      ) : (
        <ul className="tnum divide-y border-t">
          {docs.map(({ doc: d }) => {
            const key = d.kind === "invoice" ? d.invoice.id : d.note.id;
            return (
              <li key={key}>
                <button type="button" onClick={() => setDoc(d)} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-surface-muted/60 md:px-5">
                  {d.kind === "invoice" ? <ReceiptText className="size-5 shrink-0 text-text-muted" strokeWidth={1.75} /> : <Undo2 className="size-5 shrink-0 text-text-muted" strokeWidth={1.75} />}
                  <span className="min-w-0 flex-1"><span className="block font-medium">{d.kind === "invoice" ? (d.invoice.kind === "tax" ? "Tax invoice" : "Proforma invoice") : d.note.refundAmount ? "Credit note and refund" : "Credit note"}</span><span className="block text-xs text-text-muted">{d.kind === "invoice" ? `${d.invoice.number} · ${fmtDate(d.invoice.issuedOn)}` : `${d.note.number} · ${d.note.reason}`}</span></span>
                  <span className="shrink-0 font-medium">{d.kind === "invoice" ? money(d.invoice.total) : `-${money(d.note.amount)}`}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <DocumentSheet doc={doc} order={order} onClose={() => setDoc(null)} />
      {credit && <CreditSheet order={order} onClose={() => setCredit(false)} />}
    </Card>
  );
}

export interface LedgerEntry { date: string; label: string; ref: string; debit: number; credit: number; orderId: string }

/** Every charge and payment across some orders, oldest first: bills and refunds raise the balance, payments and credits lower it. */
export function useLedger(orders: Order[]) {
  const { items, packages, tenant } = useStore();
  const credits = useBilling((s) => s.credits);
  return React.useMemo(() => {
    const rows: LedgerEntry[] = [];
    for (const o of orders) {
      const grand = priceQuote(o, items, packages, tenant.slabs).grand;
      rows.push({ date: o.createdAt.slice(0, 10), label: `${o.eventType} booked`, ref: o.number, debit: grand, credit: 0, orderId: o.id });
      for (const p of o.payments) rows.push({ date: p.date, label: `Payment, ${paymentModes.find((m) => m.id === p.mode)?.label ?? p.mode}`, ref: p.receiptNo, debit: 0, credit: p.amount, orderId: o.id });
      const mine = credits.filter((c) => c.orderId === o.id);
      for (const c of mine) {
        rows.push({ date: c.issuedOn, label: `Credit note: ${c.reason}`, ref: c.number, debit: 0, credit: c.amount, orderId: o.id });
        if (c.refundAmount) rows.push({ date: c.issuedOn, label: "Refund paid", ref: c.number, debit: c.refundAmount, credit: 0, orderId: o.id });
      }
      if (o.status === "cancelled") {
        // Cancelling writes off whatever was billed beyond what was kept.
        const kept = o.payments.reduce((s, p) => s + p.amount, 0) - mine.reduce((s, c) => s + c.refundAmount, 0);
        const writeOff = grand - mine.reduce((s, c) => s + c.amount, 0) - kept;
        if (writeOff > 0) rows.push({ date: o.createdAt.slice(0, 10), label: "Order cancelled", ref: o.number, debit: 0, credit: writeOff, orderId: o.id });
      }
    }
    rows.sort((a, b) => a.date.localeCompare(b.date) || b.debit - a.debit);
    let balance = 0;
    return rows.map((r) => ({ ...r, balance: (balance += r.debit - r.credit) }));
  }, [orders, items, packages, tenant.slabs, credits]);
}

export function LedgerTable({ rows }: { rows: (LedgerEntry & { balance: number })[] }) {
  if (rows.length === 0) return <p className="px-5 py-6 text-center text-sm text-text-muted">No entries yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="tnum w-full min-w-[560px] text-left text-sm">
        <thead className="border-b text-xs text-text-muted"><tr><th className="px-4 py-2 font-medium md:px-5">Date</th><th className="py-2 font-medium">Entry</th><th className="py-2 text-right font-medium">Charged</th><th className="py-2 text-right font-medium">Received</th><th className="px-4 py-2 text-right font-medium md:px-5">Balance</th></tr></thead>
        <tbody className="divide-y">
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="whitespace-nowrap px-4 py-2 md:px-5">{fmtDate(r.date, { day: "numeric", month: "short", year: "2-digit" })}</td>
              <td className="py-2 pr-3"><span className="block">{r.label}</span><span className="block text-xs text-text-muted">{r.ref}</span></td>
              <td className="py-2 text-right">{r.debit ? money(r.debit) : ""}</td>
              <td className="py-2 text-right">{r.credit ? money(r.credit) : ""}</td>
              <td className={cn("px-4 py-2 text-right font-medium md:px-5", r.balance > 0 && "text-warning")}>{money(r.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
