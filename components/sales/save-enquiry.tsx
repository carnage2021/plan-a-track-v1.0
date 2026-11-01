"use client";

import { MessagesSquare } from "lucide-react";
import * as React from "react";
import { MoneyInput } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/sheet";
import { namedServices } from "@/lib/draft";
import { eventSpan } from "@/lib/services";
import { useStore } from "@/lib/store";
import type { Diet, Enquiry, LeadSource, QuoteDraft } from "@/lib/types";
import { addDays, isoDate } from "@/lib/utils";
import { sources } from "./enquiry-sheet";

type Extra = Pick<Enquiry, "budgetPerPlate" | "foodPref" | "source" | "assignedTo" | "followUpAt" | "notes">;

/**
 * Booking mode's first step saved as an enquiry: the client, event and services from the step, plus the lead details
 * only an enquiry needs (budget, food preference, source, who follows up and when, notes), asked for here. Saving an
 * enquiry that was continued updates it instead of making a second one. Returns the enquiry's id.
 */
export function SaveEnquiry({ open, onOpenChange, draft, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; draft: QuoteDraft; onSaved: (id: string, updated: boolean) => void }) {
  const users = useStore((s) => s.users);
  const me = useStore((s) => s.currentUserId);
  const existing = useStore((s) => s.enquiries.find((e) => e.id === draft.enquiryId));
  const ensureClient = useStore((s) => s.ensureClient);
  const updateClientContact = useStore((s) => s.updateClientContact);
  const saveEnquiry = useStore((s) => s.saveEnquiry);
  const fresh = (): Extra => ({ budgetPerPlate: existing?.budgetPerPlate ?? 0, foodPref: existing?.foodPref ?? "veg", source: existing?.source ?? "phone", assignedTo: existing?.assignedTo ?? me, followUpAt: existing ? existing.followUpAt : isoDate(addDays(new Date(), 1)), notes: existing?.notes ?? "" });
  const [form, setForm] = React.useState<Extra>(fresh);
  const set = <K extends keyof Extra>(key: K, value: Extra[K]) => setForm((f) => ({ ...f, [key]: value }));
  const sellers = users.filter((u) => !u.invited && (u.role === "sales" || u.role === "owner"));

  const save = () => {
    const clientId = ensureClient(draft.clientName, draft.clientPhone, draft.clientId);
    updateClientContact(clientId, { email: draft.clientEmail, altPhone: draft.clientAltPhone, address: draft.clientAddress });
    const span = eventSpan(draft.functions);
    const start = draft.startDate || span.start;
    const end = draft.endDate || span.end;
    // The services carry no menu yet; the menu is chosen when the booking is continued.
    const services = namedServices(draft.functions).map((f) => ({ ...f, itemIds: [], itemNotes: undefined, itemPrices: undefined, itemPax: undefined }));
    const id = saveEnquiry({
      ...form,
      id: existing?.id,
      clientId,
      eventType: draft.eventType,
      date: start,
      endDate: end > start ? end : undefined,
      venue: services[0]?.venue ?? "",
      pax: Math.max(0, ...services.map((s) => s.pax || 0)),
      stage: existing && existing.stage !== "lost" ? existing.stage : "new",
      lostReason: undefined,
      services,
      coordinatorId: draft.coordinatorId,
      coordinator: draft.coordinator,
    });
    onSaved(id, !!existing);
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (o) setForm(fresh());
        onOpenChange(o);
      }}
      title={existing ? "Update the enquiry" : "Save as enquiry"}
      description="The client, event and services are saved from this step. These lead details are optional."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" onClick={save}><MessagesSquare strokeWidth={1.75} />{existing ? "Update enquiry" : "Save enquiry"}</Button>
        </>
      }
    >
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
            {sellers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
        </Field>
        <Field label="Next follow-up" className="col-span-2">
          <Input type="date" value={form.followUpAt ?? ""} onChange={(e) => set("followUpAt", e.target.value || undefined)} />
        </Field>
        <Field label="Notes" className="col-span-2">
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Special requests, who else they are talking to" />
        </Field>
      </div>
    </Modal>
  );
}
