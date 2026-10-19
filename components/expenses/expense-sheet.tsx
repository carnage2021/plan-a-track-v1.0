"use client";

import { DatabaseZap, Receipt } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { PhotoButton } from "@/components/ops/common";
import { paymentModes } from "@/components/sales/payment-sheet";
import { EmptyState, MoneyInput } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Chip } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { mediaUrl } from "@/lib/db";
import { expenseCategories, pettyBalance, useExpenses, type Expense, type ExpenseCategory } from "@/lib/expenses";
import { useCurrentUser, useStore } from "@/lib/store";
import type { PaymentMode } from "@/lib/types";
import { cn, isoDate, money } from "@/lib/utils";

export function ExpensesGate({ children }: { children: React.ReactNode }) {
  const ready = useExpenses((s) => s.ready);
  if (!ready) return <EmptyState icon={DatabaseZap} title="One database step is pending" help="Run supabase/migrations/0008_expenses_documents.sql in the Supabase SQL editor, then reload this page. It adds expenses, petty cash, document designs and the public menu." />;
  return <>{children}</>;
}

/** Record one expense with its bill photo, for an event or for the business. */
export function ExpenseSheet({ open, onOpenChange, orderId }: { open: boolean; onOpenChange: (o: boolean) => void; orderId?: string }) {
  return <Sheet open={open} onOpenChange={onOpenChange} title="Add expense" description="Gas, ice, tips, local transport: anything paid out that is not a vendor bill.">{open && <ExpenseForm orderId={orderId} onDone={() => onOpenChange(false)} />}</Sheet>;
}

function ExpenseForm({ orderId, onDone }: { orderId?: string; onDone: () => void }) {
  const me = useCurrentUser();
  const { orders, clients, users } = useStore();
  const { petty, expenses, addExpense } = useExpenses();
  const [category, setCategory] = React.useState<ExpenseCategory>("gas");
  const [amount, setAmount] = React.useState(0);
  // "petty" means it came out of the cash this team member is holding.
  const [mode, setMode] = React.useState<PaymentMode | "petty">("cash");
  const [holder, setHolder] = React.useState(me.id);
  const [paidTo, setPaidTo] = React.useState("");
  const [order, setOrder] = React.useState(orderId ?? "");
  const [date, setDate] = React.useState(isoDate(new Date()));
  const [note, setNote] = React.useState("");
  const [photo, setPhoto] = React.useState<string>();
  const [busy, setBusy] = React.useState(false);
  const open = orders.filter((o) => o.status !== "cancelled").sort((a, b) => (b.functions[0]?.date ?? "").localeCompare(a.functions[0]?.date ?? ""));
  const float = pettyBalance(holder, petty, expenses).balance;

  const save = async () => {
    setBusy(true);
    try {
      const x: Omit<Expense, "id" | "number"> = { orderId: order || undefined, category, amount, mode: mode === "petty" ? "cash" : mode, pettyHolder: mode === "petty" ? holder : undefined, paidTo: paidTo.trim(), note: note.trim(), photoPath: photo, date };
      const saved = await addExpense(x);
      toast.success(`${saved.number}: ${money(amount)} recorded`);
      onDone();
    } catch (e) {
      toast.error("The expense was not saved", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">{expenseCategories.map((c) => <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>{c.label}</Chip>)}</div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount"><MoneyInput autoFocus value={amount} onChange={setAmount} /></Field>
        <Field label="Date"><Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></Field>
      </div>
      <div>
        <span className="mb-1 block text-xs font-medium text-text-muted">Paid by</span>
        <div className="grid grid-cols-3 gap-2">
          {[{ id: "petty" as const, label: "Petty cash" }, ...paymentModes.filter((m) => m.id !== "online")].map((m) => (
            <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => setMode(m.id)} className={cn("h-11 rounded-xl border text-sm font-medium", mode === m.id ? "border-primary bg-primary-soft text-primary" : "bg-surface text-text-muted hover:text-text")}>{m.label}</button>
          ))}
        </div>
      </div>
      {mode === "petty" && (
        <Field label="From the petty cash of" hint={`Holding ${money(float)}${float < amount ? ", less than this expense" : ""}`}>
          <Select value={holder} onChange={(e) => setHolder(e.target.value)}>{users.filter((u) => !u.invited).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>
        </Field>
      )}
      <Field label="Event (leave empty for a business expense)">
        <Select value={order} onChange={(e) => setOrder(e.target.value)}>
          <option value="">Not for one event</option>
          {open.map((o) => <option key={o.id} value={o.id}>{clients.find((c) => c.id === o.clientId)?.name} · {o.eventType} · {o.number}</option>)}
        </Select>
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Paid to"><Input value={paidTo} placeholder="Shree Gas Agency" onChange={(e) => setPaidTo(e.target.value)} /></Field>
        <Field label="Note"><Input value={note} placeholder="2 commercial cylinders" onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
      <div className="flex items-center gap-3">
        <PhotoButton variant="ghost" label={photo ? "Retake bill photo" : "Bill photo"} onUploaded={setPhoto} />
        {photo ? <img src={mediaUrl(photo)} alt="Bill" className="size-12 rounded-lg object-cover" /> : <span className="inline-flex items-center gap-1 text-xs text-text-muted"><Receipt className="size-4" strokeWidth={1.75} />Optional, but keeps the accountant happy</span>}
      </div>
      <Button variant="primary" size="lg" className="w-full" loading={busy} disabled={amount <= 0} onClick={save}>Save {amount > 0 ? money(amount) : "expense"}</Button>
    </div>
  );
}
