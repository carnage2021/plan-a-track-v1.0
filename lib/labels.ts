"use client";

import { toast } from "sonner";
import { create } from "zustand";
import { background, write } from "./queue";
import { useStore } from "./store";
import { stockBy } from "./supply";
import { useSupply } from "./supply-store";
import type { Challan } from "./supply-types";
import { supabase } from "./supabase/client";
import { uid } from "./utils";

// QR labels on cutlery bunches, equipment and raw material bags, and what each scan does to stock and
// challans. Tables are in supabase/migrations/0011_labels.sql.

export type LabelKind = "asset" | "ingredient";
export type LabelStatus = "in_store" | "out" | "used" | "lost";
export type ScanAction = "load" | "return" | "receive" | "issue" | "count" | "lost";

export interface StockLabel {
  id: string;
  code: string;
  kind: LabelKind;
  itemId: string;
  qty: number;
  remaining: number;
  single: boolean;
  status: LabelStatus;
  challanId?: string;
  note: string;
  lastScanAt?: string;
  createdAt: string;
}

export const statusLabel: Record<LabelStatus, string> = { in_store: "In store", out: "Out at an event", used: "Used up", lost: "Lost" };

/** What a QR holds: a link that opens the label in the app from any phone camera. */
export const labelUrl = (code: string) => `${typeof window === "undefined" ? "" : window.location.origin}/s/${code}`;
/** Reads a scan or a typed code: the full link, or just the code printed under the QR. */
export const codeFrom = (text: string) => (text.trim().match(/\/s\/([A-Za-z0-9-]+)\s*$/)?.[1] ?? text.trim()).toUpperCase();

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come back untyped from PostgREST */
type Row = Record<string, any>;
const fromRow = (r: Row): StockLabel => ({ id: r.id, code: r.code, kind: r.kind, itemId: r.asset_id ?? r.ingredient_id, qty: Number(r.qty), remaining: Number(r.remaining), single: r.single, status: r.status, challanId: r.challan_id ?? undefined, note: r.note, lastScanAt: r.last_scan_at ?? undefined, createdAt: r.created_at });
async function ok(query: PromiseLike<{ error: { message: string } | null }>, what: string) {
  const { error } = await query;
  if (error) throw new Error(`${what}: ${error.message}`);
}

export interface NewLabels {
  kind: LabelKind;
  itemId: string;
  /** Pieces per bunch, or the bag size; 1 for a single piece */
  qty: number;
  single: boolean;
  count: number;
  note: string;
  /** A new delivery of raw material: the stock goes up by every bag labelled */
  receive?: { storeId: string; rate: number; poId?: string };
}

interface State {
  /** False until 0011_labels.sql has been run. */
  ready: boolean;
  labels: StockLabel[];
  load: () => Promise<void>;
  create: (spec: NewLabels) => Promise<StockLabel[]>;
  find: (code: string) => Promise<StockLabel | undefined>;
  /** Scanned bunches leave on a challan: issued counts go up and the labels are marked out. */
  loadOut: (challan: Challan, scanned: StockLabel[], loose: Record<string, number>) => void;
  /** Scanned bunches come back: returned counts and missing pieces are worked out, labels are back in store. */
  bringBack: (challan: Challan, scanned: StockLabel[], loose: Record<string, number>, broken: Record<string, number>, markLost: boolean) => void;
  /** Raw material taken by the kitchen for an event. */
  issue: (orderId: string, storeId: string, entries: { label: StockLabel; qty: number }[]) => void;
  /** A shelf count: stock is set to what was scanned, and labels not seen can be marked lost. */
  applyCount: (storeId: string, scanned: StockLabel[], markLost: boolean) => { adjusted: number; lost: number };
  markLost: (ids: string[]) => void;
}

const logScans = (rows: { label_id: string; action: ScanAction; qty: number; ref_id?: string | null }[]) =>
  rows.length && background((sb) => ok(sb.from("label_scans").insert(rows.map((r) => ({ ...r, ref_id: r.ref_id ?? null }))), "Logging the scans"));

export const useLabels = create<State>()((set, get) => {
  const patchLocal = (changes: Map<string, Partial<StockLabel>>) => set((s) => ({ labels: s.labels.map((l) => (changes.has(l.id) ? { ...l, ...changes.get(l.id) } : l)) }));
  const saveLabels = (changes: Map<string, Partial<StockLabel>>) => {
    patchLocal(changes);
    background(async (sb) => {
      for (const [id, c] of changes) {
        const row: Row = { last_scan_at: new Date().toISOString() };
        if (c.status) row.status = c.status;
        if ("challanId" in c) row.challan_id = c.challanId ?? null;
        if (c.remaining !== undefined) row.remaining = c.remaining;
        await ok(sb.from("stock_labels").update(row).eq("id", id), "Saving the label");
      }
    });
  };

  return {
    ready: false,
    labels: [],

    load: async () => {
      const res = await supabase().from("stock_labels").select("*").order("created_at", { ascending: false }).range(0, 19999);
      if (res.error) return set({ ready: false, labels: [] });
      set({ ready: true, labels: (res.data as Row[]).map(fromRow) });
    },

    create: async (spec) => {
      const made = await write(async (sb) => {
        const docType = spec.kind === "asset" ? "label_asset" : "label_ingredient";
        const res = await sb.rpc("next_doc_numbers", { p_doc_type: docType, p_financial_year: "all", p_count: spec.count });
        if (res.error) throw new Error(res.error.message);
        const last = res.data as number;
        const prefix = spec.kind === "asset" ? "C" : "R";
        const rows = Array.from({ length: spec.count }, (_, i) => ({
          id: uid(),
          code: `${prefix}-${String(last - spec.count + 1 + i).padStart(6, "0")}`,
          kind: spec.kind,
          asset_id: spec.kind === "asset" ? spec.itemId : null,
          ingredient_id: spec.kind === "ingredient" ? spec.itemId : null,
          qty: spec.qty,
          remaining: spec.qty,
          single: spec.single,
          note: spec.note,
        }));
        await ok(sb.from("stock_labels").insert(rows), "Saving the labels");
        await ok(sb.from("label_scans").insert(rows.map((r) => ({ label_id: r.id, action: spec.receive ? "receive" : "count", qty: r.qty, ref_id: spec.receive?.poId ?? null }))), "Logging the labels");
        return rows.map((r) => fromRow({ ...r, status: "in_store", created_at: new Date().toISOString() }));
      });
      set((s) => ({ labels: [...made, ...s.labels] }));
      if (spec.kind === "ingredient" && spec.receive) {
        const supply = useSupply.getState();
        supply.addMovement({ ingredientId: spec.itemId, storeId: spec.receive.storeId, type: "purchase", qty: spec.qty * spec.count, rate: spec.receive.rate || undefined, note: `Received and labelled ${made[0].code} to ${made[made.length - 1].code}`, poId: spec.receive.poId });
        const ing = supply.ingredients.find((i) => i.id === spec.itemId);
        if (ing && spec.receive.rate && spec.receive.rate !== ing.lastRate) supply.saveIngredient({ ...ing, lastRate: spec.receive.rate });
      }
      return made;
    },

    find: async (code) => {
      const local = get().labels.find((l) => l.code === code);
      if (local) return local;
      // Made on another phone since this one loaded: fetch it.
      const { data } = await supabase().from("stock_labels").select("*").eq("code", code).maybeSingle();
      if (!data) return undefined;
      const label = fromRow(data);
      set((s) => ({ labels: [label, ...s.labels] }));
      return label;
    },

    loadOut: (challan, scanned, loose) => {
      const add = new Map<string, number>();
      for (const l of scanned) add.set(l.itemId, (add.get(l.itemId) ?? 0) + l.qty);
      for (const [assetId, n] of Object.entries(loose)) if (n > 0) add.set(assetId, (add.get(assetId) ?? 0) + n);
      const lines = challan.lines.map((l) => (add.has(l.assetId) ? { ...l, issued: (challan.status === "draft" ? 0 : l.issued) + add.get(l.assetId)! } : l));
      // Items that were scanned but not on the challan join it, so nothing leaves uncounted.
      for (const [assetId, n] of add) if (!lines.some((l) => l.assetId === assetId)) lines.push({ id: uid(), assetId, required: 0, issued: n, returned: 0, broken: 0, missing: 0, rentedQty: 0, rentalCost: 0, deliverTime: "", deliverPlace: "" });
      useSupply.getState().saveChallan({ ...challan, status: "issued", lines });
      saveLabels(new Map(scanned.map((l) => [l.id, { status: "out" as const, challanId: challan.id }])));
      logScans(scanned.map((l) => ({ label_id: l.id, action: "load", qty: l.qty, ref_id: challan.id })));
    },

    bringBack: (challan, scanned, loose, broken, markLost) => {
      const back = new Map<string, number>();
      for (const l of scanned) back.set(l.itemId, (back.get(l.itemId) ?? 0) + l.qty);
      for (const [assetId, n] of Object.entries(loose)) if (n > 0) back.set(assetId, (back.get(assetId) ?? 0) + n);
      const lines = challan.lines.map((l) => {
        const returned = back.get(l.assetId) ?? 0;
        const b = broken[l.assetId] ?? 0;
        return { ...l, returned, broken: b, missing: Math.max(0, l.issued - returned - b) };
      });
      useSupply.getState().saveChallan({ ...challan, status: "returned", lines });
      const changes = new Map<string, Partial<StockLabel>>(scanned.map((l) => [l.id, { status: "in_store" as const, challanId: undefined }]));
      const notBack = get().labels.filter((l) => l.challanId === challan.id && l.status === "out" && !scanned.some((s) => s.id === l.id));
      if (markLost) for (const l of notBack) changes.set(l.id, { status: "lost", challanId: undefined });
      saveLabels(changes);
      logScans([...scanned.map((l) => ({ label_id: l.id, action: "return" as const, qty: l.qty, ref_id: challan.id })), ...(markLost ? notBack.map((l) => ({ label_id: l.id, action: "lost" as const, qty: l.qty, ref_id: challan.id })) : [])]);
    },

    issue: (orderId, storeId, entries) => {
      const supply = useSupply.getState();
      const order = useStore.getState().orders.find((o) => o.id === orderId);
      const byIngredient = new Map<string, number>();
      for (const e of entries) byIngredient.set(e.label.itemId, (byIngredient.get(e.label.itemId) ?? 0) + e.qty);
      for (const [ingredientId, qty] of byIngredient) supply.addMovement({ ingredientId, storeId, type: "issue", qty: -qty, note: `Issued to kitchen by scan${order ? ` for ${order.number}` : ""}`, orderId });
      saveLabels(new Map(entries.map((e) => {
        const remaining = Math.max(0, Math.round((e.label.remaining - e.qty) * 1000) / 1000);
        return [e.label.id, { remaining, status: remaining <= 0 ? ("used" as const) : ("in_store" as const) }];
      })));
      logScans(entries.map((e) => ({ label_id: e.label.id, action: "issue", qty: e.qty, ref_id: orderId })));
    },

    applyCount: (storeId, scanned, markLost) => {
      const supply = useSupply.getState();
      const book = stockBy(supply.movements, storeId);
      // Only ingredients that have labels can be counted this way; loose stock is left as it is.
      const labelled = new Set(get().labels.filter((l) => l.kind === "ingredient" && l.status === "in_store").map((l) => l.itemId));
      const counted = new Map<string, number>();
      for (const l of scanned) if (l.kind === "ingredient") counted.set(l.itemId, (counted.get(l.itemId) ?? 0) + l.remaining);
      let adjusted = 0;
      for (const id of labelled) {
        const diff = Math.round(((counted.get(id) ?? 0) - (book.get(id) ?? 0)) * 1000) / 1000;
        if (diff !== 0) {
          supply.addMovement({ ingredientId: id, storeId, type: "adjustment", qty: diff, note: "Stock count by scanning" });
          adjusted++;
        }
      }
      const unseen = markLost ? get().labels.filter((l) => l.status === "in_store" && !scanned.some((s) => s.id === l.id)) : [];
      saveLabels(new Map([...scanned.map((l) => [l.id, {}] as const), ...unseen.map((l) => [l.id, { status: "lost" as const }] as const)]));
      logScans([...scanned.map((l) => ({ label_id: l.id, action: "count" as const, qty: l.remaining })), ...unseen.map((l) => ({ label_id: l.id, action: "lost" as const, qty: l.remaining }))]);
      return { adjusted, lost: unseen.length };
    },

    markLost: (ids) => {
      saveLabels(new Map(ids.map((id) => [id, { status: "lost" as const, challanId: undefined }])));
      logScans(get().labels.filter((l) => ids.includes(l.id)).map((l) => ({ label_id: l.id, action: "lost", qty: l.remaining })));
      toast.success(`${ids.length} ${ids.length === 1 ? "label" : "labels"} marked lost`);
    },
  };
});
