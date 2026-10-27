import { inBranch } from "./branch";
import { schema } from "./db";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Asset,
  Challan,
  ChallanLine,
  Ingredient,
  Movement,
  OutsourceOrder,
  PoLine,
  PurchaseOrder,
  RecipeLine,
  StoreLocation,
  Vendor,
  VendorBill,
  VendorPayment,
  VendorRate,
} from "./supply-types";

// Row mapping for the phase 3 tables (supabase/migrations/0003_supply.sql).

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come back untyped from PostgREST */
type Row = Record<string, any>;
type SB = SupabaseClient;
const day = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : "");
const t = <T extends Row>(row: T, tenantId?: string) => (tenantId ? { ...row, tenant_id: tenantId } : row);

export const ingredientRow = (i: Ingredient): Row => ({ id: i.id, name: i.name, unit: i.unit, section: i.section, reorder_level: i.reorderLevel, last_rate: i.lastRate, location: i.location, expires_on: i.expiresOn || null });
export const vendorRow = (v: Vendor): Row => ({ id: v.id, name: v.name, vendor_type: v.type, phone: v.phone, gstin: v.gstin, payment_terms: v.terms, rating: v.rating, notes: v.notes });
export const movementRow = (m: Movement): Row => ({ id: m.id, ingredient_id: m.ingredientId, store_id: m.storeId, movement: m.type, qty: m.qty, rate: m.rate ?? null, note: m.note, order_id: m.orderId ?? null, po_id: m.poId ?? null });
export const assetRow = (a: Asset): Row => ({ id: a.id, name: a.name, category: a.category, total_qty: a.totalQty, replacement_cost: a.replacementCost, ...(schema.charges ? { rent_rate: a.rentRate ?? 0 } : {}), location: a.location, rule_basis: a.ruleBasis, rule_value: a.ruleValue, rule_category_id: a.ruleCategoryId ?? null });
export const billRow = (b: VendorBill): Row => ({ id: b.id, vendor_id: b.vendorId, po_id: b.poId ?? null, outsource_id: b.outsourceId ?? null, bill_no: b.billNo, bill_date: b.date, amount: b.amount, note: b.note });
export const vendorPaymentRow = (p: VendorPayment): Row => ({ id: p.id, vendor_id: p.vendorId, amount: p.amount, mode: p.mode, paid_on: p.date, note: p.note });
export const poRow = (p: PurchaseOrder): Row => ({ id: p.id, number: p.number, vendor_id: p.vendorId, order_id: p.orderId ?? null, status: p.status, expected_on: p.expectedOn || null, deliver_time: p.deliverTime, deliver_place: p.deliverPlace, notes: p.notes });
export const poLineRow = (l: PoLine, poId: string): Row => ({ id: l.id, po_id: poId, ingredient_id: l.ingredientId, qty: l.qty, rate: l.rate, received_qty: l.receivedQty, received_rate: l.receivedRate, deliver_on: l.deliverOn || null, deliver_time: l.deliverTime, deliver_place: l.deliverPlace });
export const outsourceRow = (o: OutsourceOrder): Row => ({ id: o.id, number: o.number, order_id: o.orderId, function_id: o.functionId, vendor_id: o.vendorId, status: o.status, deliver_on: o.deliverOn || null, deliver_time: o.deliverTime, deliver_place: o.deliverPlace, contact: o.contact, notes: o.notes, on_time: o.onTime ?? null, issue: o.issue ?? null });
export const challanRow = (c: Challan): Row => ({ id: c.id, number: c.number, order_id: c.orderId, function_id: c.functionId, status: c.status, vehicle: c.vehicle, note: c.note, breakage_charged: c.breakageCharged });
export const challanLineRow = (l: ChallanLine, challanId: string): Row => ({ id: l.id, challan_id: challanId, asset_id: l.assetId, required: l.required, issued: l.issued, returned: l.returned, broken: l.broken, missing: l.missing, rented_qty: l.rentedQty, rental_vendor_id: l.rentalVendorId ?? null, rental_cost: l.rentalCost, rental_due: l.rentalDue || null, deliver_time: l.deliverTime, deliver_place: l.deliverPlace });

export async function ok(query: PromiseLike<{ error: { message: string } | null }>, what: string) {
  const { error } = await query;
  if (error) throw new Error(`${what}: ${error.message}`);
}

export async function insertPo(sb: SB, po: PurchaseOrder, tenantId?: string) {
  await ok(sb.from("purchase_orders").insert(t(poRow(po), tenantId)), "Saving the purchase order");
  if (po.lines.length) await ok(sb.from("po_lines").insert(po.lines.map((l) => t(poLineRow(l, po.id), tenantId))), "Saving purchase order lines");
}

export async function insertOutsource(sb: SB, o: OutsourceOrder, tenantId?: string) {
  await ok(sb.from("outsource_orders").insert(t(outsourceRow(o), tenantId)), "Saving the agency order");
  await ok(sb.from("outsource_lines").insert(o.lines.map((l) => t({ id: l.id, outsource_id: o.id, item_id: l.itemId, qty: l.qty, agency_rate: l.agencyRate, client_rate: l.clientRate }, tenantId))), "Saving agency order lines");
}

export async function insertChallan(sb: SB, c: Challan, tenantId?: string) {
  await ok(sb.from("challans").insert(t(challanRow(c), tenantId)), "Saving the challan");
  if (c.lines.length) await ok(sb.from("challan_lines").insert(c.lines.map((l) => t(challanLineRow(l, c.id), tenantId))), "Saving challan lines");
}

export interface SupplyData {
  ingredients: Ingredient[];
  recipes: RecipeLine[];
  stores: StoreLocation[];
  movements: Movement[];
  vendors: Vendor[];
  vendorRates: VendorRate[];
  purchaseOrders: PurchaseOrder[];
  bills: VendorBill[];
  vendorPayments: VendorPayment[];
  outsourceOrders: OutsourceOrder[];
  assets: Asset[];
  challans: Challan[];
}

export const emptySupply: SupplyData = { ingredients: [], recipes: [], stores: [], movements: [], vendors: [], vendorRates: [], purchaseOrders: [], bills: [], vendorPayments: [], outsourceOrders: [], assets: [], challans: [] };

export async function loadSupply(sb: SB): Promise<SupplyData> {
  const all = async (table: string, order?: string, ascending = true) => {
    const q = sb.from(table).select("*");
    const res = await (order ? q.order(order, { ascending }) : q).range(0, 9999);
    if (res.error) throw new Error(`Loading ${table}: ${res.error.message}`);
    return (res.data ?? []) as Row[];
  };
  const [ingredients, recipes, stores, movements, vendors, rates, pos, poLines, bills, pays, outs, outLines, assets, challans, challanLines] = await Promise.all([
    all("ingredients", "name"),
    all("recipe_lines"),
    all("stores", "created_at"),
    all("stock_movements", "created_at", false),
    all("vendors", "name"),
    all("vendor_rates"),
    all("purchase_orders", "created_at", false),
    all("po_lines"),
    all("vendor_bills", "bill_date", false),
    all("vendor_payments", "paid_on", false),
    all("outsource_orders", "created_at", false),
    all("outsource_lines"),
    all("assets", "name"),
    all("challans", "created_at", false),
    all("challan_lines"),
  ]);
  return {
    ingredients: ingredients.map((i) => ({ id: i.id, name: i.name, unit: i.unit, section: i.section, reorderLevel: Number(i.reorder_level), lastRate: Number(i.last_rate), location: i.location, expiresOn: i.expires_on ? day(i.expires_on) : undefined })),
    recipes: recipes.map((r) => ({ itemId: r.item_id, ingredientId: r.ingredient_id, qty: Number(r.qty) })),
    // A branch sees its own stores (and those with no branch), and only the stock movements in them.
    stores: stores.filter(inBranch).map((s) => ({ id: s.id, name: s.name })),
    movements: movements.filter((m) => stores.some((s) => s.id === m.store_id && inBranch(s))).map((m) => ({ id: m.id, ingredientId: m.ingredient_id, storeId: m.store_id, type: m.movement, qty: Number(m.qty), rate: m.rate === null ? undefined : Number(m.rate), note: m.note, orderId: m.order_id ?? undefined, poId: m.po_id ?? undefined, at: day(m.created_at) })),
    vendors: vendors.map((v) => ({ id: v.id, name: v.name, type: v.vendor_type, phone: v.phone, gstin: v.gstin, terms: v.payment_terms, rating: v.rating, notes: v.notes })),
    vendorRates: rates.map((r) => ({ vendorId: r.vendor_id, ingredientId: r.ingredient_id, rate: Number(r.rate) })),
    purchaseOrders: pos.map((p) => ({
      id: p.id, number: p.number, vendorId: p.vendor_id, orderId: p.order_id ?? undefined, status: p.status, expectedOn: day(p.expected_on), deliverTime: p.deliver_time, deliverPlace: p.deliver_place, notes: p.notes, createdAt: day(p.created_at),
      lines: poLines.filter((l) => l.po_id === p.id).map((l) => ({ id: l.id, ingredientId: l.ingredient_id, qty: Number(l.qty), rate: Number(l.rate), receivedQty: l.received_qty === null ? null : Number(l.received_qty), receivedRate: l.received_rate === null ? null : Number(l.received_rate), deliverOn: l.deliver_on ? day(l.deliver_on) : undefined, deliverTime: l.deliver_time, deliverPlace: l.deliver_place })),
    })),
    bills: bills.map((b) => ({ id: b.id, vendorId: b.vendor_id, poId: b.po_id ?? undefined, outsourceId: b.outsource_id ?? undefined, billNo: b.bill_no, date: day(b.bill_date), amount: Number(b.amount), note: b.note })),
    vendorPayments: pays.map((p) => ({ id: p.id, vendorId: p.vendor_id, amount: Number(p.amount), mode: p.mode, date: day(p.paid_on), note: p.note })),
    outsourceOrders: outs.map((o) => ({
      id: o.id, number: o.number, orderId: o.order_id, functionId: o.function_id ?? "", vendorId: o.vendor_id, status: o.status, deliverOn: day(o.deliver_on), deliverTime: o.deliver_time, deliverPlace: o.deliver_place, contact: o.contact, notes: o.notes, onTime: o.on_time ?? undefined, issue: o.issue ?? undefined,
      lines: outLines.filter((l) => l.outsource_id === o.id).map((l) => ({ id: l.id, itemId: l.item_id, qty: Number(l.qty), agencyRate: Number(l.agency_rate), clientRate: Number(l.client_rate) })),
    })),
    assets: assets.map((a) => ({ id: a.id, name: a.name, category: a.category, totalQty: a.total_qty, replacementCost: Number(a.replacement_cost), rentRate: Number(a.rent_rate ?? 0), location: a.location, ruleBasis: a.rule_basis, ruleValue: Number(a.rule_value), ruleCategoryId: a.rule_category_id ?? undefined })),
    challans: challans.map((c) => ({
      id: c.id, number: c.number, orderId: c.order_id, functionId: c.function_id ?? "", status: c.status, vehicle: c.vehicle, note: c.note, breakageCharged: c.breakage_charged,
      lines: challanLines.filter((l) => l.challan_id === c.id).map((l) => ({ id: l.id, assetId: l.asset_id, required: l.required, issued: l.issued, returned: l.returned, broken: l.broken, missing: l.missing, rentedQty: l.rented_qty, rentalVendorId: l.rental_vendor_id ?? undefined, rentalCost: Number(l.rental_cost), rentalDue: l.rental_due ? day(l.rental_due) : undefined, deliverTime: l.deliver_time, deliverPlace: l.deliver_place })),
    })),
  };
}
