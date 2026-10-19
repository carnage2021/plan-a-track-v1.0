"use client";

import { create } from "zustand";
import { background } from "./queue";
import { useStore } from "./store";
import { supabase } from "./supabase/client";
import { uid } from "./utils";

// Phase 6: message templates, the log of everything sent, and greetings (plan F2).
// Messages go out by opening WhatsApp with the text ready; sending through the WhatsApp Business API
// needs a provider account and plugs in here later. Tables are in 0009_reports_messages_access.sql.

export type Audience = "client" | "vendor" | "worker" | "everyone";
export interface TemplateDef { key: string; label: string; audience: Audience; body: string }

/** Placeholders filled in when a message is sent: {client}, {business}, {event}, {order}, {amount}, {date}, {link}, {festival}. */
export const defaultTemplates: TemplateDef[] = [
  { key: "quotation", label: "Quotation", audience: "client", body: "Namaste {client}, here is your {event} quotation {order} from {business}. Total {amount}. Reply here to confirm or ask for changes." },
  { key: "confirmation", label: "Booking confirmation", audience: "client", body: "Dear {client}, your {event} booking {order} with {business} is confirmed for {date}. Thank you for choosing us." },
  { key: "receipt", label: "Payment receipt", audience: "client", body: "Dear {client}, we have received {amount} against {order}. Thank you. {business}" },
  { key: "reminder", label: "Payment reminder", audience: "client", body: "Dear {client}, a gentle reminder that {amount} for your {event} booking {order} is due on {date}. Thank you, {business}" },
  { key: "event_update", label: "Event-day update", audience: "client", body: "Dear {client}, our team is on the way to the venue for {event} on {date}. Your supervisor will call on arrival. {business}" },
  { key: "thank_you", label: "Thank you and feedback", audience: "client", body: "Dear {client}, thank you for having {business} at your {event}. We would love to hear how it went; a quick reply with your feedback means a lot to us." },
  { key: "festival", label: "Festival greeting", audience: "client", body: "Wishing you and your family a very happy {festival}! Warm regards, {business}" },
  { key: "birthday", label: "Birthday greeting", audience: "client", body: "Happy birthday, {client}! Wishing you a wonderful year ahead. From all of us at {business}" },
  { key: "anniversary", label: "Anniversary greeting", audience: "client", body: "Happy anniversary, {client}! Wishing you many more years of happiness. {business}" },
  { key: "offer", label: "Offer", audience: "client", body: "Dear {client}, book your next function with {business} this season and get a complimentary dessert counter. Reply to know more." },
  { key: "purchase_order", label: "Purchase order", audience: "vendor", body: "Namaste, please supply the items in purchase order {order} by {date}. {business}" },
  { key: "delivery_reminder", label: "Delivery reminder", audience: "vendor", body: "Namaste, a reminder that {order} is to be delivered on {date}. Please confirm. {business}" },
  { key: "payment_advice", label: "Payment advice", audience: "vendor", body: "Namaste, we have paid {amount} against your bills. {business}" },
  { key: "duty_reminder", label: "Duty reminder", audience: "worker", body: "Namaste {client}, reminder: you are on duty for {event} on {date}. Please report on time. {business}" },
  { key: "payout", label: "Payout done", audience: "worker", body: "Namaste {client}, {amount} has been paid to you. Thank you for your work. {business}" },
];

export const fillTemplate = (body: string, vars: Record<string, string>) => body.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);

export interface SentMessage { id: string; channel: "whatsapp" | "sms" | "email"; templateKey: string; name: string; phone: string; body: string; orderId?: string; status: string; at: string }

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come back untyped from PostgREST */
type Row = Record<string, any>;

interface State {
  /** False until 0009_reports_messages_access.sql has been run. */
  ready: boolean;
  overrides: Record<string, string>;
  log: SentMessage[];
  load: () => Promise<void>;
  template: (key: string) => string;
  saveTemplate: (key: string, body: string | null) => void;
  logSent: (m: Omit<SentMessage, "id" | "at" | "status" | "channel">) => void;
}

export const useMessages = create<State>()((set, get) => ({
  ready: false,
  overrides: {},
  log: [],

  load: async () => {
    const sb = supabase();
    const [t, m] = await Promise.all([sb.from("message_templates").select("key,body"), sb.from("messages").select("*").order("created_at", { ascending: false }).range(0, 999)]);
    if (t.error || m.error) return set({ ready: false, overrides: {}, log: [] });
    set({
      ready: true,
      overrides: Object.fromEntries((t.data as Row[]).map((r) => [r.key, r.body])),
      log: (m.data as Row[]).map((r) => ({ id: r.id, channel: r.channel, templateKey: r.template_key, name: r.recipient_name, phone: r.recipient_phone, body: r.body, orderId: r.order_id ?? undefined, status: r.status, at: r.created_at })),
    });
  },

  template: (key) => get().overrides[key] ?? defaultTemplates.find((t) => t.key === key)?.body ?? "",

  saveTemplate: (key, body) => {
    set((s) => {
      const overrides = { ...s.overrides };
      if (body === null) delete overrides[key];
      else overrides[key] = body;
      return { overrides };
    });
    background(async (sb) => {
      const { error } = body === null ? await sb.from("message_templates").delete().eq("key", key) : await sb.from("message_templates").upsert({ key, body, updated_at: new Date().toISOString() });
      if (error) throw new Error(`Saving the template: ${error.message}`);
    });
  },

  logSent: (m) => {
    if (!get().ready) return;
    const saved: SentMessage = { ...m, id: uid(), channel: "whatsapp", status: "opened", at: new Date().toISOString() };
    set((s) => ({ log: [saved, ...s.log] }));
    background(async (sb) => {
      const { error } = await sb.from("messages").insert({ id: saved.id, channel: "whatsapp", template_key: m.templateKey, recipient_name: m.name, recipient_phone: m.phone, body: m.body, order_id: m.orderId ?? null, created_by: useStore.getState().currentUserId || null });
      if (error) throw new Error(`Logging the message: ${error.message}`);
    });
  },
}));

/** Click handler for any "send on WhatsApp" link: records what was sent, to whom. */
export const logWhatsApp = (templateKey: string, name: string, phone: string, body: string, orderId?: string) => () => useMessages.getState().logSent({ templateKey, name, phone, body, orderId });
