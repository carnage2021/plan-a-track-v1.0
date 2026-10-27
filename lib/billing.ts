"use client";

import { toast } from "sonner";
import { create } from "zustand";
import { chargeAmount, priceFunction, priceQuote } from "./pricing";
import { background, write } from "./queue";
import { useStore } from "./store";
import { supabase } from "./supabase/client";
import type { Order, PaymentMode } from "./types";
import { addDays, daysFromToday, financialYear, isoDate, parseDate, uid } from "./utils";

// Phase 5A: client billing (plan E1). Payment schedule, proforma and GST invoices, credit notes and refunds.
// Tables are in supabase/migrations/0007_billing.sql; payments themselves live on the order (0002).

export interface Milestone { id: string; orderId: string; label: string; kind: "percent" | "amount"; value: number; dueDate: string; remindedAt?: string }
export interface InvoiceLine { label: string; qty: number; rate: number; amount: number }
export interface InvoiceSnapshot {
  client: { name: string; phone: string; address: string; gstin: string };
  lines: InvoiceLine[];
  subtotal: number;
  discount: number;
  taxable: number;
  gstRate: number;
  gst: number;
  gstInclusive: boolean;
  total: number;
  /** Already received when the invoice was issued */
  paid: number;
}
export interface Invoice { id: string; orderId: string; number: string; kind: "proforma" | "tax"; issuedOn: string; snapshot: InvoiceSnapshot; total: number }
export interface CreditNote { id: string; orderId: string; number: string; reason: string; amount: number; refundAmount: number; refundMode?: PaymentMode; issuedOn: string }

/** Catering services, for the SAC column on a GST invoice. */
export const cateringSac = "996334";

/** 50% to book, 40% a week before the first function, the rest the day after the last one. */
export function defaultSchedule(order: Order): Milestone[] {
  const dates = order.functions.map((f) => f.date).sort();
  const first = dates[0] ?? isoDate(new Date());
  const last = dates[dates.length - 1] ?? first;
  const booked = order.createdAt.slice(0, 10);
  const week = isoDate(addDays(parseDate(first), -7));
  return [
    { id: uid(), orderId: order.id, label: "Booking advance", kind: "percent", value: 50, dueDate: booked },
    { id: uid(), orderId: order.id, label: "Second instalment", kind: "percent", value: 40, dueDate: week < booked ? booked : week },
    { id: uid(), orderId: order.id, label: "Final settlement", kind: "percent", value: 10, dueDate: isoDate(addDays(parseDate(last), 1)) },
  ];
}

export type MilestoneState = "paid" | "part" | "due" | "overdue" | "upcoming";
export interface ScheduleRow extends Milestone { amount: number; covered: number; state: MilestoneState; daysLate: number; /** Unpaid money due within three days, or late */ remind: boolean }

/**
 * Lines the schedule up against what has been received, oldest milestone first. The last milestone
 * always takes whatever is left, so the schedule adds up to the bill even after the order changes.
 */
export function scheduleRows(milestones: Milestone[], bill: number, received: number): ScheduleRow[] {
  let left = bill;
  let pool = received;
  return milestones.map((m, i) => {
    const raw = m.kind === "percent" ? Math.round((bill * m.value) / 100) : m.value;
    const amount = i === milestones.length - 1 ? Math.max(0, left) : Math.min(raw, Math.max(0, left));
    left -= amount;
    const covered = Math.min(amount, Math.max(0, pool));
    pool -= covered;
    const days = daysFromToday(m.dueDate);
    const state: MilestoneState = covered >= amount ? "paid" : days < 0 ? "overdue" : covered > 0 ? "part" : days <= 3 ? "due" : "upcoming";
    return { ...m, amount, covered, state, daysLate: Math.max(0, -days), remind: covered < amount && days <= 3 };
  });
}

/** What the client owes on an order once credit notes and refunds are counted. A cancelled order owes nothing more. */
export function balanceOf(order: Order, grand: number, credits: CreditNote[]) {
  const mine = credits.filter((c) => c.orderId === order.id);
  const credited = mine.reduce((s, c) => s + c.amount, 0);
  const refunded = mine.reduce((s, c) => s + c.refundAmount, 0);
  const paid = order.payments.reduce((s, p) => s + p.amount, 0);
  const received = paid - refunded;
  const bill = order.status === "cancelled" ? received : Math.max(0, grand - credited);
  return { bill, credited, refunded, paid, received, due: Math.max(0, bill - received) };
}

/** Days-overdue bands for the outstanding report. */
export const ageBands = [
  { id: "current", label: "Not yet due", test: (d: number) => d === 0 },
  { id: "30", label: "1 to 30 days", test: (d: number) => d > 0 && d <= 30 },
  { id: "60", label: "31 to 60 days", test: (d: number) => d > 30 && d <= 60 },
  { id: "90", label: "Over 60 days", test: (d: number) => d > 60 },
] as const;

const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const twoDigits = (n: number) => (n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ""}`);
const threeDigits = (n: number) => [n >= 100 ? `${ones[Math.floor(n / 100)]} Hundred` : "", twoDigits(n % 100)].filter(Boolean).join(" ");

/** Amount in words the Indian way, for invoices: 1,25,000 is "One Lakh Twenty Five Thousand Rupees Only". */
export function rupeesInWords(amount: number) {
  let n = Math.round(amount);
  if (n === 0) return "Zero Rupees Only";
  const parts: string[] = [];
  for (const [size, name] of [[1e7, "Crore"], [1e5, "Lakh"], [1e3, "Thousand"]] as const) {
    if (n >= size) {
      parts.push(`${size === 1e7 ? rupeesInWords(Math.floor(n / size)).replace(" Rupees Only", "") : twoDigits(Math.floor(n / size))} ${name}`);
      n %= size;
    }
  }
  if (n) parts.push(threeDigits(n));
  return `${parts.join(" ")} Rupees Only`;
}

/** Freezes an order's bill into invoice lines: one line per function's plates, its counters, then the extras. */
export function buildSnapshot(order: Order, paid: number): InvoiceSnapshot {
  const s = useStore.getState();
  const client = s.clients.find((c) => c.id === order.clientId);
  const lines: InvoiceLine[] = [];
  for (const fn of [...order.functions].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))) {
    const p = priceFunction(fn, s.items, s.packages, s.tenant.slabs);
    const pkg = s.packages.find((x) => x.id === fn.packageId);
    if (fn.pax && p.perPlate) lines.push({ label: `${fn.name}, ${fn.date.split("-").reverse().join("-")}${pkg ? ` (${pkg.name})` : ""}`, qty: fn.pax, rate: p.perPlate, amount: p.perPlate * fn.pax });
    if (p.fixed) lines.push({ label: `${fn.name}: counters and add-ons`, qty: 1, rate: p.fixed, amount: p.fixed });
    // Staff, cutlery and other charges of this event, each on its own line.
    for (const c of fn.charges ?? []) if (chargeAmount(c)) lines.push({ label: `${fn.name}: ${c.label}`, qty: c.qty, rate: c.rate, amount: chargeAmount(c) });
  }
  for (const x of order.extras) lines.push({ label: x.label, qty: 1, rate: x.amount, amount: x.amount });
  const t = priceQuote(order, s.items, s.packages, s.tenant.slabs);
  return {
    client: { name: client?.name ?? "", phone: client?.phone ?? "", address: client?.address ?? "", gstin: client?.gstin ?? "" },
    lines,
    subtotal: t.subtotal,
    // Referral credit is taken off like a discount on the invoice.
    discount: Math.round(t.discount + t.credit),
    taxable: Math.round(t.taxable * 100) / 100,
    gstRate: order.gstRate,
    gst: Math.round(t.gst * 100) / 100,
    gstInclusive: order.gstInclusive,
    total: t.grand,
    paid,
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come back untyped from PostgREST */
type Row = Record<string, any>;
const day = (v: string) => String(v).slice(0, 10);
async function ok(query: PromiseLike<{ error: { message: string } | null }>, what: string) {
  const { error } = await query;
  if (error) throw new Error(`${what}: ${error.message}`);
}
async function number(prefix: string, docType: "invoice" | "proforma" | "credit_note") {
  const res = await supabase().rpc("next_doc_number", { p_doc_type: docType, p_financial_year: financialYear() });
  if (res.error) throw new Error(res.error.message);
  return `${prefix}/${financialYear()}/${String(res.data).padStart(4, "0")}`;
}

interface State {
  /** False until 0007_billing.sql has been run. */
  ready: boolean;
  milestones: Milestone[];
  invoices: Invoice[];
  credits: CreditNote[];
  load: () => Promise<void>;
  /** The saved schedule, or the default split for an order that has none yet. */
  scheduleFor: (order: Order) => Milestone[];
  saveSchedule: (orderId: string, rows: Milestone[]) => void;
  markReminded: (order: Order, milestoneId: string) => void;
  issueInvoice: (order: Order, kind: Invoice["kind"], paid: number) => Promise<Invoice>;
  addCredit: (c: Omit<CreditNote, "id" | "number" | "issuedOn">) => Promise<CreditNote>;
}

export const useBilling = create<State>()((set, get) => ({
  ready: false,
  milestones: [],
  invoices: [],
  credits: [],

  load: async () => {
    const sb = supabase();
    const [m, inv, cn] = await Promise.all([
      sb.from("payment_milestones").select("*").order("position").range(0, 9999),
      sb.from("invoices").select("*").order("created_at").range(0, 9999),
      sb.from("credit_notes").select("*").order("created_at").range(0, 9999),
    ]);
    if (m.error) return set({ ready: false, milestones: [], invoices: [], credits: [] });
    const failed = [inv, cn].find((r) => r.error);
    if (failed) return void toast.error("Could not load invoices", { description: failed.error?.message });
    set({
      ready: true,
      milestones: (m.data as Row[]).map((r) => ({ id: r.id, orderId: r.order_id, label: r.label, kind: r.kind, value: Number(r.value), dueDate: day(r.due_date), remindedAt: r.reminded_at ?? undefined })),
      invoices: (inv.data as Row[]).map((r) => ({ id: r.id, orderId: r.order_id, number: r.number, kind: r.kind, issuedOn: day(r.issued_on), snapshot: r.snapshot, total: Number(r.total) })),
      credits: (cn.data as Row[]).map((r) => ({ id: r.id, orderId: r.order_id, number: r.number, reason: r.reason, amount: Number(r.amount), refundAmount: Number(r.refund_amount), refundMode: r.refund_mode ?? undefined, issuedOn: day(r.issued_on) })),
    });
  },

  scheduleFor: (order) => {
    const saved = get().milestones.filter((m) => m.orderId === order.id);
    return saved.length ? saved : defaultSchedule(order);
  },

  saveSchedule: (orderId, rows) => {
    const saved = rows.map((r) => ({ ...r, orderId }));
    set((s) => ({ milestones: [...s.milestones.filter((m) => m.orderId !== orderId), ...saved] }));
    background(async (sb) => {
      await ok(sb.from("payment_milestones").delete().eq("order_id", orderId), "Saving the schedule");
      await ok(sb.from("payment_milestones").insert(saved.map((m, i) => ({ id: m.id, order_id: orderId, position: i, label: m.label, kind: m.kind, value: m.value, due_date: m.dueDate, reminded_at: m.remindedAt ?? null }))), "Saving the schedule");
    });
  },

  markReminded: (order, milestoneId) => {
    // Reminding on a default schedule saves it, so the reminder has a row to sit on.
    const rows = get().scheduleFor(order).map((m) => (m.id === milestoneId ? { ...m, remindedAt: new Date().toISOString() } : m));
    get().saveSchedule(order.id, rows);
  },

  issueInvoice: async (order, kind, paid) => {
    const prefix = kind === "tax" ? useStore.getState().tenant.invoicePrefix || "INV" : "PI";
    const invoice = await write(async (sb) => {
      const inv: Invoice = { id: uid(), orderId: order.id, number: await number(prefix, kind === "tax" ? "invoice" : "proforma"), kind, issuedOn: isoDate(new Date()), snapshot: buildSnapshot(order, paid), total: 0 };
      inv.total = inv.snapshot.total;
      await ok(sb.from("invoices").insert({ id: inv.id, order_id: inv.orderId, number: inv.number, kind, issued_on: inv.issuedOn, snapshot: inv.snapshot, total: inv.total }), "Issuing the invoice");
      return inv;
    });
    set((s) => ({ invoices: [...s.invoices, invoice] }));
    return invoice;
  },

  addCredit: async (c) => {
    const note = await write(async (sb) => {
      const n: CreditNote = { ...c, id: uid(), number: await number("CN", "credit_note"), issuedOn: isoDate(new Date()) };
      await ok(sb.from("credit_notes").insert({ id: n.id, order_id: n.orderId, number: n.number, reason: n.reason, amount: n.amount, refund_amount: n.refundAmount, refund_mode: n.refundMode ?? null, issued_on: n.issuedOn }), "Saving the credit note");
      return n;
    });
    set((s) => ({ credits: [...s.credits, note] }));
    return note;
  },
}));
