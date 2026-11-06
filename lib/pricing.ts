import { lineage, pricedAtBooking, pricedBy, rootOf } from "./categories";
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

/** The per-plate dishes of one top-level category on a dish-by-dish event, priced as one line. */
export interface PlatePart {
  categoryId: string;
  itemIds: string[];
  /** The total of the dishes' prices for this booking */
  dishTotal: number;
  /** What the category is charged per plate: a price typed for it, or its dishes' total */
  perPlate: number;
  typed: boolean;
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
  /** The package price per plate used: this booking's own, or the package's */
  packagePrice: number;
  /** Dishes inside the package with a price typed on top of it for this booking */
  addOnIds: string[];
  /** Per-plate value of those add-ons */
  addOnPerPlate: number;
  /** Staff, cutlery and other charges of this event */
  charges: number;
  /** Food plus the event's charges: what this one event costs the client before discount and GST */
  eventTotal: number;
  /** The event is built dish by dish and has main course dishes, so it needs a main course rate */
  needsMainRate: boolean;
  /** The main course rate per plate counted in perPlate (0 when none is needed or typed) */
  mainRate: number;
  /** Built dish by dish: the per-plate dishes outside the main course, one part per top-level category */
  parts: PlatePart[];
}

export function slabPct(pax: number, slabs: Tenant["slabs"]) {
  for (const s of slabs) if (s.upTo === undefined || pax <= s.upTo) return s.pct;
  return 0;
}

/**
 * Each picked dish's menu price on this event, before any price typed for the booking. A dish in a category with one
 * price takes it: "each" is that price per dish; a set ("2 for ₹130") is charged per set of dishes picked from that
 * category on the event (1 or 2 pizzas ₹130, 3 or 4 ₹260), shared across them. Main course dishes are priced at booking.
 */
export function menuPrices(fn: Pick<EventFunction, "itemIds">, items: MenuItem[]) {
  const out = new Map<string, number>();
  const sets = new Map<string, { cat: { price?: number; priceSet?: number }; ids: string[] }>();
  for (const id of new Set(fn.itemIds)) {
    const i = items.find((x) => x.id === id);
    if (!i) continue;
    if (pricedAtBooking(i.categoryId)) { out.set(id, 0); continue; }
    const cat = pricedBy(i.categoryId);
    if (!cat) { out.set(id, i.price); continue; }
    if (!cat.priceSet || cat.priceSet <= 1) { out.set(id, cat.price ?? 0); continue; }
    const s = sets.get(cat.id) ?? { cat, ids: [] };
    s.ids.push(id);
    sets.set(cat.id, s);
  }
  for (const { cat, ids } of sets.values()) {
    const total = Math.ceil(ids.length / cat.priceSet!) * (cat.price ?? 0);
    for (const id of ids) out.set(id, total / ids.length);
  }
  return out;
}

/** A dish's price on this event: the price typed for the booking, else its menu price as above. */
export const eventPrice = (fn: Pick<EventFunction, "itemIds" | "itemPrices">, items: MenuItem[]) => {
  const menu = menuPrices(fn, items);
  return (i: Pick<MenuItem, "id" | "price">) => fn.itemPrices?.[i.id] ?? menu.get(i.id) ?? i.price;
};

export function priceFunction(
  fn: Pick<EventFunction, "pax" | "packageId" | "itemIds" | "itemPrices" | "charges" | "mainRate" | "packagePrice" | "categoryPrices">,
  items: MenuItem[],
  packages: MenuPackage[],
  slabs: Tenant["slabs"],
): FunctionPrice {
  // A price changed on this quotation or order wins over the menu price. Main course dishes have no menu price;
  // built dish by dish they are paid for by the main course rate (the sum of their typed prices, or typed whole).
  const menu = menuPrices(fn, items);
  const byId = new Map(items.map((i) => [i.id, fn.itemPrices?.[i.id] !== undefined ? { ...i, price: fn.itemPrices[i.id] } : menu.has(i.id) ? { ...i, price: menu.get(i.id)! } : i]));
  const picked = fn.itemIds.map((id) => byId.get(id)).filter((i): i is MenuItem => !!i);
  const plateItems = picked.filter((i) => i.pricingType === "plate");
  const fixed = picked.filter((i) => i.pricingType !== "plate").reduce((s, i) => s + i.price, 0);
  const pkg = packages.find((p) => p.id === fn.packageId);

  let basePlate = 0;
  let extraPerPlate = 0;
  let addOnPerPlate = 0;
  const rules: RuleProgress[] = [];
  const extraIds: string[] = [];
  const addOnIds: string[] = [];
  const parts: PlatePart[] = [];
  // Category prices typed for this booking; like the main course rate they stay as typed, with no guest-count discount.
  let typedPlate = 0;
  const packagePrice = pkg ? fn.packagePrice ?? pkg.pricePerPlate : 0;
  // A dish inside the package costs nothing extra, unless a price is typed on it for this booking: then it is added on top.
  const addOn = (id: string) => {
    const p = fn.itemPrices?.[id] ?? 0;
    if (p) {
      addOnPerPlate += p;
      addOnIds.push(id);
    }
  };

  if (pkg) {
    basePlate = packagePrice;
    const used = new Map<string, number>();
    for (const item of plateItems) {
      if (pkg.fixedItemIds.includes(item.id)) {
        addOn(item.id);
        continue;
      }
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
      } else addOn(item.id);
    }
    for (const r of pkg.rules) {
      const chosen = used.get(r.categoryId) ?? 0;
      rules.push({ categoryId: r.categoryId, choose: r.choose, chosen, met: chosen >= r.choose });
    }
    basePlate += extraPerPlate + addOnPerPlate;
  } else {
    for (const i of plateItems) {
      if (pricedAtBooking(i.categoryId)) continue;
      const root = rootOf(i.categoryId);
      let part = parts.find((x) => x.categoryId === root);
      if (!part) parts.push((part = { categoryId: root, itemIds: [], dishTotal: 0, perPlate: 0, typed: false }));
      part.itemIds.push(i.id);
      part.dishTotal += i.price;
    }
    for (const part of parts) {
      const typed = fn.categoryPrices?.[part.categoryId];
      part.typed = typed !== undefined;
      part.perPlate = typed ?? part.dishTotal;
      if (part.typed) typedPlate += part.perPlate;
      else basePlate += part.perPlate;
    }
  }

  // With a package its price covers the main course; built dish by dish, the typed rate is added per plate.
  const needsMainRate = !pkg && plateItems.some((i) => pricedAtBooking(i.categoryId));
  const mainRate = needsMainRate ? fn.mainRate ?? 0 : 0;
  const pct = slabPct(fn.pax, slabs);
  // The guest-count discount is for menu prices; the main course rate and category prices are typed for this
  // booking, so they stay as typed.
  const perPlate = Math.round(basePlate * (1 - pct / 100)) + typedPlate + mainRate;
  basePlate += typedPlate + mainRate;
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
    packagePrice,
    addOnIds,
    addOnPerPlate,
    charges: eventCharges(fn),
    eventTotal: perPlate * fn.pax + fixed + eventCharges(fn),
    needsMainRate,
    mainRate,
    parts,
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
