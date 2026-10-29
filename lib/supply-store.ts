"use client";

import { toast } from "sonner";
import { create } from "zustand";
import { schema } from "./db";
import { background, write } from "./queue";
import { useStore } from "./store";
import { assetRequirement, recipeCost } from "./supply";
import {
  assetRow,
  billRow,
  challanLineRow,
  challanRow,
  emptySupply,
  ingredientRow,
  insertChallan,
  insertOutsource,
  insertPo,
  loadSupply,
  movementRow,
  ok,
  outsourceRow,
  poLineRow,
  vendorPaymentRow,
  vendorRow,
  type SupplyData,
} from "./supply-db";
import type { Asset, Challan, Ingredient, Movement, OutsourceOrder, PoStatus, PurchaseOrder, RecipeLine, Vendor, VendorBill, VendorPayment } from "./supply-types";
import { supabase } from "./supabase/client";
import { financialYear, isoDate, uid } from "./utils";
import { withBranch } from "./branch";

// Phase 3 data (recipes, stock, vendors, agency orders, cutlery). Same pattern as lib/store.ts:
// loaded after sign-in, changed on screen at once, written to Supabase behind it.

export interface PoDraft {
  vendorId: string;
  orderId?: string;
  expectedOn: string;
  deliverTime: string;
  deliverPlace: string;
  lines: { ingredientId: string; qty: number; rate: number }[];
}

interface Actions {
  /** False until supabase/migrations/0003_supply.sql has been run on the project. */
  ready: boolean;
  load: () => Promise<void>;
  loadStarter: () => Promise<void>;
  addStore: (name: string) => void;
  saveIngredient: (ingredient: Omit<Ingredient, "id"> & { id?: string }, openingQty?: number) => void;
  addMovement: (movement: Omit<Movement, "id" | "at">) => void;
  transfer: (ingredientId: string, from: string, to: string, qty: number) => void;
  stockTake: (storeId: string, counted: Record<string, number>) => number;
  saveRecipe: (itemId: string, lines: { ingredientId: string; qty: number }[], recipeBase: number, bufferPct: number) => void;
  saveVendor: (vendor: Omit<Vendor, "id"> & { id?: string }) => string;
  setVendorRate: (vendorId: string, ingredientId: string, rate: number | null) => void;
  createPos: (drafts: PoDraft[]) => Promise<PurchaseOrder[]>;
  setPoStatus: (id: string, status: PoStatus) => void;
  receivePo: (id: string, storeId: string, received: Record<string, { qty: number; rate: number }>) => void;
  addBill: (bill: Omit<VendorBill, "id">) => void;
  addVendorPayment: (payment: Omit<VendorPayment, "id">) => void;
  draftOutsource: (orderId: string) => Promise<number>;
  patchOutsource: (id: string, patch: Partial<OutsourceOrder>) => void;
  saveAsset: (asset: Omit<Asset, "id"> & { id?: string }) => void;
  createChallan: (orderId: string, functionId: string) => Promise<string>;
  saveChallan: (challan: Challan) => void;
  chargeBreakage: (challanId: string, amount: number) => void;
}

export type SupplyStore = SupplyData & Actions;

const today = () => isoDate(new Date());
const docNo = (prefix: string, n: number) => `${prefix}/${financialYear()}/${String(n).padStart(4, "0")}`;
async function nextNumber(docType: string) {
  const res = await supabase().rpc("next_doc_number", { p_doc_type: docType, p_financial_year: financialYear() });
  if (res.error) throw new Error(res.error.message);
  return res.data as number;
}

/** "19:00" -> "18:00"; never before midnight. */
const hourBefore = (t: string) => { const [h, m] = (t || "12:00").split(":").map(Number); return `${String(Math.max(0, h - 1)).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}`; };

export const useSupply = create<SupplyStore>()((set, get) => {
  /** Dish costs follow ingredient rates: recompute and save any dish whose recipe uses these ingredients. */
  const recost = (ingredientIds: string[]) => {
    const { recipes, ingredients } = get();
    const main = useStore.getState();
    const affected = new Set(recipes.filter((r) => ingredientIds.includes(r.ingredientId)).map((r) => r.itemId));
    for (const item of main.items) {
      if (!affected.has(item.id)) continue;
      const cost = recipeCost(item, recipes, ingredients);
      if (cost !== null && Math.abs(cost - item.cost) >= 0.01) main.saveItem({ ...item, cost: Math.round(cost * 100) / 100 });
    }
  };

  return {
    ...emptySupply,
    ready: false,

    load: async () => {
      if (!schema.supply) {
        set({ ...emptySupply, ready: false });
        return;
      }
      try {
        set({ ...(await loadSupply(supabase())), ready: true });
        // Stock always lives in a store, so an account with none gets a first one.
        const role = useStore.getState().myRole;
        if (get().stores.length === 0 && (role === "owner" || role === "store")) get().addStore("Main kitchen");
      } catch (e) {
        toast.error("Could not load stock and vendors", { description: e instanceof Error ? e.message : undefined });
      }
    },

    loadStarter: async () => {
      const { data } = await supabase().auth.getSession();
      const res = await fetch("/api/starter-supply", { method: "POST", headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` } });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Could not load the starter data.");
      // Dish costs and agency mapping changed too, so reload everything.
      await useStore.getState().reload();
    },

    addStore: (name) => {
      const store = { id: uid(), name: name.trim() };
      set((s) => ({ stores: [...s.stores, store] }));
      background((sb) => ok(sb.from("stores").insert(withBranch(store)), "Saving the store"));
    },

    saveIngredient: (ingredient, openingQty) => {
      const saved: Ingredient = { ...ingredient, id: ingredient.id ?? uid() };
      const rateChanged = get().ingredients.find((i) => i.id === saved.id)?.lastRate !== saved.lastRate;
      set((s) => ({ ingredients: ingredient.id ? s.ingredients.map((i) => (i.id === saved.id ? saved : i)) : [...s.ingredients, saved].sort((a, b) => a.name.localeCompare(b.name)) }));
      background((sb) => ok(sb.from("ingredients").upsert(ingredientRow(saved)), "Saving the ingredient"));
      if (!ingredient.id && openingQty && get().stores[0]) get().addMovement({ ingredientId: saved.id, storeId: get().stores[0].id, type: "opening", qty: openingQty, rate: saved.lastRate, note: "Opening stock" });
      if (ingredient.id && rateChanged) recost([saved.id]);
    },

    addMovement: (movement) => {
      const saved: Movement = { ...movement, id: uid(), at: today() };
      set((s) => ({ movements: [saved, ...s.movements] }));
      background((sb) => ok(sb.from("stock_movements").insert(movementRow(saved)), "Saving the stock entry"));
    },

    transfer: (ingredientId, from, to, qty) => {
      const name = (id: string) => get().stores.find((s) => s.id === id)?.name ?? "";
      get().addMovement({ ingredientId, storeId: from, type: "transfer", qty: -qty, note: `To ${name(to)}` });
      get().addMovement({ ingredientId, storeId: to, type: "transfer", qty, note: `From ${name(from)}` });
    },

    stockTake: (storeId, counted) => {
      const current = new Map<string, number>();
      for (const m of get().movements) if (m.storeId === storeId) current.set(m.ingredientId, (current.get(m.ingredientId) ?? 0) + m.qty);
      let changed = 0;
      for (const [ingredientId, count] of Object.entries(counted)) {
        const diff = count - (current.get(ingredientId) ?? 0);
        if (Math.abs(diff) < 0.001) continue;
        changed++;
        get().addMovement({ ingredientId, storeId, type: "adjustment", qty: diff, note: `Stock-take: counted ${count}` });
      }
      return changed;
    },

    saveRecipe: (itemId, lines, recipeBase, bufferPct) => {
      const clean: RecipeLine[] = lines.filter((l) => l.ingredientId && l.qty > 0).map((l) => ({ itemId, ...l }));
      set((s) => ({ recipes: [...s.recipes.filter((r) => r.itemId !== itemId), ...clean] }));
      background(async (sb) => {
        await ok(sb.from("recipe_lines").delete().eq("item_id", itemId), "Saving the recipe");
        if (clean.length) await ok(sb.from("recipe_lines").insert(clean.map((l) => ({ item_id: l.itemId, ingredient_id: l.ingredientId, qty: l.qty }))), "Saving the recipe");
      });
      const main = useStore.getState();
      const item = main.items.find((i) => i.id === itemId);
      if (!item) return;
      const cost = recipeCost({ id: itemId, recipeBase }, get().recipes, get().ingredients);
      main.saveItem({ ...item, recipeBase, bufferPct, cost: cost === null ? item.cost : Math.round(cost * 100) / 100 });
    },

    saveVendor: (vendor) => {
      const saved: Vendor = { ...vendor, id: vendor.id ?? uid() };
      set((s) => ({ vendors: vendor.id ? s.vendors.map((v) => (v.id === saved.id ? saved : v)) : [...s.vendors, saved].sort((a, b) => a.name.localeCompare(b.name)) }));
      background((sb) => ok(sb.from("vendors").upsert(vendorRow(saved)), "Saving the vendor"));
      return saved.id;
    },

    setVendorRate: (vendorId, ingredientId, rate) => {
      set((s) => ({ vendorRates: [...s.vendorRates.filter((r) => !(r.vendorId === vendorId && r.ingredientId === ingredientId)), ...(rate ? [{ vendorId, ingredientId, rate }] : [])] }));
      background((sb) =>
        rate
          ? ok(sb.from("vendor_rates").upsert({ vendor_id: vendorId, ingredient_id: ingredientId, rate }), "Saving the rate")
          : ok(sb.from("vendor_rates").delete().eq("vendor_id", vendorId).eq("ingredient_id", ingredientId), "Removing the rate"),
      );
    },

    createPos: async (drafts) => {
      const created = await write(async (sb) => {
        const list: PurchaseOrder[] = [];
        for (const d of drafts) {
          const po: PurchaseOrder = {
            id: uid(),
            number: docNo("PO", await nextNumber("po")),
            vendorId: d.vendorId,
            orderId: d.orderId,
            status: "draft",
            expectedOn: d.expectedOn,
            deliverTime: d.deliverTime,
            deliverPlace: d.deliverPlace,
            notes: "",
            createdAt: today(),
            lines: d.lines.map((l) => ({ id: uid(), ...l, receivedQty: null, receivedRate: null, deliverOn: d.expectedOn, deliverTime: d.deliverTime, deliverPlace: d.deliverPlace })),
          };
          await insertPo(sb, po);
          list.push(po);
        }
        return list;
      });
      set((s) => ({ purchaseOrders: [...created, ...s.purchaseOrders] }));
      return created;
    },

    setPoStatus: (id, status) => {
      set((s) => ({ purchaseOrders: s.purchaseOrders.map((p) => (p.id === id ? { ...p, status } : p)) }));
      background((sb) => ok(sb.from("purchase_orders").update({ status }).eq("id", id), "Updating the purchase order"));
    },

    receivePo: (id, storeId, received) => {
      const po = get().purchaseOrders.find((p) => p.id === id);
      if (!po) return;
      const lines = po.lines.map((l) => (received[l.id] ? { ...l, receivedQty: (l.receivedQty ?? 0) + received[l.id].qty, receivedRate: received[l.id].rate } : l));
      const status: PoStatus = lines.every((l) => (l.receivedQty ?? 0) >= l.qty) ? "received" : "partial";
      set((s) => ({ purchaseOrders: s.purchaseOrders.map((p) => (p.id === id ? { ...p, lines, status } : p)) }));
      background(async (sb) => {
        await ok(sb.from("po_lines").upsert(lines.filter((l) => received[l.id]).map((l) => poLineRow(l, id))), "Saving goods received");
        await ok(sb.from("purchase_orders").update({ status }).eq("id", id), "Updating the purchase order");
      });
      const changedRates: string[] = [];
      for (const l of po.lines) {
        const r = received[l.id];
        if (!r || r.qty <= 0) continue;
        get().addMovement({ ingredientId: l.ingredientId, storeId, type: "purchase", qty: r.qty, rate: r.rate, note: po.number, poId: id, orderId: po.orderId });
        const ingredient = get().ingredients.find((i) => i.id === l.ingredientId);
        if (ingredient && r.rate > 0 && ingredient.lastRate !== r.rate) {
          const updated = { ...ingredient, lastRate: r.rate };
          set((s) => ({ ingredients: s.ingredients.map((i) => (i.id === updated.id ? updated : i)) }));
          background((sb) => ok(sb.from("ingredients").update({ last_rate: r.rate }).eq("id", updated.id), "Updating the rate"));
          changedRates.push(updated.id);
        }
      }
      if (changedRates.length) recost(changedRates);
    },

    addBill: (bill) => {
      const saved = { ...bill, id: uid() };
      set((s) => ({ bills: [saved, ...s.bills] }));
      background((sb) => ok(sb.from("vendor_bills").insert(billRow(saved)), "Saving the bill"));
    },
    addVendorPayment: (payment) => {
      const saved = { ...payment, id: uid() };
      set((s) => ({ vendorPayments: [saved, ...s.vendorPayments] }));
      background((sb) => ok(sb.from("vendor_payments").insert(vendorPaymentRow(saved)), "Saving the payment"));
    },

    draftOutsource: async (orderId) => {
      if (!get().ready) return 0;
      const main = useStore.getState();
      const order = main.orders.find((o) => o.id === orderId);
      if (!order) return 0;
      const drafts: Omit<OutsourceOrder, "number">[] = [];
      for (const fn of order.functions) {
        const byVendor = new Map<string, typeof main.items>();
        for (const item of main.items) if (fn.itemIds.includes(item.id) && item.outsourced && item.agencyId) byVendor.set(item.agencyId, [...(byVendor.get(item.agencyId) ?? []), item]);
        const manager = main.users.find((u) => u.id === order.managerId);
        for (const [vendorId, dishes] of byVendor) {
          // One agency order per function and agency; never a second one while the first is live.
          if (get().outsourceOrders.some((o) => o.functionId === fn.id && o.vendorId === vendorId && o.status !== "cancelled")) continue;
          drafts.push({
            // Delivered an hour before the service starts (the same day; just after midnight stays at 00:00), and the
            // vendor sees only the event name, never the client: the client is the caterer's own.
            id: uid(), orderId, functionId: fn.id, vendorId, status: "draft", deliverOn: fn.date, deliverTime: hourBefore(fn.time), deliverPlace: fn.venue,
            contact: [manager?.name, manager?.phone].filter(Boolean).join(", "), notes: fn.name,
            lines: dishes.map((d) => ({ id: uid(), itemId: d.id, qty: d.pricingType === "plate" ? fn.pax : 1, agencyRate: d.agencyRate, clientRate: d.price })),
          });
        }
      }
      if (!drafts.length) return 0;
      const created = await write(async (sb) => {
        const list: OutsourceOrder[] = [];
        for (const d of drafts) {
          const o = { ...d, number: docNo("OS", await nextNumber("outsource")) };
          await insertOutsource(sb, o);
          list.push(o);
        }
        return list;
      });
      set((s) => ({ outsourceOrders: [...created, ...s.outsourceOrders] }));
      return created.length;
    },

    patchOutsource: (id, patch) => {
      set((s) => ({ outsourceOrders: s.outsourceOrders.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));
      const saved = get().outsourceOrders.find((o) => o.id === id);
      if (!saved) return;
      background(async (sb) => {
        await ok(sb.from("outsource_orders").update(outsourceRow(saved)).eq("id", id), "Updating the agency order");
        if (patch.lines) await ok(sb.from("outsource_lines").upsert(saved.lines.map((l) => ({ id: l.id, outsource_id: id, item_id: l.itemId, qty: l.qty, agency_rate: l.agencyRate, client_rate: l.clientRate }))), "Updating agency rates");
      });
    },

    saveAsset: (asset) => {
      const saved: Asset = { ...asset, id: asset.id ?? uid() };
      set((s) => ({ assets: asset.id ? s.assets.map((a) => (a.id === saved.id ? saved : a)) : [...s.assets, saved].sort((a, b) => a.name.localeCompare(b.name)) }));
      background((sb) => ok(sb.from("assets").upsert(assetRow(saved)), "Saving the item"));
    },

    createChallan: async (orderId, functionId) => {
      const main = useStore.getState();
      const fn = main.orders.find((o) => o.id === orderId)?.functions.find((f) => f.id === functionId);
      if (!fn) throw new Error("That function no longer exists.");
      const lines = get()
        .assets.map((a) => ({ a, required: assetRequirement(a, fn, main.items) }))
        .filter((x) => x.required > 0)
        .map(({ a, required }) => ({ id: uid(), assetId: a.id, required, issued: 0, returned: 0, broken: 0, missing: 0, rentedQty: 0, rentalCost: 0, deliverTime: fn.time, deliverPlace: fn.venue }));
      const challan = await write(async (sb) => {
        const c: Challan = { id: uid(), number: docNo("CH", await nextNumber("challan")), orderId, functionId, status: "draft", vehicle: "", note: "", breakageCharged: false, lines };
        await insertChallan(sb, c);
        return c;
      });
      set((s) => ({ challans: [challan, ...s.challans] }));
      return challan.id;
    },

    saveChallan: (challan) => {
      const before = get().challans.find((c) => c.id === challan.id);
      set((s) => ({ challans: s.challans.map((c) => (c.id === challan.id ? challan : c)) }));
      const removed = (before?.lines ?? []).filter((l) => !challan.lines.some((x) => x.id === l.id)).map((l) => l.id);
      background(async (sb) => {
        const stamps = { ...(challan.status !== "draft" && before?.status === "draft" ? { issued_at: new Date().toISOString() } : {}), ...(challan.status === "returned" && before?.status !== "returned" ? { returned_at: new Date().toISOString() } : {}) };
        await ok(sb.from("challans").update({ ...challanRow(challan), ...stamps }).eq("id", challan.id), "Saving the challan");
        if (removed.length) await ok(sb.from("challan_lines").delete().in("id", removed), "Saving the challan");
        if (challan.lines.length) await ok(sb.from("challan_lines").upsert(challan.lines.map((l) => challanLineRow(l, challan.id))), "Saving the challan");
      });
    },

    chargeBreakage: (challanId, amount) => {
      const challan = get().challans.find((c) => c.id === challanId);
      if (!challan || amount <= 0) return;
      useStore.getState().addOrderExtra(challan.orderId, `Breakage and loss (${challan.number})`, amount);
      get().saveChallan({ ...challan, breakageCharged: true });
    },
  };
});
