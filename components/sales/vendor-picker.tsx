"use client";

import { Select } from "@/components/ui/input";
import { useSupply } from "@/lib/supply-store";
import type { EventCharge } from "@/lib/types";
import { cn } from "@/lib/utils";
import { listedItem, rankVendors } from "@/lib/vendor-services";

/**
 * Who supplies an extra line: in-house, or a third-party vendor or agency. Only the vendor is chosen here: what they
 * are paid comes from their price list and shows on their work order, never in the booking, whose price is the client's.
 */
export function VendorPicker({ charge, onChange, className, inline }: { charge: EventCharge; onChange: (vendorId: string | undefined) => void; className?: string; /** One line under a booking's charge: "Supplied by [vendor]" */ inline?: boolean }) {
  const vendors = useSupply((s) => s.vendors);
  const items = useSupply((s) => s.vendorItems);
  const name = charge.label || "this line";
  if (!vendors.length) return <span className="text-xs text-text-muted">{inline ? "Supplied in-house. Add vendors on the Vendors page to give lines to them." : "No vendors yet"}</span>;
  const ranked = rankVendors(charge, vendors, items);
  const listed = (id: string) => listedItem(id, charge.label, items);
  const select = (
    <Select aria-label={`Vendor for ${name}`} value={charge.vendorId ?? ""} onChange={(e) => onChange(e.target.value || undefined)} className={inline ? "!h-8 w-64 text-xs" : "!h-9"}>
      <option value="">In-house</option>
      {ranked.map((v) => <option key={v.id} value={v.id}>{v.name}{charge.label.trim() && listed(v.id) ? " · on their price list" : ""}</option>)}
    </Select>
  );
  // Said when the vendor has no price for the item, so it is fixed on their price list before the work order goes.
  const unlisted = !!charge.vendorId && items.length > 0 && !listed(charge.vendorId);
  if (inline)
    return (
      <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted", className)}>
        <span>Supplied by</span>
        {select}
        {charge.vendorId && <span>{unlisted ? "Not on their price list: their work order says \"as agreed\"" : "Their work order uses their own price list"}</span>}
      </div>
    );
  return (
    <div className={cn("space-y-1", className)}>
      {select}
      {unlisted && <p className="text-xs text-warning">Not on their price list</p>}
    </div>
  );
}
