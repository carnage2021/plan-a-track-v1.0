"use client";

import { create } from "zustand";
import { schema } from "./db";
import { selectAll } from "./paged";
import { background, write } from "./queue";
import { useStore } from "./store";
import { supabase } from "./supabase/client";
import type { Order, QuoteDraft } from "./types";
import { uid } from "./utils";

// Cost Calculator (0028): a menu and its extras worked out for the bill, costing and profit, without a client or a
// booking. Each calculation keeps its booking draft (events, menu, extras, discount) until deleted, and can be
// turned into a booking later.

export interface Estimate {
  id: string;
  name: string;
  draft: QuoteDraft;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

interface State {
  ready: boolean;
  loaded: boolean;
  list: Estimate[];
  load: () => Promise<void>;
  /** Saves and returns the id (a new one for a new calculation) */
  save: (e: Omit<Estimate, "id" | "createdAt" | "updatedAt"> & { id?: string }) => Promise<string>;
  remove: (id: string) => void;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come back untyped from PostgREST */
const fromRow = (r: any): Estimate => ({ id: r.id, name: r.name, draft: r.draft, createdBy: r.created_by ?? undefined, createdAt: r.created_at, updatedAt: r.updated_at });

export const useEstimates = create<State>()((set, get) => ({
  ready: false,
  loaded: false,
  list: [],
  load: async () => {
    if (!schema.estimates) return set({ ready: false, loaded: true, list: [] });
    const res = await selectAll(supabase(), "estimates", "updated_at", false);
    set({ ready: !res.error, loaded: true, list: (res.data ?? []).map(fromRow) });
  },
  save: async (e) => {
    const id = e.id ?? uid();
    const now = new Date().toISOString();
    const old = get().list.find((x) => x.id === id);
    const saved: Estimate = { id, name: e.name.trim() || "Untitled calculation", draft: { ...e.draft, step: 0 }, createdBy: old?.createdBy ?? useStore.getState().currentUserId, createdAt: old?.createdAt ?? now, updatedAt: now };
    set((s) => ({ list: [saved, ...s.list.filter((x) => x.id !== id)] }));
    await write(async (sb) => {
      const { error } = await sb.from("estimates").upsert({ id, name: saved.name, draft: saved.draft, created_by: saved.createdBy ?? null, updated_at: now });
      if (error) throw new Error(error.message);
    });
    return id;
  },
  remove: (id) => {
    set((s) => ({ list: s.list.filter((x) => x.id !== id) }));
    background(async (sb) => {
      const { error } = await sb.from("estimates").delete().eq("id", id);
      if (error) throw new Error(error.message);
    });
  },
}));

/** A calculation as an order, so the order's costing (raw material, vendors, profit) can be worked out for it. */
export function asOrder(id: string, draft: QuoteDraft): Order {
  const t = useStore.getState().tenant;
  return {
    id, number: "Calculation", clientId: "", eventType: draft.eventType, functions: draft.functions, extras: draft.extras, discount: draft.discount,
    gstRate: t.gstRate, gstInclusive: t.gstInclusive, status: "tentative", payments: [], changeLog: [], instructions: "", managerId: "", commissionPct: 0, createdAt: "",
  };
}
