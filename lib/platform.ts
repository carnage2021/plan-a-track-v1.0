"use client";

import { create } from "zustand";
import { write } from "./queue";
import { useStore } from "./store";
import { supabase } from "./supabase/client";
import { daysFromToday, isoDate, localDay } from "./utils";

// Phase 7, the caterer's side of the platform: their plan and its limits, subscription invoices,
// support tickets, announcements and the changelog. Tables are in 0010_platform.sql.

export interface Plan {
  id: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  firstYearPrice?: number;
  includedUsers: number;
  extraUserPrice: number;
  eventsPerMonth: number;
  branches: number;
  storageMb: number;
  modules: string[];
  addons: { key: string; label: string; price: number }[];
  active: boolean;
}
export interface SubInvoice { id: string; number: string; description: string; periodStart: string; periodEnd: string; amount: number; gst: number; total: number; status: string; paidOn?: string }
export interface Ticket { id: string; subject: string; body: string; status: "open" | "answered" | "closed"; reply?: string; repliedAt?: string; createdAt: string }
export interface Announcement { id: string; message: string; tone: "info" | "warning" | "success" }
export interface Change { id: string; title: string; body: string; publishedOn: string }

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come back untyped from PostgREST */
type Row = Record<string, any>;
export const planFrom = (r: Row): Plan => ({ id: r.id, name: r.name, monthlyPrice: Number(r.monthly_price), annualPrice: Number(r.annual_price), firstYearPrice: r.first_year_price == null ? undefined : Number(r.first_year_price), includedUsers: r.included_users, extraUserPrice: Number(r.extra_user_price), eventsPerMonth: r.events_per_month, branches: r.branches, storageMb: r.storage_mb, modules: r.modules ?? [], addons: r.addons ?? [], active: r.active });

interface State {
  /** False until 0010_platform.sql has been run. */
  ready: boolean;
  plans: Plan[];
  invoices: SubInvoice[];
  tickets: Ticket[];
  announcements: Announcement[];
  changelog: Change[];
  load: () => Promise<void>;
  raiseTicket: (subject: string, body: string) => Promise<void>;
}

export const usePlatform = create<State>()((set) => ({
  ready: false,
  plans: [],
  invoices: [],
  tickets: [],
  announcements: [],
  changelog: [],

  load: async () => {
    const sb = supabase();
    const [plans, invoices, tickets, announcements, changelog] = await Promise.all([
      sb.from("plans").select("*").order("sort"),
      sb.from("subscription_invoices").select("*").order("period_start", { ascending: false }),
      sb.from("support_tickets").select("*").order("created_at", { ascending: false }),
      sb.from("announcements").select("*").order("created_at", { ascending: false }),
      sb.from("changelog").select("*").order("published_on", { ascending: false }).limit(30),
    ]);
    if ([plans, invoices, tickets, announcements, changelog].some((r) => r.error)) return set({ ready: false });
    set({
      ready: true,
      plans: (plans.data as Row[]).map(planFrom),
      invoices: (invoices.data as Row[]).map((r) => ({ id: r.id, number: r.number, description: r.description, periodStart: r.period_start, periodEnd: r.period_end, amount: Number(r.amount), gst: Number(r.gst), total: Number(r.total), status: r.status, paidOn: r.paid_on ?? undefined })),
      tickets: (tickets.data as Row[]).map((r) => ({ id: r.id, subject: r.subject, body: r.body, status: r.status, reply: r.reply ?? undefined, repliedAt: r.replied_at ?? undefined, createdAt: r.created_at })),
      announcements: (announcements.data as Row[]).map((r) => ({ id: r.id, message: r.message, tone: r.tone })),
      changelog: (changelog.data as Row[]).map((r) => ({ id: r.id, title: r.title, body: r.body, publishedOn: r.published_on })),
    });
  },

  raiseTicket: async (subject, body) => {
    const ticket = await write(async (sb) => {
      const { data, error } = await sb.from("support_tickets").insert({ subject, body }).select("*").single();
      if (error) throw new Error(error.message);
      return { id: data.id, subject, body, status: "open" as const, createdAt: data.created_at };
    });
    set((s) => ({ tickets: [ticket, ...s.tickets] }));
  },
}));

/** The caterer's plan, what it allows, and where the account stands. */
export function usePlan() {
  const sub = useStore((s) => s.tenant.subscription);
  const plans = usePlatform((s) => s.plans);
  const plan = plans.find((p) => p.id === sub?.planId);
  const trialLeft = sub?.trialEndsAt ? daysFromToday(localDay(sub.trialEndsAt)) : undefined;
  // Paused accounts and expired trials stop at a notice; overdue ones keep working with a warning.
  const blocked = !sub ? null : sub.status === "suspended" ? "suspended" : sub.status === "trial" && trialLeft !== undefined && trialLeft < 0 ? "trial_over" : null;
  return { sub, plan, trialLeft, blocked, seats: plan ? plan.includedUsers + (sub?.extraUsers ?? 0) : undefined };
}

/** Functions booked this month, counted against the plan's monthly event limit. */
export function eventsThisMonth() {
  const month = isoDate(new Date()).slice(0, 7);
  return useStore.getState().orders.filter((o) => o.status !== "cancelled" && o.createdAt.slice(0, 7) === month).length;
}
