"use client";

import { toast } from "sonner";
import { create } from "zustand";
import { background, write } from "./queue";
import { useStore } from "./store";
import { supabase } from "./supabase/client";
import type { PaymentMode } from "./types";
import { financialYear, isoDate, uid } from "./utils";

// Phase 5B: event and business expenses with bill photos, and the petty cash book per team member.
// Tables are in supabase/migrations/0008_expenses_documents.sql.

export type ExpenseCategory = "gas" | "ice" | "transport" | "tips" | "labour" | "rent" | "utilities" | "misc";
export const expenseCategories: { id: ExpenseCategory; label: string }[] = [
  { id: "gas", label: "Gas and fuel" },
  { id: "ice", label: "Ice and water" },
  { id: "transport", label: "Local transport" },
  { id: "tips", label: "Tips" },
  { id: "labour", label: "Casual labour" },
  { id: "rent", label: "Rent" },
  { id: "utilities", label: "Electricity and utilities" },
  { id: "misc", label: "Other" },
];
export const categoryLabel = (c: ExpenseCategory) => expenseCategories.find((x) => x.id === c)?.label ?? c;

export interface Expense {
  id: string;
  number: string;
  orderId?: string;
  category: ExpenseCategory;
  amount: number;
  mode: PaymentMode;
  /** Team user whose petty cash paid for it */
  pettyHolder?: string;
  paidTo: string;
  note: string;
  photoPath?: string;
  date: string;
}
export interface PettyEntry { id: string; holder: string; kind: "issue" | "return"; amount: number; date: string; note: string }

/** Cash a team member is holding: what they were given, less what they returned and spent from it. */
export function pettyBalance(holder: string, petty: PettyEntry[], expenses: Expense[]) {
  const given = petty.filter((p) => p.holder === holder && p.kind === "issue").reduce((s, p) => s + p.amount, 0);
  const returned = petty.filter((p) => p.holder === holder && p.kind === "return").reduce((s, p) => s + p.amount, 0);
  const spent = expenses.filter((e) => e.pettyHolder === holder).reduce((s, e) => s + e.amount, 0);
  return { given, returned, spent, balance: given - returned - spent };
}

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come back untyped from PostgREST */
type Row = Record<string, any>;
async function ok(query: PromiseLike<{ error: { message: string } | null }>, what: string) {
  const { error } = await query;
  if (error) throw new Error(`${what}: ${error.message}`);
}

interface State {
  /** False until 0008_expenses_documents.sql has been run. */
  ready: boolean;
  expenses: Expense[];
  petty: PettyEntry[];
  load: () => Promise<void>;
  addExpense: (e: Omit<Expense, "id" | "number">) => Promise<Expense>;
  removeExpense: (id: string) => void;
  addPetty: (p: Omit<PettyEntry, "id" | "date">) => void;
}

export const useExpenses = create<State>()((set) => ({
  ready: false,
  expenses: [],
  petty: [],

  load: async () => {
    const sb = supabase();
    const [e, p] = await Promise.all([sb.from("expenses").select("*").order("spent_on", { ascending: false }).range(0, 9999), sb.from("petty_cash").select("*").order("on_date").range(0, 9999)]);
    if (e.error) return set({ ready: false, expenses: [], petty: [] });
    if (p.error) return void toast.error("Could not load petty cash", { description: p.error.message });
    set({
      ready: true,
      expenses: (e.data as Row[]).map((r) => ({ id: r.id, number: r.number, orderId: r.order_id ?? undefined, category: r.category, amount: Number(r.amount), mode: r.mode, pettyHolder: r.petty_holder ?? undefined, paidTo: r.paid_to, note: r.note, photoPath: r.photo_path ?? undefined, date: String(r.spent_on).slice(0, 10) })),
      petty: (p.data as Row[]).map((r) => ({ id: r.id, holder: r.holder, kind: r.kind, amount: Number(r.amount), date: String(r.on_date).slice(0, 10), note: r.note })),
    });
  },

  addExpense: async (e) => {
    const saved = await write(async (sb) => {
      const res = await sb.rpc("next_doc_number", { p_doc_type: "expense", p_financial_year: financialYear() });
      if (res.error) throw new Error(res.error.message);
      const x: Expense = { ...e, id: uid(), number: `EXP/${financialYear()}/${String(res.data).padStart(4, "0")}` };
      await ok(sb.from("expenses").insert({ id: x.id, number: x.number, order_id: x.orderId ?? null, category: x.category, amount: x.amount, mode: x.mode, petty_holder: x.pettyHolder ?? null, paid_to: x.paidTo, note: x.note, photo_path: x.photoPath ?? null, spent_on: x.date, created_by: useStore.getState().currentUserId || null }), "Saving the expense");
      return x;
    });
    set((s) => ({ expenses: [saved, ...s.expenses] }));
    return saved;
  },
  removeExpense: (id) => {
    set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }));
    background((sb) => ok(sb.from("expenses").delete().eq("id", id), "Removing the expense"));
  },

  addPetty: (p) => {
    const saved: PettyEntry = { ...p, id: uid(), date: isoDate(new Date()) };
    set((s) => ({ petty: [...s.petty, saved] }));
    background((sb) => ok(sb.from("petty_cash").insert({ id: saved.id, holder: saved.holder, kind: saved.kind, amount: saved.amount, on_date: saved.date, note: saved.note }), "Saving petty cash"));
  },
}));
