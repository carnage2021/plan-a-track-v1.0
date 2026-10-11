import type { Discount, EventFunction, ExtraCharge, MenuItem, MenuPackage, Tenant } from "./types";

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
}

export function slabPct(pax: number, slabs: Tenant["slabs"]) {
  for (const s of slabs) if (s.upTo === undefined || pax <= s.upTo) return s.pct;
  return 0;
}

export function priceFunction(
  fn: Pick<EventFunction, "pax" | "packageId" | "itemIds">,
  items: MenuItem[],
  packages: MenuPackage[],
  slabs: Tenant["slabs"],
): FunctionPrice {
  const byId = new Map(items.map((i) => [i.id, i]));
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
    const allowance = new Map(pkg.rules.map((r) => [r.categoryId, r.choose]));
    const used = new Map<string, number>();
    for (const item of plateItems) {
      if (pkg.fixedItemIds.includes(item.id)) continue;
      const allowed = allowance.get(item.categoryId) ?? 0;
      const count = used.get(item.categoryId) ?? 0;
      used.set(item.categoryId, count + 1);
      // The first picks in a category are covered by the package; anything beyond is charged.
      if (count >= allowed) {
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
  };
}

export interface QuoteTotals {
  food: number;
  extras: number;
  subtotal: number;
  discount: number;
  discountPct: number;
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
}

export function priceQuote(q: Priceable, items: MenuItem[], packages: MenuPackage[], slabs: Tenant["slabs"]): QuoteTotals {
  const fns = q.functions.map((f) => priceFunction(f, items, packages, slabs));
  const food = fns.reduce((s, f) => s + f.total, 0);
  const cost = fns.reduce((s, f) => s + f.cost, 0);
  const extras = q.extras.reduce((s, e) => s + (e.amount || 0), 0);
  const subtotal = food + extras;
  const discount = Math.min(subtotal, q.discount.type === "percent" ? (subtotal * q.discount.value) / 100 : q.discount.value) || 0;
  const discountPct = subtotal ? (discount / subtotal) * 100 : 0;
  const afterDiscount = subtotal - discount;
  // Inclusive pricing: the quoted figure already contains GST, so back it out.
  const taxable = q.gstInclusive ? afterDiscount / (1 + q.gstRate / 100) : afterDiscount;
  const gst = (taxable * q.gstRate) / 100;
  const grand = Math.round(taxable + gst);
  return {
    food,
    extras,
    subtotal,
    discount,
    discountPct,
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
