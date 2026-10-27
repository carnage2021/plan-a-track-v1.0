import { lineage } from "./categories";
import type { Discount, EventCharge, EventFunction, ExtraCharge, MenuItem, MenuPackage, Tenant } from "./types";

/** One charge line's amount, kept to the paisa. */
export const chargeAmount = (c: Pick<EventCharge, "qty" | "rate">) => Math.round((c.qty || 0) * (c.rate || 0) * 100) / 100;
/** Staff, cutlery and other charges of one event. */
export const eventCharges = (f: Pick<EventFunction, "charges">) => (f.charges ?? []).reduce((s, c) => s + chargeAmount(c), 0);

export interface RuleProgress {
  categoryId: string;
  choose: number;
  chosen: number;
  met: boolean;
}

export interface FunctionPrice {
  /** Per-plate price before the pax slab */
  basePlate: number;
  slabPct: number;
  perPlate: number;
  /** Per-plate value of dishes picked beyond the package rules */
  extraPerPlate: number;
  /** Counters and flat-priced add-ons */
  fixed: number;
  total: number;
  costPerPlate: number;
  cost: number;
  rules: RuleProgress[];
  /** Dishes charged on top of the package price */
  extraIds: string[];
  /** Staff, cutlery and other charges of this event */
  charges: number;
  /** Food plus the event's charges: what this one event costs the client before discount and GST */
  eventTotal: number;
}

export function slabPct(pax: number, slabs: Tenant["slabs"]) {
  for (const s of slabs) if (s.upTo === undefined || pax <= s.upTo) return s.pct;
  return 0;
}

export function priceFunction(
  fn: Pick<EventFunction, "pax" | "packageId" | "itemIds" | "itemPrices" | "charges">,
  items: MenuItem[],
  packages: MenuPackage[],
  slabs: Tenant["slabs"],
): FunctionPrice {
  // A price changed on this quotation or order wins over the menu price.
  const byId = new Map(items.map((i) => [i.id, fn.itemPrices?.[i.id] !== undefined ? { ...i, price: fn.itemPrices[i.id] } : i]));
  const picked = fn.itemIds.map((id) => byId.get(id)).filter((i): i is MenuItem => !!i);
  const plateItems = picked.filter((i) => i.pricingType === "plate");
  const fixed = picked.filter((i) => i.pricingType !== "plate").reduce((s, i) => s + i.price, 0);
  const pkg = packages.find((p) => p.id === fn.packageId);

  let basePlate = 0;
  let extraPerPlate = 0;
  const rules: RuleProgress[] = [];
  const extraIds: string[] = [];

  if (pkg) {
    basePlate = pkg.pricePerPlate;
    const used = new Map<string, number>();
    for (const item of plateItems) {
      if (pkg.fixedItemIds.includes(item.id)) continue;
      // A dish fills the most specific package choice it belongs to (Paneer sabji before Main course),
      // moving up to a wider one when that is full; with no room left anywhere it is charged extra.
      const chain = lineage(item.categoryId);
      const fits = chain.map((id) => pkg.rules.find((r) => r.categoryId === id)).filter((r) => !!r);
      const rule = fits.find((r) => (used.get(r.categoryId) ?? 0) < r.choose);
      const counted = rule ?? fits[0];
      if (counted) used.set(counted.categoryId, (used.get(counted.categoryId) ?? 0) + 1);
      if (!rule) {
        extraPerPlate += item.price;
        extraIds.push(item.id);
      }
    }
    for (const r of pkg.rules) {
      const chosen = used.get(r.categoryId) ?? 0;
      rules.push({ categoryId: r.categoryId, choose: r.choose, chosen, met: chosen >= r.choose });
    }
    basePlate += extraPerPlate;
  } else {
    basePlate = plateItems.reduce((s, i) => s + i.price, 0);
  }

  const pct = slabPct(fn.pax, slabs);
  const perPlate = Math.round(basePlate * (1 - pct / 100));
  const costPerPlate = plateItems.reduce((s, i) => s + i.cost, 0);
  const fixedCost = picked.filter((i) => i.pricingType !== "plate").reduce((s, i) => s + i.cost, 0);

  return {
    basePlate,
    slabPct: pct,
    perPlate,
    extraPerPlate,
    fixed,
    total: perPlate * fn.pax + fixed,
    costPerPlate,
    cost: costPerPlate * fn.pax + fixedCost,
    rules,
    extraIds,
    charges: eventCharges(fn),
    eventTotal: perPlate * fn.pax + fixed + eventCharges(fn),
  };
}

export interface QuoteTotals {
  food: number;
  /** Charges on the events (staff, cutlery, other) */
  charges: number;
  /** Everything beyond food: the events' charges plus whole-booking charges */
  extras: number;
  subtotal: number;
  discount: number;
  discountPct: number;
  /** Referral credit taken off after the discount */
  credit: number;
  taxable: number;
  gst: number;
  grand: number;
  cost: number;
  /** Margin on food and extras after discount, before GST */
  marginPct: number;
  pax: number;
}

interface Priceable {
  functions: EventFunction[];
  extras: ExtraCharge[];
  discount: Discount;
  gstRate: number;
  gstInclusive: boolean;
  creditUsed?: number;
}

export function priceQuote(q: Priceable, items: MenuItem[], packages: MenuPackage[], slabs: Tenant["slabs"]): QuoteTotals {
  const fns = q.functions.map((f) => priceFunction(f, items, packages, slabs));
  const food = fns.reduce((s, f) => s + f.total, 0);
  const cost = fns.reduce((s, f) => s + f.cost, 0);
  const charges = fns.reduce((s, f) => s + f.charges, 0);
  const extras = charges + q.extras.reduce((s, e) => s + (e.amount || 0), 0);
  const subtotal = food + extras;
  const discount = Math.min(subtotal, q.discount.type === "percent" ? (subtotal * q.discount.value) / 100 : q.discount.value) || 0;
  const discountPct = subtotal ? (discount / subtotal) * 100 : 0;
  const credit = Math.min(subtotal - discount, q.creditUsed ?? 0) || 0;
  const afterDiscount = subtotal - discount - credit;
  // Inclusive pricing: the quoted figure already contains GST, so back it out.
  const taxable = q.gstInclusive ? afterDiscount / (1 + q.gstRate / 100) : afterDiscount;
  const gst = (taxable * q.gstRate) / 100;
  const grand = Math.round(taxable + gst);
  return {
    food,
    charges,
    extras,
    subtotal,
    discount,
    discountPct,
    credit,
    taxable,
    gst,
    grand,
    cost,
    marginPct: taxable ? ((taxable - cost) / taxable) * 100 : 0,
    pax: q.functions.reduce((s, f) => s + f.pax, 0),
  };
}

export function marginTone(pct: number): "success" | "warning" | "danger" {
  if (pct >= 45) return "success";
  if (pct >= 30) return "warning";
  return "danger";
}

export function paidAmount(payments: { amount: number }[]) {
  return payments.reduce((s, p) => s + p.amount, 0);
}
