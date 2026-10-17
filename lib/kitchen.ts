"use client";

import { create } from "zustand";
import { background } from "./queue";
import { supabase } from "./supabase/client";
import type { MenuItem } from "./types";

// Kitchen production: one row per dish per function (supabase/migrations/0005_kitchen.sql).

export type DishStatus = "pending" | "prep" | "cooking" | "ready" | "packed";
export const dishFlow: DishStatus[] = ["pending", "prep", "cooking", "ready", "packed"];
export const dishLabel: Record<DishStatus, string> = { pending: "Pending", prep: "Prep", cooking: "Cooking", ready: "Ready", packed: "Packed" };

export interface KitchenRow { status: DishStatus; leftover: number }
export const kitchenKey = (functionId: string, itemId: string) => `${functionId}:${itemId}`;

/**
 * How long before serving each kind of dish must be ready to pack, in minutes. Sweets are made
 * the earliest; breads and live counters the latest. The prep timeline works backwards from these.
 */
const leadByCategory: Record<string, number> = {
  "Welcome drinks": 60, Starters: 90, "Chaat and live counters": 45, "Main course": 150, Breads: 45, Rice: 120, Sweets: 300, "Dessert counters": 60, Accompaniments: 60,
};
export const leadMinutes = (categoryName = "") => leadByCategory[categoryName] ?? 120;

/** The time a dish should be ready, as minutes after midnight, from the earliest serving time it is needed for. */
export function readyBy(servingTime: string, categoryName?: string) {
  const [h, m] = (servingTime || "19:00").split(":").map(Number);
  return h * 60 + m - leadMinutes(categoryName);
}
export const clock = (mins: number) => {
  const m = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  return `${h % 12 || 12}:${String(m % 60).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}${mins < 0 ? " (day before)" : ""}`;
};

/** Portions to cook: guests plus the dish's wastage buffer. Counters are one per function. */
export const portions = (item: MenuItem, pax: number) => (item.pricingType === "plate" ? Math.ceil(pax * (1 + (item.bufferPct || 0) / 100)) : 1);

interface State {
  /** False until 0005_kitchen.sql has been run. */
  ready: boolean;
  rows: Record<string, KitchenRow>;
  load: () => Promise<void>;
  setStatus: (keys: string[], status: DishStatus) => void;
  setLeftover: (key: string, leftover: number) => void;
}

const save = (key: string, row: KitchenRow) => {
  const [function_id, item_id] = key.split(":");
  background(async (sb) => {
    const { error } = await sb.from("kitchen_items").upsert({ function_id, item_id, status: row.status, leftover: row.leftover, updated_at: new Date().toISOString() });
    if (error) throw new Error(`Saving the kitchen status: ${error.message}`);
  });
};

export const useKitchen = create<State>()((set, get) => ({
  ready: false,
  rows: {},
  load: async () => {
    const res = await supabase().from("kitchen_items").select("function_id,item_id,status,leftover").range(0, 9999);
    if (res.error) return set({ ready: false, rows: {} });
    set({ ready: true, rows: Object.fromEntries(res.data.map((r) => [kitchenKey(r.function_id, r.item_id), { status: r.status as DishStatus, leftover: Number(r.leftover) }])) });
  },
  setStatus: (keys, status) => {
    const rows = { ...get().rows };
    for (const k of keys) {
      rows[k] = { leftover: rows[k]?.leftover ?? 0, status };
      save(k, rows[k]);
    }
    set({ rows });
  },
  setLeftover: (key, leftover) => {
    const row = { status: get().rows[key]?.status ?? "packed", leftover };
    set((s) => ({ rows: { ...s.rows, [key]: row } }));
    save(key, row);
  },
}));
