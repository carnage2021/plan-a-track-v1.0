"use client";

import { toast } from "sonner";
import { create } from "zustand";
import { background } from "./queue";
import { supabase } from "./supabase/client";
import { uid } from "./utils";
import { inBranch, withBranch } from "./branch";

// Phase 4B: dispatch and transport (D4) and the on-site event screen (D5).
// Tables are in supabase/migrations/0006_operations.sql.

export interface Vehicle {
  id: string;
  name: string;
  regNumber: string;
  hired: boolean;
  vendorId?: string;
  capacity: string;
  ratePerTrip: number;
  driverName: string;
  driverPhone: string;
  active: boolean;
}

export type TripStatus = "planned" | "loading" | "dispatched" | "delivered";
export const tripFlow: TripStatus[] = ["planned", "loading", "dispatched", "delivered"];
export const tripLabel: Record<TripStatus, string> = { planned: "Planned", loading: "Loading", dispatched: "On the way", delivered: "Delivered" };
export const tripNext: Partial<Record<TripStatus, string>> = { planned: "Start loading", loading: "Dispatch", dispatched: "Confirm delivery" };

export interface LoadLine { label: string; done: boolean }
export interface Trip {
  id: string;
  orderId: string;
  functionId: string;
  vehicleId?: string;
  driverName: string;
  driverPhone: string;
  departTime: string;
  status: TripStatus;
  cost: number;
  loading: LoadLine[];
  proofPath?: string;
  deliveredAt?: string;
  notes: string;
}

/** What goes on every truck besides the food, ticked off at the kitchen door. */
export const standardLoad = ["Serving utensils and ladles", "Counters, chafing dishes and burners", "Gas cylinders", "Disposables, foil and packing"];

export const checkSteps = [
  { id: "setup", label: "Setup done", help: "Tables, counters and decor in place" },
  { id: "food", label: "Food arrived", help: "All trips unloaded and checked" },
  { id: "counters", label: "Counters live", help: "Food hot, labels up, staff at counters" },
  { id: "service", label: "Service started", help: "Guests are being served" },
  { id: "cleanup", label: "Cleanup done", help: "Venue cleared, crockery packed" },
] as const;
export type CheckStep = (typeof checkSteps)[number]["id"];

export interface Onsite {
  functionId: string;
  orderId: string;
  /** When each step was ticked, as an ISO timestamp */
  checklist: Partial<Record<CheckStep, string>>;
  guests: number;
  signoffName: string;
  signoffPath?: string;
  signedAt?: string;
}

export type IssueKind = "short_item" | "late_vendor" | "complaint" | "equipment" | "other";
export const issueKinds: { id: IssueKind; label: string }[] = [
  { id: "short_item", label: "Item running short" },
  { id: "late_vendor", label: "Vendor or agency late" },
  { id: "complaint", label: "Client complaint" },
  { id: "equipment", label: "Equipment problem" },
  { id: "other", label: "Other" },
];
export interface Issue { id: string; orderId: string; functionId: string; kind: IssueKind; note: string; photoPath?: string; resolved: boolean; reportedBy: string; createdAt: string }

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come back untyped from PostgREST */
type Row = Record<string, any>;
const vehicleRow = (v: Vehicle): Row => ({ id: v.id, name: v.name, reg_number: v.regNumber, hired: v.hired, vendor_id: v.vendorId ?? null, capacity: v.capacity, rate_per_trip: v.ratePerTrip, driver_name: v.driverName, driver_phone: v.driverPhone, active: v.active });
const tripRow = (t: Trip): Row => ({ id: t.id, order_id: t.orderId, function_id: t.functionId, vehicle_id: t.vehicleId ?? null, driver_name: t.driverName, driver_phone: t.driverPhone, depart_time: t.departTime, status: t.status, cost: t.cost, loading: t.loading, proof_path: t.proofPath ?? null, delivered_at: t.deliveredAt ?? null, notes: t.notes });
const onsiteRow = (o: Onsite): Row => ({ function_id: o.functionId, order_id: o.orderId, checklist: o.checklist, guests: o.guests, signoff_name: o.signoffName, signoff_path: o.signoffPath ?? null, signed_at: o.signedAt ?? null, updated_at: new Date().toISOString() });
const issueRow = (i: Issue): Row => ({ id: i.id, order_id: i.orderId, function_id: i.functionId, kind: i.kind, note: i.note, photo_path: i.photoPath ?? null, resolved: i.resolved, reported_by: i.reportedBy });
async function ok(query: PromiseLike<{ error: { message: string } | null }>, what: string) {
  const { error } = await query;
  if (error) throw new Error(`${what}: ${error.message}`);
}

interface State {
  /** False until 0006_operations.sql has been run. */
  ready: boolean;
  vehicles: Vehicle[];
  trips: Trip[];
  onsite: Record<string, Onsite>;
  issues: Issue[];
  load: () => Promise<void>;
  saveVehicle: (v: Omit<Vehicle, "id"> & { id?: string }) => string;
  addTrip: (t: Omit<Trip, "id">) => void;
  patchTrip: (id: string, patch: Partial<Trip>) => void;
  removeTrip: (id: string) => void;
  patchOnsite: (functionId: string, orderId: string, patch: Partial<Onsite>) => void;
  addIssue: (i: Omit<Issue, "id" | "createdAt" | "resolved">) => void;
  resolveIssue: (id: string, resolved: boolean) => void;
}

const empty = { vehicles: [], trips: [], onsite: {}, issues: [] };
// The guest counter is tapped fast at the gate; save each function's record after a pause.
const onsiteTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const useOps = create<State>()((set, get) => ({
  ...empty,
  ready: false,

  load: async () => {
    const sb = supabase();
    const all = (table: string, order: string) => sb.from(table).select("*").order(order).range(0, 9999);
    const [vehicles, trips, onsite, issues] = await Promise.all([all("vehicles", "name"), all("trips", "created_at"), all("onsite", "updated_at"), all("onsite_issues", "created_at")]);
    if (vehicles.error) return set({ ...empty, ready: false });
    const failed = [trips, onsite, issues].find((r) => r.error);
    if (failed) return void toast.error("Could not load dispatch and event-day data", { description: failed.error?.message });
    set({
      ready: true,
      vehicles: (vehicles.data as Row[]).filter(inBranch).map((v) => ({ id: v.id, name: v.name, regNumber: v.reg_number, hired: v.hired, vendorId: v.vendor_id ?? undefined, capacity: v.capacity, ratePerTrip: Number(v.rate_per_trip), driverName: v.driver_name, driverPhone: v.driver_phone, active: v.active })),
      trips: (trips.data as Row[]).map((t) => ({ id: t.id, orderId: t.order_id, functionId: t.function_id, vehicleId: t.vehicle_id ?? undefined, driverName: t.driver_name, driverPhone: t.driver_phone, departTime: t.depart_time, status: t.status, cost: Number(t.cost), loading: t.loading ?? [], proofPath: t.proof_path ?? undefined, deliveredAt: t.delivered_at ?? undefined, notes: t.notes })),
      onsite: Object.fromEntries((onsite.data as Row[]).map((o) => [o.function_id, { functionId: o.function_id, orderId: o.order_id, checklist: o.checklist ?? {}, guests: o.guests, signoffName: o.signoff_name, signoffPath: o.signoff_path ?? undefined, signedAt: o.signed_at ?? undefined }])),
      issues: (issues.data as Row[]).map((i) => ({ id: i.id, orderId: i.order_id, functionId: i.function_id, kind: i.kind, note: i.note, photoPath: i.photo_path ?? undefined, resolved: i.resolved, reportedBy: i.reported_by, createdAt: i.created_at })),
    });
  },

  saveVehicle: (v) => {
    const saved: Vehicle = { ...v, id: v.id ?? uid() };
    set((s) => ({ vehicles: v.id ? s.vehicles.map((x) => (x.id === saved.id ? saved : x)) : [...s.vehicles, saved].sort((a, b) => a.name.localeCompare(b.name)) }));
    background((sb) => ok(sb.from("vehicles").upsert(v.id ? vehicleRow(saved) : withBranch(vehicleRow(saved))), "Saving the vehicle"));
    return saved.id;
  },

  addTrip: (t) => {
    const saved = { ...t, id: uid() };
    set((s) => ({ trips: [...s.trips, saved] }));
    background((sb) => ok(sb.from("trips").insert(tripRow(saved)), "Saving the trip"));
  },
  patchTrip: (id, patch) => {
    set((s) => ({ trips: s.trips.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
    const saved = get().trips.find((t) => t.id === id);
    if (saved) background((sb) => ok(sb.from("trips").update(tripRow(saved)).eq("id", id), "Saving the trip"));
  },
  removeTrip: (id) => {
    set((s) => ({ trips: s.trips.filter((t) => t.id !== id) }));
    background((sb) => ok(sb.from("trips").delete().eq("id", id), "Removing the trip"));
  },

  patchOnsite: (functionId, orderId, patch) => {
    const before = get().onsite[functionId] ?? { functionId, orderId, checklist: {}, guests: 0, signoffName: "" };
    set((s) => ({ onsite: { ...s.onsite, [functionId]: { ...before, ...patch } } }));
    clearTimeout(onsiteTimers.get(functionId));
    onsiteTimers.set(
      functionId,
      setTimeout(() => {
        const saved = get().onsite[functionId];
        if (saved) background((sb) => ok(sb.from("onsite").upsert(onsiteRow(saved)), "Saving the event-day record"));
      }, 600),
    );
  },

  addIssue: (i) => {
    const saved: Issue = { ...i, id: uid(), resolved: false, createdAt: new Date().toISOString() };
    set((s) => ({ issues: [...s.issues, saved] }));
    background((sb) => ok(sb.from("onsite_issues").insert(issueRow(saved)), "Logging the issue"));
  },
  resolveIssue: (id, resolved) => {
    set((s) => ({ issues: s.issues.map((i) => (i.id === id ? { ...i, resolved } : i)) }));
    background((sb) => ok(sb.from("onsite_issues").update({ resolved }).eq("id", id), "Updating the issue"));
  },
}));

/** Transport spent on an order: every trip's cost, whether or not it has run yet. */
export const transportCost = (trips: Trip[], orderId: string) => trips.filter((t) => t.orderId === orderId).reduce((s, t) => s + t.cost, 0);
