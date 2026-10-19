"use client";

import { ArrowDownLeft, ArrowUpRight, Download, HandCoins, Plus, Receipt, Trash2, Wallet } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { ExpenseSheet, ExpensesGate } from "@/components/expenses/expense-sheet";
import { modeLabel } from "@/components/sales/payment-sheet";
import { Badge } from "@/components/shared/badges";
import { EmptyState, MoneyInput, PageHeader, StatCard } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Card, Chip, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/sheet";
import { useBilling } from "@/lib/billing";
import { mediaUrl } from "@/lib/db";
import { categoryLabel, expenseCategories, pettyBalance, useExpenses, type ExpenseCategory } from "@/lib/expenses";
import { useStaff } from "@/lib/staff";
import { useStore } from "@/lib/store";
import { useSupply } from "@/lib/supply-store";
import type { PaymentMode } from "@/lib/types";
import { cn, fmtDate, isoDate, money, moneyShort } from "@/lib/utils";

function ExpenseList() {
  const { expenses, removeExpense } = useExpenses();
  const { orders, clients, users } = useStore();
  const [cat, setCat] = React.useState<ExpenseCategory | "all">("all");
  const [month, setMonth] = React.useState(isoDate(new Date()).slice(0, 7));
  const shown = expenses.filter((e) => (cat === "all" || e.category === cat) && (!month || e.date.startsWith(month)));
  const label = (orderId?: string) => {
    const o = orders.find((x) => x.id === orderId);
    return o ? `${clients.find((c) => c.id === o.clientId)?.name} · ${o.eventType}` : "Business";
  };
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 p-4 md:p-5">
        <Input type="month" aria-label="Month" className="w-auto" value={month} onChange={(e) => setMonth(e.target.value)} />
        <Chip active={cat === "all"} onClick={() => setCat("all")}>All</Chip>
        {expenseCategories.map((c) => <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.label}</Chip>)}
        <p className="tnum ml-auto text-sm"><span className="text-text-muted">Total </span><span className="font-semibold">{money(shown.reduce((s, e) => s + e.amount, 0))}</span></p>
      </div>
      {shown.length === 0 ? (
        <p className="border-t px-5 py-8 text-center text-sm text-text-muted">No expenses for this filter.</p>
      ) : (
        <ul className="tnum divide-y border-t">
          {shown.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-4 py-3 text-sm md:px-5">
              {e.photoPath ? <a href={mediaUrl(e.photoPath)} target="_blank" rel="noreferrer" className="shrink-0"><img src={mediaUrl(e.photoPath)} alt="Bill" className="size-11 rounded-lg object-cover" /></a> : <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-surface-muted text-text-muted"><Receipt className="size-5" strokeWidth={1.75} /></span>}
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-medium">{categoryLabel(e.category)}{e.paidTo && <span className="font-normal text-text-muted">to {e.paidTo}</span>}</span>
                <span className="block truncate text-xs text-text-muted">{e.number} · {fmtDate(e.date)} · {label(e.orderId)} · {e.pettyHolder ? `petty cash of ${users.find((u) => u.id === e.pettyHolder)?.name ?? "team member"}` : modeLabel(e.mode)}{e.note && ` · ${e.note}`}</span>
              </span>
              <span className="font-semibold">{money(e.amount)}</span>
              <Button variant="ghost" size="icon" aria-label={`Remove ${e.number}`} onClick={() => { removeExpense(e.id); toast(`${e.number} removed`); }}><Trash2 strokeWidth={1.75} /></Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function PettyCash() {
  const { petty, expenses, addPetty } = useExpenses();
  const users = useStore((s) => s.users).filter((u) => !u.invited);
  const [entry, setEntry] = React.useState<{ holder: string; kind: "issue" | "return" } | null>(null);
  const [amount, setAmount] = React.useState(0);
  const [note, setNote] = React.useState("");
  const close = () => { setEntry(null); setAmount(0); setNote(""); };
  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {users.map((u) => {
          const b = pettyBalance(u.id, petty, expenses);
          const history = [...petty.filter((p) => p.holder === u.id).map((p) => ({ date: p.date, label: p.kind === "issue" ? "Cash given" : "Cash returned", amount: p.kind === "issue" ? p.amount : -p.amount })), ...expenses.filter((e) => e.pettyHolder === u.id).map((e) => ({ date: e.date, label: categoryLabel(e.category), amount: -e.amount }))].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
          return (
            <Card key={u.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-medium">{u.name}</p><p className="text-xs capitalize text-text-muted">{u.role}</p></div>
                <div className="tnum text-right"><p className={cn("font-heading text-2xl font-bold", b.balance < 0 && "text-danger")}>{money(b.balance)}</p><p className="text-xs text-text-muted">in hand</p></div>
              </div>
              <p className="tnum mt-2 text-xs text-text-muted">Given {money(b.given)} · spent {money(b.spent)} · returned {money(b.returned)}</p>
              {history.length > 0 && <ul className="tnum mt-3 space-y-1 border-t pt-2 text-xs">{history.map((h, i) => <li key={i} className="flex justify-between gap-2"><span className="text-text-muted">{fmtDate(h.date, { day: "numeric", month: "short" })} · {h.label}</span><span className={h.amount < 0 ? "" : "text-success"}>{h.amount < 0 ? `-${money(-h.amount)}` : `+${money(h.amount)}`}</span></li>)}</ul>}
              <div className="mt-3 flex gap-2">
                <Button className="flex-1" onClick={() => setEntry({ holder: u.id, kind: "issue" })}><ArrowUpRight strokeWidth={1.75} />Give cash</Button>
                <Button variant="ghost" className="flex-1" disabled={b.balance <= 0} onClick={() => setEntry({ holder: u.id, kind: "return" })}><ArrowDownLeft strokeWidth={1.75} />Take back</Button>
              </div>
            </Card>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-text-muted">Expenses paid &quot;from petty cash&quot; come off the holder&apos;s balance. Invited team members appear once they join.</p>
      <Modal
        open={!!entry}
        onOpenChange={(o) => !o && close()}
        title={entry?.kind === "issue" ? `Give cash to ${users.find((u) => u.id === entry.holder)?.name}` : `Cash returned by ${users.find((u) => u.id === entry?.holder)?.name}`}
        footer={<><Button variant="ghost" onClick={close}>Cancel</Button><Button variant="primary" disabled={amount <= 0} onClick={() => { addPetty({ holder: entry!.holder, kind: entry!.kind, amount, note: note.trim() }); toast.success("Petty cash updated"); close(); }}>Save</Button></>}
      >
        <div className="space-y-3">
          <Field label="Amount"><MoneyInput autoFocus value={amount} onChange={setAmount} /></Field>
          <Field label="Note"><Input value={note} placeholder="For the Shah wedding" onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
      </Modal>
    </>
  );
}

interface DayRow { date: string; kind: string; party: string; ref: string; mode: PaymentMode | "petty"; inflow: number; outflow: number }

/** Every rupee in and out of the business, from payments, refunds, vendor and worker payments, expenses and petty cash. */
function useDayBook(from: string, to: string) {
  const { orders, clients, users } = useStore();
  const credits = useBilling((s) => s.credits);
  const { vendorPayments, vendors } = useSupply();
  const { payments: workerPayments, workers } = useStaff();
  const { expenses, petty } = useExpenses();
  return React.useMemo(() => {
    const rows: DayRow[] = [];
    const client = (orderId: string) => clients.find((c) => c.id === orders.find((o) => o.id === orderId)?.clientId)?.name ?? "";
    for (const o of orders) for (const p of o.payments) rows.push({ date: p.date, kind: "Client payment", party: client(o.id), ref: p.receiptNo, mode: p.mode, inflow: p.amount, outflow: 0 });
    for (const c of credits) if (c.refundAmount) rows.push({ date: c.issuedOn, kind: "Refund", party: client(c.orderId), ref: c.number, mode: c.refundMode ?? "bank", inflow: 0, outflow: c.refundAmount });
    for (const p of vendorPayments) rows.push({ date: p.date, kind: "Vendor payment", party: vendors.find((v) => v.id === p.vendorId)?.name ?? "", ref: p.note, mode: p.mode, inflow: 0, outflow: p.amount });
    for (const p of workerPayments) rows.push({ date: p.date, kind: p.kind === "salary" ? "Salary" : p.kind === "advance" ? "Worker advance" : "Worker payout", party: workers.find((w) => w.id === p.workerId)?.name ?? vendors.find((v) => v.id === p.contractorId)?.name ?? "", ref: p.note, mode: p.mode, inflow: 0, outflow: p.amount });
    // Petty cash leaves the business when it is handed over; what the holder later spends is shown but not counted twice.
    for (const e of expenses) rows.push({ date: e.date, kind: `Expense: ${categoryLabel(e.category)}`, party: e.paidTo, ref: e.number, mode: e.pettyHolder ? "petty" : e.mode, inflow: 0, outflow: e.pettyHolder ? 0 : e.amount });
    for (const p of petty) rows.push({ date: p.date, kind: p.kind === "issue" ? "Petty cash given" : "Petty cash returned", party: users.find((u) => u.id === p.holder)?.name ?? "", ref: p.note, mode: "cash", inflow: p.kind === "return" ? p.amount : 0, outflow: p.kind === "issue" ? p.amount : 0 });
    return rows.filter((r) => r.date >= from && r.date <= to).sort((a, b) => a.date.localeCompare(b.date) || b.inflow - a.inflow);
  }, [orders, clients, users, credits, vendorPayments, vendors, workerPayments, workers, expenses, petty, from, to]);
}

function DayBook() {
  const today = isoDate(new Date());
  const [from, setFrom] = React.useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = React.useState(today);
  const rows = useDayBook(from, to);
  const cashIn = rows.filter((r) => r.mode === "cash").reduce((s, r) => s + r.inflow, 0);
  const cashOut = rows.filter((r) => r.mode === "cash").reduce((s, r) => s + r.outflow, 0);
  const bankIn = rows.filter((r) => r.mode !== "cash" && r.mode !== "petty").reduce((s, r) => s + r.inflow, 0);
  const bankOut = rows.filter((r) => r.mode !== "cash" && r.mode !== "petty").reduce((s, r) => s + r.outflow, 0);
  const exportCsv = () => {
    const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [["Date", "Voucher type", "Party", "Reference", "Mode", "Receipt", "Payment"], ...rows.map((r) => [r.date, r.kind, r.party, r.ref, r.mode === "petty" ? "Petty cash" : modeLabel(r.mode), r.inflow || "", r.outflow || ""])];
    const blob = new Blob(["﻿" + lines.map((l) => l.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `day-book-${from}-to-${to}.csv` });
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="From"><Input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} /></Field>
        <Field label="To"><Input type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} /></Field>
        <Button className="ml-auto" disabled={!rows.length} onClick={exportCsv}><Download strokeWidth={1.75} />Export for Excel or Tally</Button>
      </div>
      <dl className="tnum grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Cash in", cashIn], ["Cash out", cashOut], ["Bank and UPI in", bankIn], ["Bank and UPI out", bankOut]].map(([k, v]) => <div key={k} className="rounded-xl border bg-surface p-4"><dt className="text-xs text-text-muted">{k}</dt><dd className="font-heading text-xl font-bold">{money(Number(v))}</dd></div>)}
      </dl>
      <p className="tnum text-sm"><span className="text-text-muted">Net for the period: </span><span className={cn("font-semibold", cashIn + bankIn - cashOut - bankOut < 0 ? "text-danger" : "text-success")}>{money(cashIn + bankIn - cashOut - bankOut)}</span><span className="text-text-muted"> (cash {money(cashIn - cashOut)}, bank {money(bankIn - bankOut)})</span></p>
      <Card>
        {rows.length === 0 ? <p className="px-5 py-8 text-center text-sm text-text-muted">Nothing in or out in these dates.</p> : (
          <div className="overflow-x-auto">
            <table className="tnum w-full min-w-[720px] text-left text-sm">
              <thead className="border-b bg-surface-muted/50 text-xs text-text-muted"><tr><th className="px-4 py-2 font-medium md:px-5">Date</th><th className="py-2 font-medium">Entry</th><th className="py-2 font-medium">Mode</th><th className="py-2 text-right font-medium">In</th><th className="px-4 py-2 text-right font-medium md:px-5">Out</th></tr></thead>
              <tbody className="divide-y">
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap px-4 py-2 md:px-5">{fmtDate(r.date, { day: "numeric", month: "short" })}</td>
                    <td className="py-2 pr-3"><span className="block">{r.kind}{r.party && <span className="text-text-muted"> · {r.party}</span>}</span>{r.ref && <span className="block text-xs text-text-muted">{r.ref}</span>}</td>
                    <td className="py-2">{r.mode === "petty" ? <Badge>From petty cash</Badge> : modeLabel(r.mode)}</td>
                    <td className="py-2 text-right text-success">{r.inflow ? money(r.inflow) : ""}</td>
                    <td className="px-4 py-2 text-right md:px-5">{r.outflow ? money(r.outflow) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="text-xs text-text-muted">The export is a CSV that opens in Excel; import it into Tally through your usual Excel-to-Tally utility. A direct Tally XML file is planned with the reports in phase 6.</p>
    </div>
  );
}

export default function ExpensesPage() {
  const [add, setAdd] = React.useState(false);
  const { expenses, petty } = useExpenses();
  const ready = useExpenses((s) => s.ready);
  const month = isoDate(new Date()).slice(0, 7);
  const thisMonth = expenses.filter((e) => e.date.startsWith(month));
  const events = thisMonth.filter((e) => e.orderId).reduce((s, e) => s + e.amount, 0);
  const users = useStore((s) => s.users);
  const inHand = users.reduce((s, u) => s + Math.max(0, pettyBalance(u.id, petty, expenses).balance), 0);
  return (
    <>
      <PageHeader title="Expenses and day book" subtitle="Small spends with their bills, petty cash with each manager, and every rupee in and out." action={ready && <Button variant="primary" onClick={() => setAdd(true)}><Plus strokeWidth={1.75} />Add expense</Button>} />
      <ExpensesGate>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Spent this month" value={moneyShort(thisMonth.reduce((s, e) => s + e.amount, 0))} sub={`${thisMonth.length} expenses`} icon={Receipt} tone="warning" />
          <StatCard label="On events" value={moneyShort(events)} sub="Counted in each event's cost" icon={Wallet} />
          <StatCard label="Business overheads" value={moneyShort(thisMonth.reduce((s, e) => s + e.amount, 0) - events)} sub="Rent, utilities and the rest" icon={Receipt} />
          <StatCard label="Petty cash out" value={moneyShort(inHand)} sub="Held by the team" icon={HandCoins} tone="info" />
        </div>
        <Tabs defaultValue="expenses" className="mt-6">
          <TabsList>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="petty">Petty cash</TabsTrigger>
            <TabsTrigger value="daybook">Day book</TabsTrigger>
          </TabsList>
          <TabsContent value="expenses">{expenses.length ? <ExpenseList /> : <EmptyState icon={Receipt} title="No expenses yet" help="Record gas, ice, tips and other small spends with a photo of the bill. Link them to an event to see its true cost." action={<Button variant="primary" onClick={() => setAdd(true)}><Plus strokeWidth={1.75} />Add expense</Button>} />}</TabsContent>
          <TabsContent value="petty"><PettyCash /></TabsContent>
          <TabsContent value="daybook"><DayBook /></TabsContent>
        </Tabs>
      </ExpensesGate>
      <ExpenseSheet open={add} onOpenChange={setAdd} />
    </>
  );
}
