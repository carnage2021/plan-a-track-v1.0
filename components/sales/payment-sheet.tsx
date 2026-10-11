"use client";

import { Banknote, Building2, CheckCircle2, CreditCard, QrCode, ScrollText, Send } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { MoneyInput, useOrderMoney } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { paidAmount, priceQuote } from "@/lib/pricing";
import { useStore } from "@/lib/store";
import type { Order, Payment, PaymentMode } from "@/lib/types";
import { useUi } from "@/lib/ui";
import { cn, fmtDate, money, whatsappLink } from "@/lib/utils";

export const paymentModes: { id: PaymentMode; label: string; icon: typeof Banknote }[] = [
  { id: "upi", label: "UPI", icon: QrCode },
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "bank", label: "Bank transfer", icon: Building2 },
  { id: "cheque", label: "Cheque", icon: ScrollText },
  { id: "online", label: "Card / link", icon: CreditCard },
];
export const modeLabel = (m: PaymentMode) => paymentModes.find((x) => x.id === m)?.label ?? m;

export function receiptText(tenantName: string, clientName: string, order: Order, payment: Payment, balance: number) {
  return `Dear ${clientName}, we have received ${money(payment.amount)} by ${modeLabel(payment.mode)} against ${order.number} (${order.eventType}). Receipt no. ${payment.receiptNo}, dated ${fmtDate(payment.date)}. Balance due: ${money(balance)}. Thank you. ${tenantName}`;
}

/** Receipt as the client will see it; also used for the preview before saving. */
export function ReceiptPreview({ order, amount, mode, receiptNo, date, balance }: { order: Order; amount: number; mode: PaymentMode; receiptNo: string; date: string; balance: number }) {
  const tenant = useStore((s) => s.tenant);
  const client = useStore((s) => s.clients.find((c) => c.id === order.clientId));
  return (
    <div className="overflow-hidden rounded-xl border bg-surface" style={{ "--brand": tenant.brandColor } as React.CSSProperties}>
      <div className="flex items-center justify-between gap-3 bg-brand px-4 py-3 text-brand-fg">
        <div className="min-w-0">
          <p className="truncate font-heading text-base font-semibold">{tenant.name}</p>
          <p className="truncate text-xs opacity-80">Payment receipt</p>
        </div>
        <p className="tnum shrink-0 text-xs opacity-80">{receiptNo}</p>
      </div>
      <dl className="space-y-2 p-4 text-sm">
        <div className="flex justify-between gap-3"><dt className="text-text-muted">Received from</dt><dd className="truncate font-medium">{client?.name}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-text-muted">Against</dt><dd className="tnum">{order.number}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-text-muted">Date and mode</dt><dd>{fmtDate(date)} · {modeLabel(mode)}</dd></div>
        <div className="flex items-baseline justify-between gap-3 border-t pt-3"><dt className="font-medium">Amount received</dt><dd className="tnum font-heading text-xl font-bold">{money(amount)}</dd></div>
        <div className="flex justify-between gap-3 text-text-muted"><dt>Balance after this</dt><dd className="tnum">{money(balance)}</dd></div>
      </dl>
    </div>
  );
}

function PaymentForm({ order, onDone }: { order: Order; onDone: () => void }) {
  const tenant = useStore((s) => s.tenant);
  const client = useStore((s) => s.clients.find((c) => c.id === order.clientId));
  const addPayment = useStore((s) => s.addPayment);
  const { due, totals } = useOrderMoney(order);
  const advance = order.payments.length === 0;
  const [amount, setAmount] = React.useState(() => (advance ? Math.round(totals.grand / 2 / 1000) * 1000 : due));
  const [mode, setMode] = React.useState<PaymentMode>("upi");
  const [note, setNote] = React.useState(advance ? "Booking advance" : "");
  const [saved, setSaved] = React.useState<Payment | null>(null);
  const [busy, setBusy] = React.useState(false);
  const record = async () => {
    setBusy(true);
    try {
      setSaved(await addPayment(order.id, amount, mode, note));
      toast.success(`${money(amount)} received from ${client?.name}`);
    } catch (e) {
      toast.error("The payment was not recorded", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  const balance = Math.max(0, due - (saved ? 0 : amount));
  const invalid = amount <= 0 || amount > due;

  if (saved) {
    const text = receiptText(tenant.name, client?.name ?? "", order, saved, due);
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-sm font-medium text-success"><CheckCircle2 className="size-5" strokeWidth={1.75} />Payment recorded</p>
        <ReceiptPreview order={order} amount={saved.amount} mode={saved.mode} receiptNo={saved.receiptNo} date={saved.date} balance={due} />
        <div className="flex gap-2">
          <Button variant="primary" size="lg" className="flex-1" asChild>
            <a href={whatsappLink(client?.phone ?? "", text)} target="_blank" rel="noreferrer"><Send strokeWidth={1.75} />Send receipt on WhatsApp</a>
          </Button>
          <Button size="lg" onClick={onDone}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl bg-surface-muted px-4 py-3">
        <div>
          <p className="text-xs text-text-muted">Balance due</p>
          <p className="tnum font-heading text-xl font-bold">{money(due)}</p>
        </div>
        <p className="tnum text-right text-xs text-text-muted">Order total {money(totals.grand)}<br />Received {money(paidAmount(order.payments))}</p>
      </div>
      <Field label="Amount received" error={amount > due ? `This is more than the balance of ${money(due)}` : ""}>
        <MoneyInput value={amount} onChange={setAmount} autoFocus />
      </Field>
      <div className="flex gap-2">
        {[25, 50, 100].map((pct) => (
          <button key={pct} type="button" onClick={() => setAmount(pct === 100 ? due : Math.round((totals.grand * pct) / 100 / 100) * 100)} className="tnum h-9 flex-1 rounded-full border bg-surface text-sm font-medium text-text-muted hover:text-text">
            {pct === 100 ? "Full balance" : `${pct}% of total`}
          </button>
        ))}
      </div>
      <div>
        <span className="mb-1 block text-xs font-medium text-text-muted">Payment mode</span>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {paymentModes.map((m) => (
            <button key={m.id} type="button" onClick={() => setMode(m.id)} aria-pressed={mode === m.id} className={cn("flex h-16 flex-col items-center justify-center gap-1 rounded-xl border text-xs font-medium transition-colors duration-150", mode === m.id ? "border-primary bg-primary-soft text-primary" : "bg-surface text-text-muted hover:text-text")}>
              <m.icon className="size-5" strokeWidth={1.75} />
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {mode === "upi" && (
        <div className="flex items-center gap-3 rounded-xl border p-3">
          <span className="grid size-16 shrink-0 place-items-center rounded-lg bg-surface-muted text-text"><QrCode className="size-10" strokeWidth={1.25} /></span>
          <div className="min-w-0 text-sm">
            <p className="font-medium">Pay to {tenant.upiId}</p>
            <p className="text-xs text-text-muted">A scannable QR for the exact amount appears here once Razorpay is connected in phase 5.</p>
          </div>
        </div>
      )}
      <Field label="Note (optional)">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Booking advance, cheque number, reference" />
      </Field>
      <div>
        <span className="mb-1 block text-xs font-medium text-text-muted">Receipt preview</span>
        <ReceiptPreview order={order} amount={amount} mode={mode} receiptNo="Number given on saving" date={new Date().toISOString()} balance={balance} />
      </div>
      <Button variant="primary" size="lg" className="w-full" disabled={invalid} loading={busy} onClick={record}>
        Record {money(amount)}
      </Button>
    </div>
  );
}

export function PaymentSheet() {
  const open = useUi((s) => s.payment.open);
  return <PaymentSheetBody key={String(open)} />;
}

function PaymentSheetBody() {
  const { open, orderId } = useUi((s) => s.payment);
  const close = useUi((s) => s.closePayment);
  const orders = useStore((s) => s.orders);
  const clients = useStore((s) => s.clients);
  const items = useStore((s) => s.items);
  const packages = useStore((s) => s.packages);
  const slabs = useStore((s) => s.tenant.slabs);
  const [picked, setPicked] = React.useState("");
  const outstanding = React.useMemo(
    () => orders.filter((o) => o.status !== "cancelled").map((o) => ({ o, due: priceQuote(o, items, packages, slabs).grand - paidAmount(o.payments) })).filter((x) => x.due > 0),
    [orders, items, packages, slabs],
  );
  const currentId = orderId ?? picked;
  const order = orders.find((o) => o.id === currentId);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()} title="Record payment" description="The receipt is created the moment you save.">
      {!orderId && (
        <Field label="Order" className="mb-4">
          <Select value={picked} onChange={(e) => setPicked(e.target.value)}>
            <option value="">Choose an order with a balance</option>
            {outstanding.map(({ o, due }) => (
              <option key={o.id} value={o.id}>{clients.find((c) => c.id === o.clientId)?.name} · {o.eventType} · {money(due)} due</option>
            ))}
          </Select>
        </Field>
      )}
      {order ? <PaymentForm key={order.id} order={order} onDone={close} /> : !orderId && outstanding.length === 0 && <p className="text-sm text-text-muted">Every order is fully paid.</p>}
    </Sheet>
  );
}
