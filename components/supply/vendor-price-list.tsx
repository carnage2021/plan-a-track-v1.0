"use client";

import { Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { MoneyInput } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSupply } from "@/lib/supply-store";
import type { Vendor } from "@/lib/supply-types";
import { rate } from "@/lib/utils";

/**
 * What a vendor supplies and at what rate: services (waiter, valet), products (water bottle) or anything else. When
 * this vendor is picked for a line in a booking, the rate of the matching item fills in. Uploaded from the
 * "Vendor price list" sheet on the Import page, or kept here.
 */
export function VendorPriceList({ vendor }: { vendor: Vendor }) {
  const { vendorItems, vendorItemsReady, saveVendorItem, deleteVendorItem } = useSupply();
  const [draft, setDraft] = React.useState({ name: "", unit: "", rate: 0 });
  if (!vendorItemsReady) return <p className="rounded-lg bg-warning/10 p-3 text-sm text-warning">Run the 0027 database update to keep a price list for each vendor.</p>;
  const mine = vendorItems.filter((i) => i.vendorId === vendor.id);
  const add = () => {
    if (!draft.name.trim()) return;
    if (mine.some((i) => i.name.trim().toLowerCase() === draft.name.trim().toLowerCase())) return toast.error(`${draft.name.trim()} is already on the list`, { description: "Change its rate below." });
    saveVendorItem({ vendorId: vendor.id, name: draft.name.trim(), unit: draft.unit.trim(), rate: draft.rate });
    setDraft({ name: "", unit: "", rate: 0 });
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">Services and products {vendor.name} supplies, with their rate. Pick this vendor for a line in a booking (waiters, water, decoration) and the rate of the matching item fills in.</p>
      <form className="grid grid-cols-[1fr_6rem_8rem_auto] items-end gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <Input aria-label="Item or service" placeholder="Item or service, e.g. Waiter" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
        <Input aria-label="Unit" placeholder="Unit" value={draft.unit} onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))} />
        <MoneyInput label="Rate" value={draft.rate} onChange={(v) => setDraft((d) => ({ ...d, rate: v }))} />
        <Button type="submit" disabled={!draft.name.trim()}><Plus strokeWidth={1.75} />Add</Button>
      </form>
      {mine.length === 0 ? <p className="py-4 text-center text-sm text-text-muted">Nothing on the price list yet.</p> : (
        <ul className="tnum divide-y text-sm">
          {mine.map((i) => (
            <li key={i.id} className="grid grid-cols-[1fr_6rem_8rem_auto] items-center gap-2 py-1.5">
              <span className="truncate" data-no-title-case>{i.name}</span>
              <span className="text-text-muted">{i.unit || "-"}</span>
              <MoneyInput label={`Rate for ${i.name}`} value={i.rate} onChange={(v) => saveVendorItem({ ...i, rate: v })} />
              <Button variant="ghost" size="icon" aria-label={`Remove ${i.name}`} onClick={() => { deleteVendorItem(i.id); toast.success(`${i.name} removed`, { description: `Was ${rate(i.rate)}` }); }}><Trash2 strokeWidth={1.75} /></Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
