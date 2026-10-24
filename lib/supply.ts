import type { Asset, Challan, Ingredient, Movement, OutsourceOrder, PurchaseOrder, RecipeLine, VendorBill, VendorPayment, VendorRate } from "./supply-types";
import type { EventFunction, MenuItem, Order } from "./types";

// Pure calculations for the supply side: scaling recipes, stock, vendor choice and cutlery counts.

/** Rounds a quantity up to something a store keeper would actually weigh out. */
export function roundQty(qty: number, unit: string) {
  const step = unit === "pcs" || unit === "dozen" || unit === "packet" || unit === "bunch" ? 1 : qty < 1 ? 0.05 : qty < 10 ? 0.1 : 0.5;
  return Math.ceil(qty / step - 1e-9) * step;
}

export const fmtQty = (qty: number) => (Number.isInteger(qty) ? String(qty) : qty.toFixed(qty < 1 ? 2 : 1).replace(/\.?0+$/, ""));

/** Raw material for a set of functions: each dish's recipe scaled to the guests, plus its wastage buffer. */
export function requirementFor(functions: Pick<EventFunction, "pax" | "itemIds">[], items: MenuItem[], recipes: RecipeLine[]) {
  const byItem = new Map<string, RecipeLine[]>();
  for (const r of recipes) byItem.set(r.itemId, [...(byItem.get(r.itemId) ?? []), r]);
  const itemOf = new Map(items.map((i) => [i.id, i]));
  const need = new Map<string, number>();
  for (const fn of functions)
    for (const id of fn.itemIds) {
      const item = itemOf.get(id);
      // Outsourced dishes arrive ready, so they need no raw material from our store.
      if (!item || item.outsourced) continue;
      const scale = (fn.pax / (item.recipeBase || 100)) * (1 + (item.bufferPct || 0) / 100);
      for (const line of byItem.get(id) ?? []) need.set(line.ingredientId, (need.get(line.ingredientId) ?? 0) + line.qty * scale);
    }
  return need;
}

/**
 * An order's raw material with its hand changes applied: an overridden quantity replaces the recipe's,
 * 0 removes the ingredient, and an ingredient no recipe uses is added.
 */
export function withOverrides(need: Map<string, number>, overrides?: Record<string, number>) {
  if (!overrides) return need;
  const out = new Map(need);
  for (const [id, qty] of Object.entries(overrides)) {
    if (qty > 0) out.set(id, qty);
    else out.delete(id);
  }
  return out;
}

/**
 * One function's share of an order's raw material. Changes are made for the whole order, so each function
 * takes the same proportion of a changed quantity as it had of the recipe's; an added ingredient is split
 * by guests.
 */
export function functionNeed(order: Pick<Order, "functions" | "rawOverrides">, fn: Pick<EventFunction, "id" | "pax" | "itemIds">, items: MenuItem[], recipes: RecipeLine[]) {
  const own = requirementFor([fn], items, recipes);
  if (!order.rawOverrides) return own;
  const all = requirementFor(order.functions, items, recipes);
  const guests = order.functions.reduce((s, f) => s + f.pax, 0) || 1;
  for (const [id, qty] of Object.entries(order.rawOverrides)) {
    const total = all.get(id) ?? 0;
    const share = total > 0 ? (own.get(id) ?? 0) / total : fn.pax / guests;
    if (qty > 0 && share > 0) own.set(id, qty * share);
    else own.delete(id);
  }
  return own;
}

/** In-house dishes on these functions that have no recipe yet, so their raw material is not counted. */
export function missingRecipes(functions: Pick<EventFunction, "itemIds">[], items: MenuItem[], recipes: RecipeLine[]) {
  const has = new Set(recipes.map((r) => r.itemId));
  const ids = new Set(functions.flatMap((f) => f.itemIds));
  return items.filter((i) => ids.has(i.id) && !i.outsourced && !has.has(i.id));
}

/** Food cost of one plate (or one counter) from the latest ingredient rates. */
export function recipeCost(item: Pick<MenuItem, "id" | "recipeBase">, recipes: RecipeLine[], ingredients: Ingredient[]) {
  const rate = new Map(ingredients.map((i) => [i.id, i.lastRate]));
  const lines = recipes.filter((r) => r.itemId === item.id);
  if (!lines.length) return null;
  return lines.reduce((s, l) => s + l.qty * (rate.get(l.ingredientId) ?? 0), 0) / (item.recipeBase || 100);
}

export function stockBy(movements: Movement[], storeId?: string) {
  const stock = new Map<string, number>();
  for (const m of movements) if (!storeId || m.storeId === storeId) stock.set(m.ingredientId, (stock.get(m.ingredientId) ?? 0) + m.qty);
  return stock;
}

/** Quantity already on purchase orders that have not fully arrived. */
export function onOrder(pos: PurchaseOrder[]) {
  const pending = new Map<string, number>();
  for (const po of pos)
    if (po.status === "sent" || po.status === "partial" || po.status === "draft")
      for (const l of po.lines) pending.set(l.ingredientId, (pending.get(l.ingredientId) ?? 0) + Math.max(0, l.qty - (l.receivedQty ?? 0)));
  return pending;
}

/** Vendors that supply an ingredient, cheapest first. */
export function vendorsFor(ingredientId: string, rates: VendorRate[]) {
  return rates.filter((r) => r.ingredientId === ingredientId).sort((a, b) => a.rate - b.rate);
}

export function poTotal(po: PurchaseOrder) {
  return po.lines.reduce((s, l) => s + (l.receivedQty ?? l.qty) * (l.receivedRate ?? l.rate), 0);
}

export function outsourceTotals(o: OutsourceOrder) {
  const cost = o.lines.reduce((s, l) => s + l.qty * l.agencyRate, 0);
  const revenue = o.lines.reduce((s, l) => s + l.qty * l.clientRate, 0);
  return { cost, revenue, margin: revenue - cost, marginPct: revenue ? ((revenue - cost) / revenue) * 100 : 0 };
}

export function vendorBalance(vendorId: string, bills: VendorBill[], payments: VendorPayment[]) {
  const billed = bills.filter((b) => b.vendorId === vendorId).reduce((s, b) => s + b.amount, 0);
  const paid = payments.filter((p) => p.vendorId === vendorId).reduce((s, p) => s + p.amount, 0);
  return { billed, paid, balance: billed - paid };
}

/** On-time share of an agency's delivered orders, as a score out of 100. */
export function agencyScore(vendorId: string, orders: OutsourceOrder[]) {
  const done = orders.filter((o) => o.vendorId === vendorId && o.status === "delivered");
  if (!done.length) return null;
  const good = done.filter((o) => o.onTime !== false && !o.issue).length;
  return { score: Math.round((good / done.length) * 100), delivered: done.length, issues: done.filter((o) => o.issue).length };
}

/** How many of an asset a function needs, from the asset's rule. */
export function assetRequirement(asset: Asset, fn: Pick<EventFunction, "pax" | "itemIds">, items: MenuItem[]) {
  if (asset.ruleBasis === "per_guest") return Math.ceil(fn.pax * asset.ruleValue);
  if (asset.ruleBasis === "per_function") return Math.ceil(asset.ruleValue);
  if (asset.ruleBasis === "per_dish") {
    const dishes = items.filter((i) => fn.itemIds.includes(i.id) && (!asset.ruleCategoryId || i.categoryId === asset.ruleCategoryId)).length;
    return Math.ceil(dishes * asset.ruleValue);
  }
  return 0;
}

/** Own stock of an asset already promised to other functions on the same date and not yet back. */
export function assetCommitted(assetId: string, date: string, challans: Challan[], orders: Order[], exceptChallanId?: string) {
  const dateOf = new Map(orders.flatMap((o) => o.functions.map((f) => [f.id, f.date] as const)));
  return challans
    .filter((c) => c.id !== exceptChallanId && c.status !== "returned" && dateOf.get(c.functionId) === date)
    .flatMap((c) => c.lines)
    .filter((l) => l.assetId === assetId)
    .reduce((s, l) => s + Math.max(0, (l.issued || l.required) - l.rentedQty), 0);
}

export function challanLoss(challan: Challan, assets: Asset[]) {
  const cost = new Map(assets.map((a) => [a.id, a.replacementCost]));
  return challan.lines.reduce((s, l) => s + (l.broken + l.missing) * (cost.get(l.assetId) ?? 0), 0);
}
