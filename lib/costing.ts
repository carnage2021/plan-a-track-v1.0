import { vendorPrice } from "./vendor-services";
import type { VendorItem } from "./supply-types";
import { priceFunction, priceQuote } from "./pricing";
import { dishGuests, functionNeed } from "./supply";
import type { Asset, Challan, Ingredient, OutsourceOrder, RecipeLine, Vendor } from "./supply-types";
import type { EventFunction, MenuItem, MenuPackage, Order, Tenant } from "./types";

// What one order costs the caterer and what it earns them: the bill before GST against every cost the platform
// knows of. Raw material comes from the recipes at the latest purchase rate, third-party food from the agency orders
// (or, before they are drafted, from the menu at each dish's agency rate), staff from the tasks planned, then
// transport, cutlery hire and breakage, and expenses booked to the order. Each part is also split by event.

export interface CostContext {
  items: MenuItem[];
  packages: MenuPackage[];
  slabs: Tenant["slabs"];
  recipes: RecipeLine[];
  ingredients: Ingredient[];
  vendors: Vendor[];
  outsourceOrders: OutsourceOrder[];
  /** Vendors' price lists: what extra services given to a vendor cost (0027) */
  vendorItems?: VendorItem[];
  tasks: { orderId: string; functionId: string; title: string; role: string; workerId?: string; qty: number; rate: number; amount: number }[];
  trips: { orderId: string; functionId: string; cost: number; driverName: string }[];
  challans: Challan[];
  assets: Asset[];
  expenses: { orderId?: string; category: string; amount: number; paidTo: string; note: string }[];
  /** Credit notes raised on the order, with GST */
  credited: number;
}

export interface MaterialLine { id: string; name: string; section: string; unit: string; qty: number; rate: number; amount: number }
export interface VendorLine { functionId: string; itemId: string; dish: string; vendor: string; qty: number; rate: number; amount: number; estimated: boolean }
export interface LabourLine { functionId: string; label: string; amount: number }
export interface OtherLine { functionId?: string; kind: "transport" | "rental" | "breakage" | "expense"; label: string; amount: number }

export interface EventCost {
  fn: EventFunction;
  revenue: number;
  material: number;
  vendors: number;
  labour: number;
  other: number;
  cost: number;
  profit: number;
}

export interface OrderCost {
  /** The bill before GST, less credit notes: what the order earns */
  revenue: number;
  gst: number;
  grand: number;
  material: MaterialLine[];
  vendors: VendorLine[];
  labour: LabourLine[];
  other: OtherLine[];
  totals: { material: number; vendors: number; labour: number; transport: number; rentals: number; expenses: number; cost: number };
  profit: number;
  margin: number;
  events: EventCost[];
  /** Staff the client is charged for, by the event charges */
  staffCharged: number;
  /** What the figures cannot see yet, for the caterer to fill in */
  gaps: { noRecipe: string[]; noRate: string[]; noAgencyRate: string[]; noLabour: boolean };
}

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

export function costOrder(o: Order, c: CostContext): OrderCost {
  const t = priceQuote(o, c.items, c.packages, c.slabs);
  const revenue = Math.max(0, t.taxable - c.credited / (1 + o.gstRate / 100));
  const ingOf = new Map(c.ingredients.map((i) => [i.id, i]));
  const itemOf = new Map(c.items.map((i) => [i.id, i]));
  const vendorName = (id?: string) => c.vendors.find((v) => v.id === id)?.name ?? "No vendor chosen";

  // Raw material, event by event, so the order's hand changes are shared out the same way the purchase list does.
  const materialByFn = new Map<string, number>();
  const lines = new Map<string, MaterialLine>();
  for (const fn of o.functions) {
    let fnTotal = 0;
    for (const [id, qty] of functionNeed(o, fn, c.items, c.recipes)) {
      const ing = ingOf.get(id);
      if (!ing) continue;
      const amount = qty * (ing.lastRate || 0);
      fnTotal += amount;
      const line = lines.get(id) ?? { id, name: ing.name, section: ing.section, unit: ing.unit, qty: 0, rate: ing.lastRate || 0, amount: 0 };
      line.qty += qty;
      line.amount += amount;
      lines.set(id, line);
    }
    materialByFn.set(fn.id, fnTotal);
  }
  const material = [...lines.values()].sort((a, b) => b.amount - a.amount);

  // Third-party food: the agency order's line when there is one, otherwise the menu at the agreed agency rate.
  const vendors: VendorLine[] = [];
  const live = c.outsourceOrders.filter((x) => x.orderId === o.id && x.status !== "cancelled");
  for (const fn of o.functions)
    for (const id of fn.itemIds) {
      const item = itemOf.get(id);
      if (!item?.outsourced) continue;
      const ordered = live.find((x) => x.functionId === fn.id && x.lines.some((l) => l.itemId === id));
      const line = ordered?.lines.find((l) => l.itemId === id);
      const qty = line ? line.qty : item.pricingType === "plate" ? dishGuests(fn, id) : 1;
      const rate = line ? line.agencyRate : item.agencyRate;
      vendors.push({ functionId: fn.id, itemId: id, dish: item.name, vendor: vendorName(ordered?.vendorId ?? item.agencyId), qty, rate, amount: qty * rate, estimated: !line });
    }

  // Extra lines given to a vendor (waiters, water, decoration): what the vendor is paid, from their price list.
  for (const fn of o.functions)
    for (const ch of fn.charges ?? []) {
      if (!ch.vendorId) continue;
      const r = vendorPrice(ch, c.vendorItems ?? [])?.rate ?? 0;
      vendors.push({ functionId: fn.id, itemId: ch.id, dish: ch.label || "Extra service", vendor: vendorName(ch.vendorId), qty: ch.qty, rate: r, amount: ch.qty * r, estimated: false });
    }

  const labour: LabourLine[] = c.tasks.filter((x) => x.orderId === o.id).map((x) => ({ functionId: x.functionId, label: [x.title || x.role, x.qty > 1 ? `${x.qty} × ${x.rate}` : ""].filter(Boolean).join(" · "), amount: x.amount }));

  const replace = new Map(c.assets.map((a) => [a.id, a.replacementCost]));
  const other: OtherLine[] = [
    ...c.trips.filter((x) => x.orderId === o.id && x.cost).map((x) => ({ functionId: x.functionId, kind: "transport" as const, label: `Transport${x.driverName ? ` · ${x.driverName}` : ""}`, amount: x.cost })),
    ...c.challans.filter((x) => x.orderId === o.id).flatMap((ch) => {
      const rent = sum(ch.lines.map((l) => l.rentalCost));
      const broken = sum(ch.lines.map((l) => (l.broken + l.missing) * (replace.get(l.assetId) ?? 0)));
      return [
        ...(rent ? [{ functionId: ch.functionId, kind: "rental" as const, label: `Cutlery hired · ${ch.number}`, amount: rent }] : []),
        ...(broken ? [{ functionId: ch.functionId, kind: "breakage" as const, label: `Broken or missing · ${ch.number}`, amount: broken }] : []),
      ];
    }),
    ...c.expenses.filter((x) => x.orderId === o.id).map((x) => ({ kind: "expense" as const, label: [x.category, x.paidTo, x.note].filter(Boolean).join(" · "), amount: x.amount })),
  ];

  const totals = {
    material: sum(material.map((l) => l.amount)),
    vendors: sum(vendors.map((l) => l.amount)),
    labour: sum(labour.map((l) => l.amount)),
    transport: sum(other.filter((l) => l.kind === "transport").map((l) => l.amount)),
    rentals: sum(other.filter((l) => l.kind === "rental" || l.kind === "breakage").map((l) => l.amount)),
    expenses: sum(other.filter((l) => l.kind === "expense").map((l) => l.amount)),
    cost: 0,
  };
  totals.cost = totals.material + totals.vendors + totals.labour + totals.transport + totals.rentals + totals.expenses;

  // Each event's share of the revenue follows its share of the bill before discount; costs booked to the whole order
  // (expenses) are shared the same way.
  const eventTotals = o.functions.map((fn) => priceFunction(fn, c.items, c.packages, c.slabs).eventTotal);
  const billed = sum(eventTotals) || 1;
  const events: EventCost[] = o.functions.map((fn, i) => {
    const share = eventTotals[i] / billed;
    const mat = materialByFn.get(fn.id) ?? 0;
    const ven = sum(vendors.filter((l) => l.functionId === fn.id).map((l) => l.amount));
    const lab = sum(labour.filter((l) => l.functionId === fn.id).map((l) => l.amount));
    const oth = sum(other.filter((l) => l.functionId === fn.id).map((l) => l.amount)) + totals.expenses * share;
    const cost = mat + ven + lab + oth;
    const rev = revenue * share;
    return { fn, revenue: rev, material: mat, vendors: ven, labour: lab, other: oth, cost, profit: rev - cost };
  });

  const used = new Set(o.functions.flatMap((f) => f.itemIds));
  const withRecipe = new Set(c.recipes.map((r) => r.itemId));
  const staffCharged = sum(o.functions.flatMap((f) => (f.charges ?? []).filter((x) => x.kind === "worker").map((x) => x.qty * x.rate)));
  return {
    revenue,
    gst: t.gst,
    grand: t.grand,
    material,
    vendors,
    labour,
    other,
    totals,
    profit: revenue - totals.cost,
    margin: revenue ? ((revenue - totals.cost) / revenue) * 100 : 0,
    events,
    staffCharged,
    gaps: {
      noRecipe: c.items.filter((i) => used.has(i.id) && !i.outsourced && !withRecipe.has(i.id)).map((i) => i.name),
      noRate: material.filter((l) => !l.rate).map((l) => l.name),
      noAgencyRate: [...new Set(vendors.filter((l) => !l.rate).map((l) => l.dish))],
      noLabour: labour.length === 0,
    },
  };
}
