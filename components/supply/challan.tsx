"use client";

import { AlertTriangle, PackageOpen, Plus, Printer, Trash2, Truck, Undo2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/primitives";
import { useStore } from "@/lib/store";
import { assetCommitted, challanLoss } from "@/lib/supply";
import { useSupply } from "@/lib/supply-store";
import type { Challan, ChallanLine, ChallanStatus } from "@/lib/supply-types";
import type { EventFunction, Order } from "@/lib/types";
import { printLight } from "@/lib/ui";
import { cn, fmtDate, fmtTime, money, num, uid } from "@/lib/utils";
import { Num } from "./common";

const statusLabel: Record<ChallanStatus, string> = { draft: "Not issued", issued: "Out at the event", returned: "Returned" };

export function ChallanBadge({ status }: { status: ChallanStatus }) {
  return <Badge tone={status === "returned" ? "success" : status === "issued" ? "primary" : "neutral"}><span className="size-1.5 rounded-full bg-current" aria-hidden />{statusLabel[status]}</Badge>;
}

/** Issue and return count sheet for one function's crockery and equipment. */
export function ChallanEditor({ challan, fn }: { challan: Challan; fn: EventFunction }) {
  const orders = useStore((s) => s.orders);
  const tenantName = useStore((s) => s.tenant.name);
  const { assets, challans, vendors } = useSupply();
  const save = useSupply((s) => s.saveChallan);
  const chargeBreakage = useSupply((s) => s.chargeBreakage);
  const [add, setAdd] = React.useState("");
  const asset = (id: string) => assets.find((a) => a.id === id);
  const rentals = vendors.filter((v) => v.type === "rental");
  const setLine = (id: string, patch: Partial<ChallanLine>) => save({ ...challan, lines: challan.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  const loss = challanLoss(challan, assets);
  const rentalCost = challan.lines.reduce((s, l) => s + l.rentalCost, 0);
  const draft = challan.status === "draft";
  const out = challan.status === "issued";

  const rows = challan.lines.map((l) => {
    const a = asset(l.assetId);
    const free = Math.max(0, (a?.totalQty ?? 0) - assetCommitted(l.assetId, fn.date, challans, orders, challan.id));
    return { l, a, free, short: Math.max(0, l.required - free - l.rentedQty) };
  });
  const shortCount = rows.filter((r) => r.short > 0).length;

  const issue = () => {
    save({ ...challan, status: "issued", lines: challan.lines.map((l) => ({ ...l, issued: l.issued || l.required })) });
    toast.success(`${challan.number} issued`, { description: "Counts are locked in as sent to the venue." });
  };
  const receiveBack = () => {
    save({ ...challan, status: "returned", lines: challan.lines.map((l) => ({ ...l, returned: l.returned || Math.max(0, l.issued - l.broken - l.missing) })) });
    toast.success(`${challan.number} returned`);
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-heading text-base font-semibold">{fn.name} · {challan.number}</h3>
          <p className="tnum text-xs text-text-muted">{fmtDate(fn.date, { weekday: "short", day: "numeric", month: "short" })}, {fmtTime(fn.time)} · {num(fn.pax)} guests · {fn.venue}</p>
        </div>
        <ChallanBadge status={challan.status} />
      </div>

      {draft && shortCount > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-xs text-warning"><AlertTriangle className="size-4 shrink-0" strokeWidth={1.75} />{shortCount} {shortCount === 1 ? "item is" : "items are"} short on this date after other events are counted. Enter a rented quantity to cover the gap.</p>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="tnum w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs text-text-muted">
            <tr>
              <th className="py-1.5 font-medium">Item</th>
              <th className="py-1.5 text-right font-medium">Free that day</th>
              <th className="w-20 py-1.5 pl-2 text-right font-medium">Needed</th>
              {draft ? <th className="w-20 py-1.5 pl-2 text-right font-medium">Rent in</th> : <th className="w-20 py-1.5 pl-2 text-right font-medium">Issued</th>}
              {!draft && <><th className="w-20 py-1.5 pl-2 text-right font-medium">Returned</th><th className="w-20 py-1.5 pl-2 text-right font-medium">Broken</th><th className="w-20 py-1.5 pl-2 text-right font-medium">Missing</th></>}
              {draft && <th className="w-9" />}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(({ l, a, free, short }) => (
              <React.Fragment key={l.id}>
                <tr>
                  <td className="py-1.5">{a?.name}{draft && short > 0 && <span className="block text-xs text-warning">Short by {num(short)}</span>}{!draft && l.rentedQty > 0 && <span className="block text-xs text-text-muted">{num(l.rentedQty)} rented</span>}</td>
                  <td className={cn("py-1.5 text-right", free < l.required ? "text-warning" : "text-text-muted")}>{num(free)} of {num(a?.totalQty ?? 0)}</td>
                  <td className="py-1 pl-2">{draft ? <Num aria-label={`Needed ${a?.name}`} value={l.required} onChange={(v) => setLine(l.id, { required: Math.round(v) })} /> : <span className="block text-right">{num(l.required)}</span>}</td>
                  {draft ? (
                    <td className="py-1 pl-2"><Num aria-label={`Rent in ${a?.name}`} value={l.rentedQty} onChange={(v) => setLine(l.id, { rentedQty: Math.round(v) })} /></td>
                  ) : (
                    <td className="py-1 pl-2">{out ? <Num aria-label={`Issued ${a?.name}`} value={l.issued} onChange={(v) => setLine(l.id, { issued: Math.round(v) })} /> : <span className="block text-right">{num(l.issued)}</span>}</td>
                  )}
                  {!draft && (
                    <>
                      <td className="py-1 pl-2"><Num aria-label={`Returned ${a?.name}`} value={l.returned} onChange={(v) => setLine(l.id, { returned: Math.round(v) })} /></td>
                      <td className="py-1 pl-2"><Num aria-label={`Broken ${a?.name}`} value={l.broken} onChange={(v) => setLine(l.id, { broken: Math.round(v) })} /></td>
                      <td className="py-1 pl-2"><Num aria-label={`Missing ${a?.name}`} value={l.missing} onChange={(v) => setLine(l.id, { missing: Math.round(v) })} /></td>
                    </>
                  )}
                  {draft && <td className="py-1 pl-1"><Button variant="ghost" size="icon" aria-label={`Remove ${a?.name}`} onClick={() => save({ ...challan, lines: challan.lines.filter((x) => x.id !== l.id) })}><Trash2 strokeWidth={1.75} /></Button></td>}
                </tr>
                {l.rentedQty > 0 && draft && (
                  <tr className="bg-surface-muted/50">
                    <td colSpan={5} className="px-2 py-2">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <Field label="Rent from"><Select className="bg-surface" value={l.rentalVendorId ?? ""} onChange={(e) => setLine(l.id, { rentalVendorId: e.target.value || undefined })}><option value="">Choose a rental vendor</option>{rentals.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></Field>
                        <Field label="Rental cost"><Num className="bg-surface text-left" value={l.rentalCost} onChange={(v) => setLine(l.id, { rentalCost: v })} /></Field>
                        <Field label="Return due"><Input className="bg-surface" type="date" value={l.rentalDue ?? ""} onChange={(e) => setLine(l.id, { rentalDue: e.target.value || undefined })} /></Field>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {draft && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr]">
          <Select aria-label="Add an item" value={add} onChange={(e) => setAdd(e.target.value)}>
            <option value="">Add another item</option>
            {assets.filter((a) => !challan.lines.some((l) => l.assetId === a.id)).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          <Button disabled={!add} onClick={() => { save({ ...challan, lines: [...challan.lines, { id: uid(), assetId: add, required: 1, issued: 0, returned: 0, broken: 0, missing: 0, rentedQty: 0, rentalCost: 0, deliverTime: fn.time, deliverPlace: fn.venue }] }); setAdd(""); }}><Plus strokeWidth={1.75} />Add</Button>
          <Input aria-label="Vehicle" value={challan.vehicle} onChange={(e) => save({ ...challan, vehicle: e.target.value })} placeholder="Vehicle number and driver" />
        </div>
      )}

      {(loss > 0 || rentalCost > 0) && (
        <p className="tnum mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2 text-sm">
          <span>{loss > 0 && <>Breakage and loss <span className="font-semibold text-danger">{money(loss)}</span></>}{loss > 0 && rentalCost > 0 && " · "}{rentalCost > 0 && <>Rental <span className="font-semibold">{money(rentalCost)}</span></>}<span className="text-text-muted"> · counted against this event</span></span>
          {loss > 0 && (challan.breakageCharged ? <Badge tone="success">Charged to client</Badge> : <Button onClick={() => { chargeBreakage(challan.id, loss); toast.success(`${money(loss)} breakage charge added to the order`); }}>Charge client {money(loss)}</Button>)}
        </p>
      )}

      <div className="mt-3 flex flex-wrap justify-end gap-2 print:hidden">
        <Button onClick={printLight}><Printer strokeWidth={1.75} />{draft ? "Loading checklist" : "Print challan"}</Button>
        {out && <Button variant="ghost" onClick={() => save({ ...challan, status: "draft" })}><Undo2 strokeWidth={1.75} />Back to draft</Button>}
        {draft && <Button variant="primary" disabled={!challan.lines.length} onClick={issue}><Truck strokeWidth={1.75} />Issue to event</Button>}
        {out && <Button variant="primary" onClick={receiveBack}><PackageOpen strokeWidth={1.75} />Save return</Button>}
      </div>
      <p className="mt-2 hidden text-xs print:block">{tenantName} · {challan.vehicle} · Loaded by ________ · Received at venue by ________</p>
    </Card>
  );
}

/** Cutlery and equipment for one order: one challan per function. */
export function CutleryTab({ order }: { order: Order }) {
  const challans = useSupply((s) => s.challans);
  const createChallan = useSupply((s) => s.createChallan);
  const [busy, setBusy] = React.useState("");
  const functions = [...order.functions].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div className="space-y-3">
      {functions.map((fn) => {
        const challan = challans.find((c) => c.functionId === fn.id);
        if (challan) return <ChallanEditor key={fn.id} challan={challan} fn={fn} />;
        return (
          <Card key={fn.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div><h3 className="font-heading text-base font-semibold">{fn.name}</h3><p className="tnum text-xs text-text-muted">{fmtDate(fn.date, { weekday: "short", day: "numeric", month: "short" })} · {num(fn.pax)} guests · {fn.itemIds.length} dishes</p></div>
            <Button
              loading={busy === fn.id}
              onClick={async () => {
                setBusy(fn.id);
                try {
                  await createChallan(order.id, fn.id);
                } catch (e) {
                  toast.error("The challan was not created", { description: e instanceof Error ? e.message : undefined });
                } finally {
                  setBusy("");
                }
              }}
            >
              <Plus strokeWidth={1.75} />Work out the cutlery
            </Button>
          </Card>
        );
      })}
    </div>
  );
}
