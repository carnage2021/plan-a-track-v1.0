"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { PaxInput, MoneyInput } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { useStore } from "@/lib/store";
import type { Diet, Enquiry, LeadSource } from "@/lib/types";
import { useUi } from "@/lib/ui";
import { addDays, fmtDate, isoDate, num } from "@/lib/utils";

export const eventTypes = ["Wedding", "Engagement", "Reception", "Birthday", "Anniversary", "Baby Shower", "Housewarming", "Corporate", "Religious", "Other"];
const sources: { id: LeadSource; label: string }[] = [
  { id: "phone", label: "Phone call" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "walkin", label: "Walk-in" },
  { id: "website", label: "Website form" },
  { id: "referral", label: "Referral" },
];

/** Guests already booked on a date against the kitchen's daily capacity. */
export function useDayLoad(date: string) {
  const orders = useStore((s) => s.orders);
  const capacity = useStore((s) => s.tenant.dailyCapacityPax);
  return React.useMemo(() => {
    const pax = orders
      .filter((o) => o.status !== "cancelled")
      .flatMap((o) => o.functions)
      .filter((f) => f.date === date)
      .reduce((s, f) => s + f.pax, 0);
    return { pax, capacity, pct: capacity ? (pax / capacity) * 100 : 0 };
  }, [orders, capacity, date]);
}

export function DateAvailability({ date, pax = 0 }: { date: string; pax?: number }) {
  const load = useDayLoad(date);
  if (!date) return null;
  const full = load.pax + pax > load.capacity;
  const Icon = full ? AlertTriangle : CheckCircle2;
  return (
    <p className={`mt-1 flex items-start gap-1.5 text-xs ${full ? "text-danger" : load.pax ? "text-warning" : "text-success"}`}>
      <Icon className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
      <span className="tnum">
        {full
          ? `Over capacity: ${num(load.pax)} guests already booked, kitchen limit is ${num(load.capacity)}.`
          : load.pax
            ? `${num(load.pax)} of ${num(load.capacity)} guests already booked on ${fmtDate(date, { day: "numeric", month: "short" })}. There is room.`
            : "Date is free."}
      </span>
    </p>
  );
}

type Form = Omit<Enquiry, "id" | "createdAt" | "clientId"> & { name: string; phone: string };

/** Remounts each time it opens so the form starts from the enquiry being edited, or blank. */
export function EnquirySheet() {
  const { open, id } = useUi((s) => s.enquiry);
  return <EnquirySheetForm key={`${open}-${id ?? "new"}`} />;
}

function EnquirySheetForm() {
  const { open, id, date } = useUi((s) => s.enquiry);
  const close = useUi((s) => s.closeEnquiry);
  const existing = useStore((s) => s.enquiries.find((e) => e.id === id));
  const client = useStore((s) => s.clients.find((c) => c.id === existing?.clientId));
  const users = useStore((s) => s.users);
  const currentUserId = useStore((s) => s.currentUserId);
  const ensureClient = useStore((s) => s.ensureClient);
  const saveEnquiry = useStore((s) => s.saveEnquiry);

  const blank = React.useCallback(
    (): Form => ({
      name: "",
      phone: "",
      eventType: "Wedding",
      date: date ?? "",
      venue: "",
      pax: 200,
      budgetPerPlate: 0,
      foodPref: "veg",
      notes: "",
      source: "phone",
      stage: "new",
      assignedTo: users.find((u) => u.role === "sales" && !u.invited)?.id ?? currentUserId,
      followUpAt: isoDate(addDays(new Date(), 1)),
    }),
    [date, users, currentUserId],
  );
  const [form, setForm] = React.useState<Form>(() => (existing ? { ...existing, name: client?.name ?? "", phone: client?.phone ?? "" } : blank()));
  const [touched, setTouched] = React.useState(false);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const errors = {
    name: form.name.trim() ? "" : "Enter the client's name",
    phone: form.phone.replace(/\D/g, "").length >= 10 ? "" : "Enter a 10-digit mobile number",
    date: form.date ? "" : "Pick the event date",
  };
  const valid = !errors.name && !errors.phone && !errors.date;

  const save = () => {
    setTouched(true);
    if (!valid) return;
    const { name, phone, ...rest } = form;
    const clientId = existing?.clientId ?? ensureClient(name, phone);
    saveEnquiry({ ...rest, clientId, id: existing?.id });
    close();
    toast.success(existing ? "Enquiry updated" : "Enquiry saved", { description: `${name} · ${form.eventType} · ${fmtDate(form.date)}` });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && close()}
      title={existing ? "Edit enquiry" : "New enquiry"}
      description="Capture the lead now; the quotation comes next."
      footer={
        <>
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button variant="primary" onClick={save}>Save enquiry</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Client name" error={touched ? errors.name : ""} className="col-span-2 sm:col-span-1">
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Rajesh Shah" disabled={!!existing} />
          </Field>
          <Field label="Mobile number" error={touched ? errors.phone : ""} className="col-span-2 sm:col-span-1">
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" placeholder="98250 12345" disabled={!!existing} />
          </Field>
          <Field label="Event type">
            <Select value={form.eventType} onChange={(e) => set("eventType", e.target.value)}>
              {eventTypes.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Event date" error={touched ? errors.date : ""}>
            <Input type="date" value={form.date} min={isoDate(new Date())} onChange={(e) => set("date", e.target.value)} />
          </Field>
          <div className="col-span-2 -mt-2">
            <DateAvailability date={form.date} pax={form.pax} />
          </div>
          <Field label="Venue" className="col-span-2">
            <Input value={form.venue} onChange={(e) => set("venue", e.target.value)} placeholder="Hall, club or home address" />
          </Field>
        </div>
        <div>
          <span className="mb-1 block text-xs font-medium text-text-muted">Expected guests</span>
          <PaxInput value={form.pax} onChange={(v) => set("pax", v)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Budget per plate">
            <MoneyInput value={form.budgetPerPlate} onChange={(v) => set("budgetPerPlate", v)} />
          </Field>
          <Field label="Food preference">
            <Select value={form.foodPref} onChange={(e) => set("foodPref", e.target.value as Diet)}>
              <option value="veg">Vegetarian</option>
              <option value="jain">Jain</option>
              <option value="nonveg">Non-veg allowed</option>
            </Select>
          </Field>
          <Field label="Lead source">
            <Select value={form.source} onChange={(e) => set("source", e.target.value as LeadSource)}>
              {sources.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="Assigned to">
            <Select value={form.assignedTo} onChange={(e) => set("assignedTo", e.target.value)}>
              {users.filter((u) => !u.invited && (u.role === "sales" || u.role === "owner")).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
          <Field label="Next follow-up" className="col-span-2">
            <Input type="date" value={form.followUpAt ?? ""} onChange={(e) => set("followUpAt", e.target.value || undefined)} />
          </Field>
          <Field label="Notes" className="col-span-2">
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Functions, special requests, who else they are talking to" />
          </Field>
        </div>
      </div>
    </Sheet>
  );
}

export const leadSourceLabel = (s: LeadSource) => sources.find((x) => x.id === s)?.label ?? s;
