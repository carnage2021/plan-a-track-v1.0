"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { PaxInput, MoneyInput } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { useStore } from "@/lib/store";
import { festivalsOn } from "@/lib/festivals";
import { tithiLabel } from "@/lib/tithi";
import { blankFunction } from "@/lib/draft";
import { useEventTypes } from "@/lib/event-types";
import { useFoodTypes } from "@/lib/services";
import type { Coordinator, Diet, Enquiry, EventFunction, LeadSource, TeamUser } from "@/lib/types";
import { useUi } from "@/lib/ui";
import { ServiceList } from "./service-fields";
import { addDays, fmtDate, isoDate, num } from "@/lib/utils";

const sources: { id: LeadSource; label: string }[] = [
  { id: "phone", label: "Phone call" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "walkin", label: "Walk-in" },
  { id: "website", label: "Website form" },
  { id: "referral", label: "Referral" },
];

/** Functions and guests already booked on a date. */
export function useDayLoad(date: string) {
  const orders = useStore((s) => s.orders);
  return React.useMemo(() => {
    const fns = orders.filter((o) => o.status !== "cancelled").flatMap((o) => o.functions).filter((f) => f.date === date);
    return { functions: fns.length, pax: fns.reduce((s, f) => s + f.pax, 0) };
  }, [orders, date]);
}

/** Whether a date already has functions, with that day's tithi. */
export function DateAvailability({ date }: { date: string; pax?: number }) {
  const load = useDayLoad(date);
  const locale = useStore((s) => s.locale);
  if (!date) return null;
  const tithi = tithiLabel(date, locale);
  const busy = load.functions > 0;
  const Icon = busy ? AlertTriangle : CheckCircle2;
  return (
    <p className={`mt-1 flex items-start gap-1.5 text-xs ${busy ? "text-warning" : "text-success"}`}>
      <Icon className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
      <span className="tnum">
        {busy ? `${load.functions} ${load.functions === 1 ? "function" : "functions"} already on ${fmtDate(date, { day: "numeric", month: "short" })}, ${num(load.pax)} guests.` : "Date is free."}
        <span className={tithi.special ? "font-medium text-accent-gold" : "text-text-muted"}> {tithi.short}</span>
        {festivalsOn(date).length > 0 && <span className="font-semibold text-accent-gold"> · {festivalsOn(date).join(", ")}</span>}
      </span>
    </p>
  );
}

type Form = Omit<Enquiry, "id" | "createdAt" | "clientId" | "services"> & { name: string; phone: string; services: EventFunction[]; email: string; altPhone: string; address: string };

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
  const updateClientContact = useStore((s) => s.updateClientContact);
  const contactsReady = useStore((s) => s.contactsReady);
  const saveEnquiry = useStore((s) => s.saveEnquiry);
  const foodTypes = useFoodTypes();
  const eventTypes = useEventTypes();

  const blank = React.useCallback(
    (): Form => ({
      name: "",
      phone: "",
      eventType: eventTypes[0],
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
      services: [blankFunction("", date ?? "", 200, "")],
      email: "",
      altPhone: "",
      address: "",
    }),
    [date, users, currentUserId, eventTypes],
  );
  const [form, setForm] = React.useState<Form>(() =>
    existing
      ? // An enquiry saved before services existed becomes one service on its date.
        { ...existing, name: client?.name ?? "", phone: client?.phone ?? "", email: client?.email ?? "", altPhone: client?.altPhone ?? "", address: client?.address ?? "", services: existing.services?.length ? existing.services : [blankFunction(existing.eventType, existing.date, existing.pax, existing.venue)] }
      : blank(),
  );
  const [touched, setTouched] = React.useState(false);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  /** Changing the event's dates keeps every service inside them. */
  const setDates = (start: string, end: string | undefined) =>
    setForm((f) => {
      const last = end && end > start ? end : start;
      return { ...f, date: start, endDate: end && end > start ? end : undefined, services: f.services.map((x) => (!x.date || x.date < start || x.date > last ? { ...x, date: start } : x)) };
    });
  /** Guests and venue for the event flow into the services that still have the event's old value. */
  const setShared = (key: "pax" | "venue", value: number | string) =>
    setForm((f) => ({ ...f, [key]: value, services: f.services.map((x) => (x[key] === f[key] ? { ...x, [key]: value } : x)) }));
  const errors = {
    name: form.name.trim() ? "" : "Enter the client's name",
    phone: form.phone.replace(/\D/g, "").length >= 10 ? "" : "Enter a 10-digit mobile number",
    date: form.date ? "" : "Pick the event date",
    services: form.services.every((x) => x.date) ? "" : "Every service needs a date",
    email: !form.email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) ? "" : "Check the email address",
    altPhone: !form.altPhone.trim() || form.altPhone.replace(/\D/g, "").length >= 10 ? "" : "Enter a 10-digit number, or leave it empty",
  };
  const valid = !errors.name && !errors.phone && !errors.date && !errors.services && !errors.email && !errors.altPhone;

  const save = () => {
    setTouched(true);
    if (!valid) return;
    const { name, phone, services, email, altPhone, address, ...rest } = form;
    const clientId = existing?.clientId ?? ensureClient(name, phone);
    updateClientContact(clientId, { email, altPhone, address });
    // A service with no name takes its food type's name.
    const named = services.map((x, i) => ({ ...x, name: x.name.trim() || foodTypes.find((t) => t.id === x.foodTypeId)?.name || `Service ${i + 1}` }));
    saveEnquiry({ ...rest, services: named, clientId, id: existing?.id });
    close();
    toast.success(existing ? "Enquiry updated" : "Enquiry saved", { description: `${name} · ${form.eventType} · ${fmtDate(form.date)}` });
  };

  return (
    <Sheet
      full
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
          <ContactFields value={form} onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} users={users} ready={contactsReady} errors={touched ? errors : undefined} />
          <Field label="Event type">
            <Select value={form.eventType} onChange={(e) => set("eventType", e.target.value)}>
              {withCurrent(eventTypes, form.eventType).map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Venue">
            <Input value={form.venue} onChange={(e) => setShared("venue", e.target.value)} placeholder="Hall, club or home address" />
          </Field>
          <Field label="Event start date" error={touched ? errors.date : ""}>
            <Input type="date" value={form.date} min={isoDate(new Date())} onChange={(e) => setDates(e.target.value, form.endDate)} />
          </Field>
          <Field label="Event end date" hint="Same as the start for a one-day event.">
            <Input type="date" value={form.endDate ?? form.date} min={form.date || isoDate(new Date())} onChange={(e) => setDates(form.date, e.target.value)} />
          </Field>
        </div>
        <div>
          <span className="mb-1 block text-xs font-medium text-text-muted">Expected guests</span>
          <PaxInput value={form.pax} onChange={(v) => setShared("pax", v)} />
        </div>
        <section>
          <h3 className="font-heading text-base font-semibold">Catering services</h3>
          <p className="mb-3 text-xs text-text-muted">One for each meal or counter, with its own food type and timings. Two on the same day is fine, such as welcome drinks at 6 pm and dinner at 9 pm.</p>
          {touched && errors.services && <p className="mb-2 text-xs text-danger">{errors.services}</p>}
          <ServiceList value={form.services} onChange={(services) => set("services", services)} start={form.date} end={form.endDate} fallback={{ date: form.date, pax: form.pax, venue: form.venue }} showErrors={touched} />
        </section>
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

/**
 * Email, second number and home address of the client, and the team member coordinating with them. Shared by
 * the enquiry form and the quotation and booking forms.
 */
export function ContactFields({ value, onChange, users, ready, errors }: { value: { email?: string; altPhone?: string; address?: string; coordinatorId?: string; coordinator?: Coordinator }; onChange: (patch: { email?: string; altPhone?: string; address?: string; coordinatorId?: string; coordinator?: Coordinator }) => void; users: TeamUser[]; ready: boolean; errors?: { email?: string; altPhone?: string } }) {
  const team = users.filter((u) => !u.invited);
  const listId = React.useId();
  const co = coordinatorOf(value, users) ?? { name: "", phone: "", email: "" };
  return (
    <>
      <Field label="Email" error={errors?.email} className="col-span-2 sm:col-span-1">
        <Input type="email" inputMode="email" value={value.email ?? ""} onChange={(e) => onChange({ email: e.target.value })} placeholder="client@example.com" />
      </Field>
      <Field label="Alternate number" error={errors?.altPhone} className="col-span-2 sm:col-span-1" hint={ready ? undefined : "Saved once the 0016 database update is run."}>
        <Input inputMode="tel" value={value.altPhone ?? ""} onChange={(e) => onChange({ altPhone: e.target.value })} placeholder="Another number to reach them" />
      </Field>
      <Field label="Residential address" className="col-span-2">
        <Textarea rows={2} value={value.address ?? ""} onChange={(e) => onChange({ address: e.target.value })} placeholder="House, society, area, city" />
      </Field>
      <Field label="Coordinator name" className="col-span-2 sm:col-span-1" hint={ready ? "Type any name, or pick from your team." : "Saved once the 0016 database update is run."}>
        <Input
          list={listId}
          value={co.name}
          onChange={(e) => {
            // Picking a team member links them and fills their phone; any other name is kept as typed.
            const u = team.find((x) => x.name.toLowerCase() === e.target.value.trim().toLowerCase());
            onChange({ coordinatorId: u?.id, coordinator: { ...co, name: e.target.value, phone: u && !co.phone ? u.phone : co.phone } });
          }}
          placeholder="Type a name or pick from your team"
        />
        <datalist id={listId}>{team.map((u) => <option key={u.id} value={u.name}>{u.role === "owner" ? "owner" : roleLabel[u.role]}</option>)}</datalist>
      </Field>
      <Field label="Coordinator phone" className="col-span-2 sm:col-span-1">
        <Input inputMode="tel" value={co.phone} onChange={(e) => onChange({ coordinator: { ...co, phone: e.target.value } })} placeholder="Mobile number" />
      </Field>
      <Field label="Coordinator email" className="col-span-2 sm:col-span-1">
        <Input type="email" inputMode="email" value={co.email} onChange={(e) => onChange({ coordinator: { ...co, email: e.target.value } })} placeholder="coordinator@example.com" />
      </Field>
    </>
  );
}

const roleLabel: Record<TeamUser["role"], string> = { owner: "owner", sales: "sales", operations: "operations", kitchen: "kitchen", store: "store", accountant: "accounts" };

/** The account's event types, plus the one already chosen if it has since been removed from the list. */
export const withCurrent = (list: string[], current?: string) => (current && !list.includes(current) ? [current, ...list] : list);

export const leadSourceLabel = (s: LeadSource) => sources.find((x) => x.id === s)?.label ?? s;

/** The coordinator as saved, or, for records made before names could be typed, the linked team member. */
export function coordinatorOf(r: { coordinatorId?: string; coordinator?: Coordinator }, users: TeamUser[]): Coordinator | undefined {
  if (r.coordinator?.name.trim()) return r.coordinator;
  const u = users.find((x) => x.id === r.coordinatorId);
  return u ? { name: u.name, phone: u.phone, email: "" } : undefined;
}
