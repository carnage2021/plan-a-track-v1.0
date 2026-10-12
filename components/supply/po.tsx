"use client";

import { AlertTriangle, PackageCheck, Printer, ReceiptText, Send, ShoppingCart } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/badges";
import { EmptyState, MoneyInput } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Card, Chip } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { useStore } from "@/lib/store";
import { fmtQty, poTotal } from "@/lib/supply";
import { useSupply } from "@/lib/supply-store";
import type { PoStatus, PurchaseOrder } from "@/lib/supply-types";
import { printLight } from "@/lib/ui";
import { cn, fmtDate, fmtTime, isoDate, money, whatsappLink } from "@/lib/utils";
import { Num } from "./common";

const tone: Record<PoStatus, "neutral" | "info" | "warning" | "success" | "danger"> = { draft: "neutral", sent: "info", partial: "warning", received: "success", cancelled: "danger" };
const label: Record<PoStatus, string> = { draft: "Draft", sent: "Sent", partial: "Part received", received: "Received", cancelled: "Cancelled" };

export function PoBadge({ status }: { status: PoStatus }) {
  return <Badge tone={tone[status]}><span className="size-1.5 rounded-full bg-current" aria-hidden />{label[status]}</Badge>;
}

function PoSheet({ po, onClose }: { po: PurchaseOrder; onClose: () => void }) {
  const tenant = useStore((s) => s.tenant);
  const { ingredients, vendors, stores, bills } = useSupply();
  const setPoStatus = useSupply((s) => s.setPoStatus);
  const receivePo = useSupply((s) => s.receivePo);
  const addBill = useSupply((s) => s.addBill);
  const vendor = vendors.find((v) => v.id === po.vendorId);
  const ing = (id: string) => ingredients.find((i) => i.id === id);
  const [receiving, setReceiving] = React.useState(false);
  const [storeId, setStoreId] = React.useState(stores[0]?.id ?? "");
  const [got, setGot] = React.useState<Record<string, { qty: number; rate: number }>>({});
  const [billing, setBilling] = React.useState(false);
  const [billNo, setBillNo] = React.useState("");
  const [billAmount, setBillAmount] = React.useState(0);
  const open = po.lines.filter((l) => (l.receivedQty ?? 0) < l.qty);
  const billed = bills.filter((b) => b.poId === po.id).reduce((s, b) => s + b.amount, 0);
  const total = poTotal(po);

  const startReceiving = () => {
    setGot(Object.fromEntries(open.map((l) => [l.id, { qty: l.qty - (l.receivedQty ?? 0), rate: l.rate }])));
    setReceiving(true);
  };
  const text = `Purchase order ${po.number} from ${tenant.name}\n\n${po.lines.map((l) => `• ${ing(l.ingredientId)?.name}: ${fmtQty(l.qty)} ${ing(l.ingredientId)?.unit} @ ₹${l.rate}`).join("\n")}\n\nTotal: ${money(total)}\nDeliver by ${fmtDate(po.expectedOn)}${po.deliverTime ? `, ${fmtTime(po.deliverTime)}` : ""} at ${po.deliverPlace}.\nPlease confirm.`;

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={po.number}
      description={`${vendor?.name} · deliver by ${fmtDate(po.expectedOn, { day: "numeric", month: "short" })}${po.deliverTime ? `, ${fmtTime(po.deliverTime)}` : ""} at ${po.deliverPlace}`}
      wide
      footer={
        receiving ? (
          <>
            <Button variant="ghost" onClick={() => setReceiving(false)}>Back</Button>
            <Button variant="primary" disabled={!storeId} onClick={() => { receivePo(po.id, storeId, got); setReceiving(false); toast.success("Goods received", { description: "Stock and latest rates are updated." }); }}><PackageCheck strokeWidth={1.75} />Save goods received</Button>
          </>
        ) : (
          <>
            <Button onClick={printLight}><Printer strokeWidth={1.75} />Print</Button>
            {po.status === "draft" && <Button variant="ghost" onClick={() => { setPoStatus(po.id, "cancelled"); toast("Purchase order cancelled", { action: { label: "Undo", onClick: () => setPoStatus(po.id, "draft") } }); }}>Cancel order</Button>}
            {(po.status === "draft" || po.status === "sent") && (
              <Button variant={po.status === "draft" ? "primary" : "secondary"} asChild>
                <a href={whatsappLink(vendor?.phone ?? "", text)} target="_blank" rel="noreferrer" onClick={() => po.status === "draft" && setPoStatus(po.id, "sent")}><Send strokeWidth={1.75} />{po.status === "draft" ? "Send on WhatsApp" : "Send again"}</a>
              </Button>
            )}
            {(po.status === "sent" || po.status === "partial") && <Button variant="primary" onClick={startReceiving}><PackageCheck strokeWidth={1.75} />Receive goods</Button>}
          </>
        )
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2"><PoBadge status={po.status} /><span className="tnum text-sm text-text-muted">{po.lines.length} items · {money(total)}</span></div>

      {receiving ? (
        <div className="space-y-3">
          {stores.length > 1 && <Field label="Receive into"><Select value={storeId} onChange={(e) => setStoreId(e.target.value)}>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>}
          <table className="tnum w-full text-sm">
            <thead className="text-left text-xs text-text-muted"><tr><th className="py-2 font-medium">Item</th><th className="py-2 text-right font-medium">Ordered</th><th className="w-24 py-2 pl-2 text-right font-medium">Received</th><th className="w-24 py-2 pl-2 text-right font-medium">Rate</th></tr></thead>
            <tbody className="divide-y">
              {open.map((l) => {
                const g = got[l.id] ?? { qty: 0, rate: l.rate };
                const pending = l.qty - (l.receivedQty ?? 0);
                const flag = g.qty < pending ? `Short by ${fmtQty(pending - g.qty)}` : g.qty > pending ? `Excess ${fmtQty(g.qty - pending)}` : g.rate !== l.rate ? `Rate was ₹${l.rate}` : "";
                return (
                  <tr key={l.id}>
                    <td className="py-1.5">{ing(l.ingredientId)?.name}{flag && <span className="flex items-center gap-1 text-xs text-warning"><AlertTriangle className="size-3.5" strokeWidth={1.75} />{flag}</span>}</td>
                    <td className="py-1.5 text-right text-text-muted">{fmtQty(pending)} {ing(l.ingredientId)?.unit}</td>
                    <td className="py-1 pl-2"><Num aria-label="Received quantity" value={g.qty} onChange={(qty) => setGot((x) => ({ ...x, [l.id]: { ...g, qty } }))} /></td>
                    <td className="py-1 pl-2"><Num aria-label="Rate charged" value={g.rate} onChange={(rate) => setGot((x) => ({ ...x, [l.id]: { ...g, rate } }))} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="tnum w-full min-w-[520px] text-sm">
              <thead className="text-left text-xs text-text-muted"><tr><th className="py-2 font-medium">Item</th><th className="py-2 text-right font-medium">Ordered</th><th className="py-2 text-right font-medium">Received</th><th className="py-2 text-right font-medium">Rate</th><th className="py-2 text-right font-medium">Amount</th></tr></thead>
              <tbody className="divide-y">
                {po.lines.map((l) => {
                  const short = l.receivedQty !== null && l.receivedQty < l.qty;
                  const excess = l.receivedQty !== null && l.receivedQty > l.qty;
                  return (
                    <tr key={l.id}>
                      <td className="py-2">{ing(l.ingredientId)?.name}<span className="block text-xs text-text-muted">{l.deliverOn ? fmtDate(l.deliverOn, { day: "numeric", month: "short" }) : ""}{l.deliverTime ? `, ${fmtTime(l.deliverTime)}` : ""} · {l.deliverPlace}</span></td>
                      <td className="py-2 text-right">{fmtQty(l.qty)} {ing(l.ingredientId)?.unit}</td>
                      <td className={cn("py-2 text-right", short && "text-warning", excess && "text-info")}>{l.receivedQty === null ? "–" : fmtQty(l.receivedQty)}{short ? " short" : excess ? " excess" : ""}</td>
                      <td className={cn("py-2 text-right", l.receivedRate !== null && l.receivedRate !== l.rate && "text-warning")}>{money(l.receivedRate ?? l.rate)}</td>
                      <td className="py-2 text-right">{money((l.receivedQty ?? l.qty) * (l.receivedRate ?? l.rate))}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr className="border-t-2"><td className="py-2 font-medium" colSpan={4}>Total</td><td className="py-2 text-right font-heading text-base font-bold">{money(total)}</td></tr></tfoot>
            </table>
          </div>

          {(po.status === "received" || po.status === "partial") && (
            <div className="mt-4 rounded-xl border p-3 print:hidden">
              <div className="flex items-center justify-between gap-2">
                <p className="tnum text-sm">Vendor bill<span className="block text-xs text-text-muted">{billed ? `${money(billed)} entered against this order` : "No bill entered yet"}</span></p>
                {!billing && <Button onClick={() => { setBillAmount(Math.max(0, Math.round(total - billed))); setBilling(true); }}><ReceiptText strokeWidth={1.75} />Enter bill</Button>}
              </div>
              {billing && (
                <div className="mt-3 grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                  <Field label="Bill number"><Input value={billNo} onChange={(e) => setBillNo(e.target.value)} /></Field>
                  <Field label="Amount"><MoneyInput value={billAmount} onChange={setBillAmount} /></Field>
                  <Button variant="primary" className="h-11 md:h-9" disabled={billAmount <= 0} onClick={() => { addBill({ vendorId: po.vendorId, poId: po.id, billNo, date: isoDate(new Date()), amount: billAmount, note: po.number }); setBilling(false); setBillNo(""); toast.success("Bill added to the vendor ledger"); }}>Save</Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}

export function PoTab() {
  const { purchaseOrders, vendors } = useSupply();
  const [filter, setFilter] = React.useState<"open" | "received" | "all">("open");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const shown = purchaseOrders.filter((p) => (filter === "all" ? true : filter === "open" ? ["draft", "sent", "partial"].includes(p.status) : p.status === "received"));
  const current = purchaseOrders.find((p) => p.id === openId);
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {([["open", "Open"], ["received", "Received"], ["all", "All"]] as const).map(([id, text]) => <Chip key={id} active={filter === id} onClick={() => setFilter(id)}>{text}</Chip>)}
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="No purchase orders here" help="Create them from the Purchase list tab, or from an order's Raw material tab. They are split by vendor for you." />
      ) : (
        <Card className="divide-y">
          {shown.map((p) => (
            <button key={p.id} type="button" onClick={() => setOpenId(p.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-muted/60">
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{vendors.find((v) => v.id === p.vendorId)?.name}</span><span className="tnum block truncate text-xs text-text-muted">{p.number} · {p.lines.length} items · deliver by {fmtDate(p.expectedOn, { day: "numeric", month: "short" })}</span></span>
              <span className="tnum text-sm font-semibold">{money(poTotal(p))}</span>
              <PoBadge status={p.status} />
            </button>
          ))}
        </Card>
      )}
      {current && <PoSheet key={current.id} po={current} onClose={() => setOpenId(null)} />}
    </div>
  );
}
