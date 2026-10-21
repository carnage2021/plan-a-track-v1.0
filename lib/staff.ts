"use client";

import { toast } from "sonner";
import { create } from "zustand";
import { background } from "./queue";
import { useStore } from "./store";
import { supabase } from "./supabase/client";
import type { EventFunction, PaymentMode } from "./types";
import { isoDate, uid } from "./utils";
import { inBranch, withBranch } from "./branch";

// Phase 4A: workers, priced tasks, attendance, payouts and monthly payroll.
// Types, calculations and the store live together here; tables are in supabase/migrations/0004_staff.sql.

export type WorkerType = "salaried" | "daily" | "contractor";
export type TaskStatus = "assigned" | "accepted" | "in_progress" | "done" | "verified";

export interface Worker {
  id: string;
  name: string;
  phone: string;
  role: string;
  type: WorkerType;
  contractorId?: string;
  skills: string[];
  rateDay: number;
  rateEvent: number;
  overtimeRate: number;
  monthlySalary: number;
  idProof: string;
  upi: string;
  rating: number;
  active: boolean;
}
export interface Leave { id: string; workerId: string; date: string; paid: boolean }
export interface Task {
  id: string;
  orderId: string;
  functionId: string;
  title: string;
  role: string;
  workerId?: string;
  /** Set when the task is a named chef cooking one dish */
  itemId?: string;
  startTime: string;
  dueTime: string;
  priority: "low" | "normal" | "high";
  status: TaskStatus;
  qty: number;
  rate: number;
  overtimeHours: number;
  checkedInAt?: string;
  notes: string;
}
export interface WorkerPayment { id: string; workerId?: string; contractorId?: string; kind: "advance" | "payout" | "salary"; amount: number; mode: PaymentMode; date: string; note: string }
export interface SalarySlip { id: string; workerId: string; month: string; base: number; unpaidDays: number; allowance: number; bonus: number; deduction: number; advanceRecovery: number; net: number; paidOn?: string }

export const workerRoles = ["Cook", "Helper", "Waiter", "Bai", "Counter staff", "Cleaner", "Supervisor", "Driver"];
export const statusFlow: TaskStatus[] = ["assigned", "accepted", "in_progress", "done", "verified"];
export const statusLabel: Record<TaskStatus, string> = { assigned: "Assigned", accepted: "Accepted", in_progress: "In progress", done: "Done", verified: "Verified" };
export const typeLabel: Record<WorkerType, string> = { salaried: "Salaried", daily: "Daily wage", contractor: "Contractor" };

/** Task list a function starts with, and how many people each line needs for the guest count. */
export const taskTemplate: { title: string; role: string; per: number; min: number }[] = [
  { title: "Cooking", role: "Cook", per: 150, min: 1 },
  { title: "Prep and kitchen help", role: "Helper", per: 100, min: 1 },
  { title: "Service", role: "Waiter", per: 25, min: 2 },
  { title: "Counter service", role: "Counter staff", per: 200, min: 1 },
  { title: "Washing and cleanup", role: "Bai", per: 150, min: 1 },
  { title: "Supervision", role: "Supervisor", per: 500, min: 1 },
  { title: "Loading and transport", role: "Driver", per: 600, min: 1 },
];
export const suggestedHeadcount = (pax: number) => taskTemplate.map((t) => ({ ...t, count: Math.max(t.min, Math.ceil(pax / t.per)) }));

export const taskAmount = (t: Task, workers: Worker[]) => t.qty * t.rate + t.overtimeHours * (workers.find((w) => w.id === t.workerId)?.overtimeRate ?? 0);
export const defaultRate = (w?: Worker) => (w ? w.rateEvent || w.rateDay : 0);

/** What a non-salaried worker has earned from finished tasks, against advances and payouts. */
export function workerBalance(workerId: string, tasks: Task[], payments: WorkerPayment[], workers: Worker[]) {
  const earned = tasks.filter((t) => t.workerId === workerId && (t.status === "done" || t.status === "verified")).reduce((s, t) => s + taskAmount(t, workers), 0);
  const mine = payments.filter((p) => p.workerId === workerId && p.kind !== "salary");
  const advance = mine.filter((p) => p.kind === "advance").reduce((s, p) => s + p.amount, 0);
  const paid = mine.filter((p) => p.kind === "payout").reduce((s, p) => s + p.amount, 0);
  return { earned, advance, paid, balance: earned - advance - paid, tasks: tasks.filter((t) => t.workerId === workerId && (t.status === "done" || t.status === "verified")).length };
}

/** Net salary for a month: base, less unpaid leave at one thirtieth a day, plus and minus the adjustments. */
export function netSalary(s: Pick<SalarySlip, "base" | "unpaidDays" | "allowance" | "bonus" | "deduction" | "advanceRecovery">) {
  return Math.max(0, Math.round(s.base - (s.base / 30) * s.unpaidDays + s.allowance + s.bonus - s.deduction - s.advanceRecovery));
}

/** Reasons a worker should not be put on a function on this date: on leave, or already on another event. */
export function clashFor(workerId: string, fn: Pick<EventFunction, "id" | "date">, orderId: string, tasks: Task[], leaves: Leave[]) {
  if (leaves.some((l) => l.workerId === workerId && l.date === fn.date)) return "On leave that day";
  const dates = new Map(useStore.getState().orders.flatMap((o) => o.functions.map((f) => [f.id, { date: f.date, orderId: o.id }] as const)));
  const other = tasks.find((t) => t.workerId === workerId && t.orderId !== orderId && dates.get(t.functionId)?.date === fn.date);
  if (!other) return "";
  const s = useStore.getState();
  const order = s.orders.find((o) => o.id === other.orderId);
  return `Already on ${s.clients.find((c) => c.id === order?.clientId)?.name ?? "another event"} that day`;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come back untyped from PostgREST */
type Row = Record<string, any>;
const day = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : "");
const workerRow = (w: Worker): Row => ({ id: w.id, name: w.name, phone: w.phone, role: w.role, worker_type: w.type, contractor_id: w.contractorId ?? null, skills: w.skills, rate_day: w.rateDay, rate_event: w.rateEvent, overtime_rate: w.overtimeRate, monthly_salary: w.monthlySalary, id_proof: w.idProof, upi: w.upi, rating: w.rating, active: w.active });
const taskRow = (t: Task): Row => ({ id: t.id, order_id: t.orderId, function_id: t.functionId, title: t.title, role: t.role, worker_id: t.workerId ?? null, item_id: t.itemId ?? null, start_time: t.startTime, due_time: t.dueTime, priority: t.priority, status: t.status, qty: t.qty, rate: t.rate, overtime_hours: t.overtimeHours, checked_in_at: t.checkedInAt ?? null, notes: t.notes });
const slipRow = (s: SalarySlip): Row => ({ id: s.id, worker_id: s.workerId, month: s.month, base: s.base, unpaid_days: s.unpaidDays, allowance: s.allowance, bonus: s.bonus, deduction: s.deduction, advance_recovery: s.advanceRecovery, net: s.net, paid_on: s.paidOn ?? null });
async function ok(query: PromiseLike<{ error: { message: string } | null }>, what: string) {
  const { error } = await query;
  if (error) throw new Error(`${what}: ${error.message}`);
}

interface State {
  /** False until supabase/migrations/0004_staff.sql has been run. */
  ready: boolean;
  workers: Worker[];
  leaves: Leave[];
  tasks: Task[];
  payments: WorkerPayment[];
  slips: SalarySlip[];
  load: () => Promise<void>;
  saveWorker: (w: Omit<Worker, "id"> & { id?: string }) => string;
  toggleLeave: (workerId: string, date: string, paid: boolean) => void;
  addTasks: (tasks: Omit<Task, "id">[]) => void;
  patchTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;
  addPayment: (p: Omit<WorkerPayment, "id" | "date">) => void;
  saveSlip: (s: Omit<SalarySlip, "id" | "net"> & { id?: string }, pay?: PaymentMode) => void;
}

const empty = { workers: [], leaves: [], tasks: [], payments: [], slips: [] };

export const useStaff = create<State>()((set, get) => ({
  ...empty,
  ready: false,

  load: async () => {
    const sb = supabase();
    const all = (table: string, order: string) => sb.from(table).select("*").order(order).range(0, 9999);
    const [workers, leaves, tasks, payments, slips] = await Promise.all([all("workers", "name"), all("worker_leaves", "leave_date"), all("tasks", "created_at"), all("worker_payments", "created_at"), all("salary_slips", "month")]);
    if (workers.error) return set({ ...empty, ready: false });
    const failed = [leaves, tasks, payments, slips].find((r) => r.error);
    if (failed) return void toast.error("Could not load staff and tasks", { description: failed.error?.message });
    set({
      ready: true,
      workers: (workers.data as Row[]).filter(inBranch).map((w) => ({ id: w.id, name: w.name, phone: w.phone, role: w.role, type: w.worker_type, contractorId: w.contractor_id ?? undefined, skills: w.skills ?? [], rateDay: Number(w.rate_day), rateEvent: Number(w.rate_event), overtimeRate: Number(w.overtime_rate), monthlySalary: Number(w.monthly_salary), idProof: w.id_proof, upi: w.upi, rating: w.rating, active: w.active })),
      leaves: (leaves.data as Row[]).map((l) => ({ id: l.id, workerId: l.worker_id, date: day(l.leave_date), paid: l.paid })),
      tasks: (tasks.data as Row[]).map((t) => ({ id: t.id, orderId: t.order_id, functionId: t.function_id ?? "", title: t.title, role: t.role, workerId: t.worker_id ?? undefined, itemId: t.item_id ?? undefined, startTime: t.start_time, dueTime: t.due_time, priority: t.priority, status: t.status, qty: Number(t.qty), rate: Number(t.rate), overtimeHours: Number(t.overtime_hours), checkedInAt: t.checked_in_at ?? undefined, notes: t.notes })),
      payments: (payments.data as Row[]).map((p) => ({ id: p.id, workerId: p.worker_id ?? undefined, contractorId: p.contractor_id ?? undefined, kind: p.kind, amount: Number(p.amount), mode: p.mode, date: day(p.paid_on), note: p.note })),
      slips: (slips.data as Row[]).map((s) => ({ id: s.id, workerId: s.worker_id, month: s.month, base: Number(s.base), unpaidDays: Number(s.unpaid_days), allowance: Number(s.allowance), bonus: Number(s.bonus), deduction: Number(s.deduction), advanceRecovery: Number(s.advance_recovery), net: Number(s.net), paidOn: s.paid_on ? day(s.paid_on) : undefined })),
    });
  },

  saveWorker: (w) => {
    const saved: Worker = { ...w, id: w.id ?? uid() };
    set((s) => ({ workers: w.id ? s.workers.map((x) => (x.id === saved.id ? saved : x)) : [...s.workers, saved].sort((a, b) => a.name.localeCompare(b.name)) }));
    background((sb) => ok(sb.from("workers").upsert(w.id ? workerRow(saved) : withBranch(workerRow(saved))), "Saving the worker"));
    return saved.id;
  },

  toggleLeave: (workerId, date, paid) => {
    const existing = get().leaves.find((l) => l.workerId === workerId && l.date === date);
    if (existing && existing.paid === paid) {
      set((s) => ({ leaves: s.leaves.filter((l) => l.id !== existing.id) }));
      return background((sb) => ok(sb.from("worker_leaves").delete().eq("id", existing.id), "Removing the leave"));
    }
    const leave = { id: existing?.id ?? uid(), workerId, date, paid };
    set((s) => ({ leaves: [...s.leaves.filter((l) => l.id !== leave.id), leave] }));
    background((sb) => ok(sb.from("worker_leaves").upsert({ id: leave.id, worker_id: workerId, leave_date: date, paid }), "Saving the leave"));
  },

  addTasks: (tasks) => {
    const saved = tasks.map((t) => ({ ...t, id: uid() }));
    if (!saved.length) return;
    set((s) => ({ tasks: [...s.tasks, ...saved] }));
    background((sb) => ok(sb.from("tasks").insert(saved.map(taskRow)), "Saving tasks"));
  },
  patchTask: (id, patch) => {
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
    const saved = get().tasks.find((t) => t.id === id);
    if (saved) background((sb) => ok(sb.from("tasks").update(taskRow(saved)).eq("id", id), "Saving the task"));
  },
  removeTask: (id) => {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    background((sb) => ok(sb.from("tasks").delete().eq("id", id), "Removing the task"));
  },

  addPayment: (p) => {
    const saved: WorkerPayment = { ...p, id: uid(), date: isoDate(new Date()) };
    set((s) => ({ payments: [...s.payments, saved] }));
    background((sb) => ok(sb.from("worker_payments").insert({ id: saved.id, worker_id: saved.workerId ?? null, contractor_id: saved.contractorId ?? null, kind: saved.kind, amount: saved.amount, mode: saved.mode, paid_on: saved.date, note: saved.note }), "Saving the payment"));
  },

  saveSlip: (slip, pay) => {
    const existing = get().slips.find((s) => s.workerId === slip.workerId && s.month === slip.month);
    const saved: SalarySlip = { ...slip, id: existing?.id ?? slip.id ?? uid(), net: netSalary(slip), paidOn: pay ? isoDate(new Date()) : (existing?.paidOn ?? slip.paidOn) };
    set((s) => ({ slips: [...s.slips.filter((x) => x.id !== saved.id), saved] }));
    background((sb) => ok(sb.from("salary_slips").upsert(slipRow(saved)), "Saving the salary slip"));
    if (pay && saved.net > 0) get().addPayment({ workerId: saved.workerId, kind: "salary", amount: saved.net, mode: pay, note: `Salary ${saved.month}` });
  },
}));

/** A small, realistic crew so the screens can be tried before real workers are entered. */
export const sampleWorkers: Omit<Worker, "id">[] = [
  ["Ramesh Maharaj", "Cook", "salaried", 0, 0, 150, 32000, ["Punjabi", "Tandoor"]],
  ["Dinesh Rathod", "Cook", "salaried", 0, 0, 120, 26000, ["Gujarati", "Sweets"]],
  ["Kiran Solanki", "Supervisor", "salaried", 0, 0, 120, 28000, ["Service captain"]],
  ["Mahesh Vaghela", "Cook", "daily", 1400, 1800, 150, 0, ["Chaat", "Live counter"]],
  ["Savita Ben", "Bai", "daily", 500, 650, 60, 0, []],
  ["Kokila Ben", "Bai", "daily", 500, 650, 60, 0, []],
  ["Raju Thakor", "Helper", "daily", 600, 750, 70, 0, []],
  ["Vijay Parmar", "Helper", "daily", 600, 750, 70, 0, []],
  ["Sunil Chauhan", "Waiter", "contractor", 550, 700, 70, 0, []],
  ["Ajay Makwana", "Waiter", "contractor", 550, 700, 70, 0, []],
  ["Imran Shaikh", "Counter staff", "daily", 700, 900, 80, 0, ["Live counter"]],
  ["Bharat Desai", "Driver", "daily", 900, 1200, 100, 0, []],
].map(([name, role, type, rateDay, rateEvent, overtimeRate, monthlySalary, skills], i) => ({ name, role, type, rateDay, rateEvent, overtimeRate, monthlySalary, skills, phone: `98250 9${String(1000 + i * 37).slice(0, 4)}`, idProof: "", upi: "", rating: 4, active: true }) as Omit<Worker, "id">);
