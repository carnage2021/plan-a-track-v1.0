"use client";

import { AlertTriangle, ChefHat, Clock, MapPin, RefreshCw, Send, Truck } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/sheet";
import { marginTone } from "@/lib/pricing";
import { useStore } from "@/lib/store";
import { outsourceTotals } from "@/lib/supply";
import { useSupply } from "@/lib/supply-store";
import type { OutsourceOrder, OutsourceStatus } from "@/lib/supply-types";
import type { Order } from "@/lib/types";
import { cn, fmtDate, fmtTime, isoDate, money, num, whatsappLink } from "@/lib/utils";
import { Num } from "./common";
import { logWhatsApp } from "@/lib/messages";

const flow: OutsourceStatus[] = ["draft", "sent", "accepted", "preparing", "dispatched", "delivered"];
const label: Record<OutsourceStatus, string> = { draft: "Draft", sent: "Sent", accepted: "Accepted", preparing: "In preparation", dispatched: "Dispatched", delivered: "Delivered", cancelled: "Cancelled" };
const next: Partial<Record<OutsourceStatus, string>> = { sent: "Mark accepted", accepted: "Mark in preparation", preparing: "Mark dispatched", dispatched: "Mark delivered" };

function OutsourceCard({ o, order }: { o: OutsourceOrder; order: Order }) {
  const tenantName = useStore((s) => s.tenant.name);
  const items = useStore((s) => s.items);
  const vendor = useSupply((s) => s.vendors.find((v) => v.id === o.vendorId));
  const patch = useSupply((s) => s.patchOutsource);
  const addBill = useSupply((s) => s.addBill);
  const billed = useSupply((s) => s.bills.some((b) => b.outsourceId === o.id));
  const fn = order.functions.find((f) => f.id === o.functionId);
  const totals = outsourceTotals(o);
  const step = flow.indexOf(o.status);
  const [delivering, setDelivering] = React.useState(false);
  const [onTime, setOnTime] = React.useState("yes");
  const [issue, setIssue] = React.useState("");
  const name = (id: string) => items.find((i) => i.id === id)?.name ?? "";
  const editable = o.status === "draft" || o.status === "sent";
  const text = `Order ${o.number} from ${tenantName}\n\n${o.lines.map((l) => `• ${name(l.itemId)}: ${num(l.qty)} @ ₹${l.agencyRate}`).join("\n")}\n\nTotal: ${money(totals.cost)}\nDeliver on ${fmtDate(o.deliverOn)}, ${fmtTime(o.deliverTime)} at ${o.deliverPlace}.\nContact: ${o.contact}\n\nPlease reply to accept, or send your rate if it has changed.`;

  const advance = () => {
    if (o.status === "dispatched") return setDelivering(true);
    patch(o.id, { status: flow[step + 1] });
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-heading text-base font-semibold">{vendor?.name}</h3>
          <p className="tnum mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
            <span>{o.number} · {fn?.name}</span>
            <span className="inline-flex items-center gap-1"><Clock className="size-3.5" strokeWidth={1.75} />{fmtDate(o.deliverOn, { day: "numeric", month: "short" })}, {fmtTime(o.deliverTime)}</span>
            <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="size-3.5 shrink-0" strokeWidth={1.75} /><span className="truncate">{o.deliverPlace}</span></span>
          </p>
        </div>
        <Badge tone={o.status === "delivered" ? "success" : o.status === "cancelled" ? "danger" : o.status === "draft" ? "neutral" : "info"}><span className="size-1.5 rounded-full bg-current" aria-hidden />{label[o.status]}</Badge>
      </div>

      {o.status !== "cancelled" && (
        <ol className="mt-3 flex gap-1" aria-label={`Status: ${label[o.status]}`}>
          {flow.slice(1).map((s, i) => <li key={s} className={cn("h-1.5 flex-1 rounded-full", i < step ? "bg-success" : "bg-surface-muted")} title={label[s]} />)}
        </ol>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="tnum w-full min-w-[420px] text-sm">
          <thead className="text-left text-xs text-text-muted"><tr><th className="py-1.5 font-medium">Dish</th><th className="py-1.5 text-right font-medium">Qty</th><th className="w-24 py-1.5 pl-2 text-right font-medium">Agency rate</th><th className="py-1.5 text-right font-medium">Client rate</th><th className="py-1.5 text-right font-medium">Margin</th></tr></thead>
          <tbody className="divide-y">
            {o.lines.map((l) => (
              <tr key={l.id}>
                <td className="py-1.5">{name(l.itemId)}</td>
                <td className="py-1.5 text-right">{num(l.qty)}</td>
                <td className="py-1 pl-2">{editable ? <Num aria-label={`Agency rate for ${name(l.itemId)}`} value={l.agencyRate} onChange={(v) => patch(o.id, { lines: o.lines.map((x) => (x.id === l.id ? { ...x, agencyRate: v } : x)) })} /> : <span className="block text-right">{money(l.agencyRate)}</span>}</td>
                <td className="py-1.5 text-right text-text-muted">{money(l.clientRate)}</td>
                <td className={cn("py-1.5 text-right", l.clientRate < l.agencyRate ? "text-danger" : "text-success")}>{money((l.clientRate - l.agencyRate) * l.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tnum mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>Agency cost <span className="font-semibold">{money(totals.cost)}</span><span className="text-text-muted"> · client pays {money(totals.revenue)}</span></span>
        <Badge tone={marginTone(totals.marginPct)}>{Math.round(totals.marginPct)}% margin</Badge>
      </p>
      {o.issue && <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-warning/10 p-2 text-xs text-warning"><AlertTriangle className="size-3.5 shrink-0" strokeWidth={1.75} />{o.onTime === false ? "Late. " : ""}{o.issue}</p>}

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {editable && <Button variant="ghost" onClick={() => { patch(o.id, { status: "cancelled" }); toast("Agency order cancelled", { action: { label: "Undo", onClick: () => patch(o.id, { status: o.status }) } }); }}>Cancel</Button>}
        {editable && (
          <Button variant={o.status === "draft" ? "primary" : "secondary"} asChild>
            <a href={whatsappLink(vendor?.phone ?? "", text)} target="_blank" rel="noreferrer" onClick={() => { if (o.status === "draft") patch(o.id, { status: "sent" }); logWhatsApp("outsource_order", vendor?.name ?? "", vendor?.phone ?? "", text, o.orderId)(); }}><Send strokeWidth={1.75} />{o.status === "draft" ? "Send on WhatsApp" : "Send again"}</a>
          </Button>
        )}
        {next[o.status] && <Button variant={o.status === "sent" ? "secondary" : "primary"} onClick={advance}><Truck strokeWidth={1.75} />{next[o.status]}</Button>}
        {o.status === "delivered" && !billed && <Button onClick={() => { addBill({ vendorId: o.vendorId, outsourceId: o.id, billNo: "", date: isoDate(new Date()), amount: totals.cost, note: o.number }); toast.success(`${money(totals.cost)} added to ${vendor?.name}'s ledger`); }}>Add to vendor ledger</Button>}
      </div>

      <Modal
        open={delivering}
        onOpenChange={setDelivering}
        title="Delivered"
        description="This feeds the agency's performance score."
        footer={<><Button variant="ghost" onClick={() => setDelivering(false)}>Cancel</Button><Button variant="primary" onClick={() => { patch(o.id, { status: "delivered", onTime: onTime === "yes", issue: issue.trim() || undefined }); setDelivering(false); }}>Save</Button></>}
      >
        <div className="space-y-3">
          <Field label="Was it on time?"><Select value={onTime} onChange={(e) => setOnTime(e.target.value)}><option value="yes">Yes, on time</option><option value="no">No, it was late</option></Select></Field>
          <Field label="Any issue (optional)"><Input value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="Short quantity, melted, wrong flavour" /></Field>
        </div>
      </Modal>
    </Card>
  );
}

/** Third-party food orders for one catering order, drafted from its outsourced dishes. */
export function AgenciesTab({ order }: { order: Order }) {
  const items = useStore((s) => s.items);
  const patchOrder = useStore((s) => s.patchOrder);
  const client = useStore((s) => s.clients.find((c) => c.id === order.clientId));
  const all = useSupply((s) => s.outsourceOrders);
  const draftOutsource = useSupply((s) => s.draftOutsource);
  const [busy, setBusy] = React.useState(false);
  const mine = all.filter((o) => o.orderId === order.id);
  const outsourced = items.filter((i) => i.outsourced && order.functions.some((f) => f.itemIds.includes(i.id)));
  const unmapped = outsourced.filter((i) => !i.agencyId);

  const generate = async () => {
    setBusy(true);
    try {
      const n = await draftOutsource(order.id);
      toast[n ? "success" : "message"](n ? `${n} agency ${n === 1 ? "order" : "orders"} drafted` : "Nothing new to draft");
    } catch (e) {
      toast.error("Agency orders were not created", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {unmapped.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-xs text-warning"><AlertTriangle className="size-4 shrink-0" strokeWidth={1.75} />{unmapped.map((i) => i.name).join(", ")} {unmapped.length === 1 ? "is" : "are"} outsourced but no agency is chosen. Open the dish on the Menu page and pick one.</p>
      )}
      {outsourced.length === 0 ? (
        <EmptyState icon={ChefHat} title="Nothing is outsourced on this order" help="Every dish is made in-house. Mark a dish as outsourced on the Menu page to send it to an agency." />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-text-muted">{outsourced.length} outsourced {outsourced.length === 1 ? "dish" : "dishes"} · {mine.filter((o) => o.status !== "cancelled").length} agency orders</p>
            <Button loading={busy} onClick={generate}><RefreshCw strokeWidth={1.75} />Draft agency orders</Button>
          </div>
          {mine.length === 0 && <p className="rounded-xl border border-dashed py-8 text-center text-sm text-text-muted">Agency orders are drafted automatically when the booking advance confirms the order.</p>}
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">{mine.map((o) => <OutsourceCard key={o.id} o={o} order={order} />)}</div>
        </>
      )}
      {client?.type === "agency" && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0"><h3 className="font-heading text-base font-semibold">Partner commission</h3><p className="text-sm text-text-muted">{client.name} booked you as their caterer. Commission is taken off your margin, not shown to their client.</p></div>
          <label className="flex items-center gap-2 text-sm"><Num aria-label="Commission percent" className="w-20" value={order.commissionPct} onChange={(v) => patchOrder(order.id, { commissionPct: Math.min(50, v) })} />percent</label>
        </Card>
      )}
    </div>
  );
}
