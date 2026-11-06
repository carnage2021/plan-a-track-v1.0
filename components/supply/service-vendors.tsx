"use client";

import { Handshake } from "lucide-react";
import { DownloadPdf } from "@/components/documents/doc-actions";
import { VendorPicker } from "@/components/sales/vendor-picker";
import { Card, CardTitle } from "@/components/ui/primitives";
import { timeRange } from "@/lib/services";
import { useStore } from "@/lib/store";
import { useSupply } from "@/lib/supply-store";
import type { Order } from "@/lib/types";
import { fmtDate, money, num, rate } from "@/lib/utils";
import { serviceWorkOrders, vendorPrice } from "@/lib/vendor-services";

/**
 * The order's extra lines (service staff, cutlery, water, decoration) and who supplies each: in-house or a third-party
 * vendor, with what the vendor is paid. Each vendor gets a work order for each event; the client's prices do not change.
 */
export function ServiceVendors({ order, readOnly }: { order: Order; readOnly?: boolean }) {
  const setChargeVendor = useStore((s) => s.setChargeVendor);
  const vendors = useSupply((s) => s.vendors);
  const vendorItems = useSupply((s) => s.vendorItems);
  const events = order.functions.filter((f) => (f.charges ?? []).length);
  const works = serviceWorkOrders(order, vendorItems);
  const vendorName = (id: string) => vendors.find((v) => v.id === id)?.name ?? "Vendor";
  if (!events.length) return null;
  return (
    <Card>
      <CardTitle action={<span className="tnum text-xs text-text-muted">{works.length} vendor work {works.length === 1 ? "order" : "orders"}</span>}>
        <span className="flex items-center gap-2"><Handshake className="size-5 text-text-muted" strokeWidth={1.75} />Extra services and their vendors</span>
      </CardTitle>
      <p className="px-4 text-sm text-text-muted md:px-5">Staff, cutlery and other lines of this booking. Give a line to a vendor or agency. Their work order uses their own price list; the client&apos;s price stays as booked.</p>
      <div className="space-y-4 p-4 md:p-5">
        {events.map((f) => (
          <div key={f.id} className="rounded-xl border">
            <p className="border-b bg-surface-muted/50 px-3 py-2 text-sm"><span className="font-medium">{f.name}</span><span className="text-text-muted"> · {fmtDate(f.date, { weekday: "short", day: "numeric", month: "short" })} · {timeRange(f)} · {num(f.pax)} guests</span></p>
            <div className="overflow-x-auto">
              <table className="tnum w-full min-w-[620px] text-sm">
                <thead className="text-left text-xs text-text-muted"><tr><th className="px-3 py-1.5 font-medium">Item</th><th className="py-1.5 pr-3 font-medium">Qty</th><th className="py-1.5 pr-3 font-medium">Client rate</th><th className="w-60 py-1.5 pr-3 font-medium">Supplied by</th><th className="py-1.5 pr-3 text-right font-medium">Vendor price list</th></tr></thead>
                <tbody className="divide-y">
                  {(f.charges ?? []).map((c) => (
                    <tr key={c.id}>
                      <td className="px-3 py-2" data-no-title-case>{c.label || "Charge"}</td>
                      <td className="py-2 pr-3">{num(c.qty)}</td>
                      <td className="py-2 pr-3">{rate(c.rate)}</td>
                      <td className="py-2 pr-3">{readOnly ? (c.vendorId ? vendorName(c.vendorId) : "In-house") : <VendorPicker charge={c} onChange={(vendorId) => setChargeVendor(order.id, f.id, c.id, vendorId)} />}</td>
                      <td className="py-2 pr-3 text-right">{!c.vendorId ? "-" : (() => { const p = vendorPrice(c, vendorItems); return p ? `${rate(p.rate)}${p.unit ? ` / ${p.unit}` : ""} · ${money(c.qty * p.rate)}` : <span className="text-warning">Not on their list</span>; })()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {works.length > 0 && (
          <div className="border-t pt-3">
            <p className="mb-2 text-xs font-medium text-text-muted">Work orders for these vendors (for the vendor only, never the client)</p>
            <div className="flex flex-wrap gap-2">
              {works.map((w) => <DownloadPdf key={`${w.fn.id}-${w.vendorId}`} kind="service" id={w.fn.id} vendor={w.vendorId} lang="en" variant="ghost" label={`${w.number} · ${vendorName(w.vendorId)} · ${w.fn.name}`} />)}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
