import type { Vendor, VendorItem, VendorType } from "./supply-types";
import type { EventCharge, EventFunction, Order } from "./types";
import { sameThing } from "./utils";

// Extra lines on an event (service staff, cutlery, water, decoration) can be given to a third-party vendor. The client
// is charged the line's own rate; the vendor is paid its vendor rate, on a work order of their own for that event.

/** The vendor types that usually supply a kind of line, best first. */
const usual: Record<EventCharge["kind"], VendorType[]> = {
  worker: ["labour", "hospitality"],
  cutlery: ["rental", "hospitality"],
  other: ["hospitality", "rental", "decor", "raw_material", "transport"],
};

/** The vendor's price list line for this charge: the same name, or a close one ("Water bottle" for "Water"). */
export const listedItem = (vendorId: string, label: string, items: VendorItem[]) => {
  const mine = items.filter((i) => i.vendorId === vendorId);
  const k = label.trim().toLowerCase();
  return mine.find((i) => i.name.trim().toLowerCase() === k) ?? mine.find((i) => sameThing(i.name, label));
};

/** Every vendor, those with this item on their price list first, then the usual type for the line, then A to Z. */
export function rankVendors(charge: Pick<EventCharge, "kind" | "label">, vendors: Vendor[], items: VendorItem[]) {
  const types = usual[charge.kind];
  const score = (v: Vendor) => (charge.label.trim() && listedItem(v.id, charge.label, items) ? 0 : types.includes(v.type) ? 1 + types.indexOf(v.type) / 10 : 3);
  return [...vendors].sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

/** What the vendor charges for a line, from their price list; undefined when the item is not on it. */
export const vendorPrice = (c: Pick<EventCharge, "vendorId" | "label">, items: VendorItem[]) => (c.vendorId ? listedItem(c.vendorId, c.label, items) : undefined);

export interface ServiceLine {
  charge: EventCharge;
  /** The vendor's price list line for it, when there is one */
  price?: VendorItem;
  amount: number;
}

export interface ServiceWorkOrder {
  /** WO number, made from the order's number so it stays the same on every download */
  number: string;
  fn: EventFunction;
  vendorId: string;
  lines: ServiceLine[];
  /** At the vendor's own prices; lines not on their price list are left out (shown "as agreed") */
  total: number;
  /** Lines with no price on the vendor's list */
  unpriced: number;
}

/**
 * One work order for each vendor on each event of the order, in event order. Quantities come from the booking; prices
 * from the vendor's price list (what we pay them), never the client's price typed in the booking.
 */
export function serviceWorkOrders(order: Pick<Order, "number" | "functions">, items: VendorItem[]): ServiceWorkOrder[] {
  const out: ServiceWorkOrder[] = [];
  const fns = [...order.functions].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999") || a.time.localeCompare(b.time));
  for (const fn of fns) {
    const byVendor = new Map<string, EventCharge[]>();
    for (const c of fn.charges ?? []) if (c.vendorId && c.qty > 0) byVendor.set(c.vendorId, [...(byVendor.get(c.vendorId) ?? []), c]);
    for (const [vendorId, charges] of byVendor) {
      const lines = charges.map((charge) => { const price = vendorPrice(charge, items); return { charge, price, amount: price ? charge.qty * price.rate : 0 }; });
      out.push({ number: `${order.number}/S${out.length + 1}`, fn, vendorId, lines, total: lines.reduce((s, l) => s + l.amount, 0), unpriced: lines.filter((l) => !l.price).length });
    }
  }
  return out;
}
