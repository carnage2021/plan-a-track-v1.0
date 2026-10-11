"use client";

import { Copy, Plus, ShieldAlert, Trash2 } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/shared/badges";
import { MoneyInput, PaxInput } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/primitives";
import { blankFunction } from "@/lib/draft";
import { marginTone, priceQuote } from "@/lib/pricing";
import { useCurrentUser, useStore } from "@/lib/store";
import type { QuoteDraft } from "@/lib/types";
import { cn, isoDate, money, uid } from "@/lib/utils";
import { DateAvailability, eventTypes } from "./enquiry-sheet";

type SetDraft = (patch: Partial<QuoteDraft> | ((d: QuoteDraft) => Partial<QuoteDraft>)) => void;

const functionNames: Record<string, string[]> = {
  Wedding: ["Haldi", "Mehndi", "Sangeet", "Wedding", "Reception"],
  Engagement: ["Engagement", "Dinner"],
  Corporate: ["Lunch", "High tea", "Dinner"],
};

/** Step 1: who the client is and which functions the event has. */
export function DetailsForm({ draft, setDraft, showErrors }: { draft: QuoteDraft; setDraft: SetDraft; showErrors?: boolean }) {
  const clients = useStore((s) => s.clients);
  const match = clients.find((c) => c.id === draft.clientId);
  const suggestions = draft.clientName.length >= 2 && !match ? clients.filter((c) => c.name.toLowerCase().includes(draft.clientName.toLowerCase())).slice(0, 4) : [];
  const setFn = (id: string, patch: Partial<QuoteDraft["functions"][number]>) => setDraft((d) => ({ functions: d.functions.map((f) => (f.id === id ? { ...f, ...patch } : f)) }));
  const names = functionNames[draft.eventType] ?? [];
  const unused = names.filter((n) => !draft.functions.some((f) => f.name === n));
  const last = draft.functions[draft.functions.length - 1];

  return (
    <div className="space-y-4">
      <Card className="p-4 md:p-5">
        <h2 className="font-heading text-base font-semibold">Client</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Client name" error={showErrors && !draft.clientName.trim() ? "Enter the client's name" : ""} className="relative">
            <Input value={draft.clientName} onChange={(e) => setDraft({ clientName: e.target.value, clientId: undefined })} placeholder="Rajesh Shah" autoComplete="off" />
            {suggestions.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border bg-surface shadow-sheet">
                {suggestions.map((c) => (
                  <li key={c.id}>
                    <button type="button" className="flex h-11 w-full items-center justify-between gap-2 px-3 text-left text-sm hover:bg-surface-muted" onClick={() => setDraft({ clientId: c.id, clientName: c.name, clientPhone: c.phone })}>
                      <span className="truncate">{c.name}</span><span className="tnum text-xs text-text-muted">{c.phone}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Field>
          <Field label="Mobile number" error={showErrors && draft.clientPhone.replace(/\D/g, "").length < 10 ? "Enter a 10-digit mobile number" : ""}>
            <Input inputMode="tel" value={draft.clientPhone} onChange={(e) => setDraft({ clientPhone: e.target.value })} placeholder="98250 12345" />
          </Field>
          <Field label="Event type">
            <Select value={draft.eventType} onChange={(e) => setDraft({ eventType: e.target.value })}>{eventTypes.map((t) => <option key={t}>{t}</option>)}</Select>
          </Field>
        </div>
        {match && <p className="mt-2 flex items-center gap-2 text-xs text-text-muted">Existing client{match.tags.map((t) => <Badge key={t} tone={t === "vip" ? "gold" : "info"}>{t === "vip" ? "VIP" : "Repeat client"}</Badge>)}</p>}
      </Card>

      {draft.functions.map((f, i) => (
        <Card key={f.id} className="p-4 md:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-base font-semibold">Function {i + 1}</h2>
            {draft.functions.length > 1 && (
              <Button variant="ghost" size="icon" aria-label={`Remove ${f.name}`} onClick={() => setDraft((d) => ({ functions: d.functions.filter((x) => x.id !== f.id) }))}><Trash2 strokeWidth={1.75} /></Button>
            )}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Field label="Function name" error={showErrors && !f.name.trim() ? "Give it a name" : ""}><Input value={f.name} onChange={(e) => setFn(f.id, { name: e.target.value })} placeholder="Wedding lunch" /></Field>
            <Field label="Date" error={showErrors && !f.date ? "Pick a date" : ""}><Input type="date" min={isoDate(new Date())} value={f.date} onChange={(e) => setFn(f.id, { date: e.target.value })} /></Field>
            <Field label="Serving time"><Input type="time" value={f.time} onChange={(e) => setFn(f.id, { time: e.target.value })} /></Field>
            <Field label="Venue"><Input value={f.venue} onChange={(e) => setFn(f.id, { venue: e.target.value })} placeholder="Hall or address" /></Field>
          </div>
          <DateAvailability date={f.date} pax={f.pax} />
          <div className="mt-3 max-w-md">
            <span className="mb-1 block text-xs font-medium text-text-muted">Guests</span>
            <PaxInput value={f.pax} onChange={(pax) => setFn(f.id, { pax })} />
          </div>
        </Card>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setDraft((d) => ({ functions: [...d.functions, blankFunction(unused[0] ?? `Function ${d.functions.length + 1}`, last?.date, last?.pax, last?.venue)] }))}><Plus strokeWidth={1.75} />Add a function</Button>
        {unused.slice(0, 4).map((n) => (
          <Button key={n} variant="ghost" onClick={() => setDraft((d) => ({ functions: [...d.functions, blankFunction(n, last?.date, last?.pax, last?.venue)] }))}><Plus strokeWidth={1.75} />{n}</Button>
        ))}
        {last && draft.functions.length === 1 && <span className="flex items-center gap-1 text-xs text-text-muted"><Copy className="size-3.5" strokeWidth={1.75} />New functions copy the date, venue and guests; menus can be copied in the next step.</span>}
      </div>
    </div>
  );
}

const extraPresets = ["Service staff", "Transport", "Crockery and cutlery", "Decor", "Live counter setup"];

/** Summary step: extra charges, discount with approval limit, GST and the total. */
export function SummaryForm({ draft, setDraft, hideMargin }: { draft: QuoteDraft; setDraft: SetDraft; hideMargin?: boolean }) {
  const tenant = useStore((s) => s.tenant);
  const items = useStore((s) => s.items);
  const packages = useStore((s) => s.packages);
  const user = useCurrentUser();
  const totals = React.useMemo(
    () => priceQuote({ ...draft, gstRate: tenant.gstRate, gstInclusive: tenant.gstInclusive }, items, packages, tenant.slabs),
    [draft, tenant, items, packages],
  );
  const needsApproval = totals.discountPct > tenant.discountApprovalPct;
  const setExtra = (id: string, patch: { label?: string; amount?: number }) => setDraft((d) => ({ extras: d.extras.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  const unusedPresets = extraPresets.filter((p) => !draft.extras.some((e) => e.label === p));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px] lg:items-start">
      <div className="space-y-4">
        <Card className="p-4 md:p-5">
          <h2 className="font-heading text-base font-semibold">Extra charges</h2>
          <p className="text-xs text-text-muted">Each one shows as its own line on the quotation.</p>
          <ul className="mt-3 space-y-2">
            {draft.extras.map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                <Input aria-label="Charge" value={e.label} onChange={(ev) => setExtra(e.id, { label: ev.target.value })} placeholder="What is it for" className="flex-1" />
                <MoneyInput value={e.amount} onChange={(amount) => setExtra(e.id, { amount })} className="w-32 shrink-0" />
                <Button variant="ghost" size="icon" aria-label={`Remove ${e.label || "charge"}`} onClick={() => setDraft((d) => ({ extras: d.extras.filter((x) => x.id !== e.id) }))}><Trash2 strokeWidth={1.75} /></Button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {unusedPresets.map((p) => (
              <Button key={p} variant="ghost" onClick={() => setDraft((d) => ({ extras: [...d.extras, { id: uid(), label: p, amount: 0 }] }))}><Plus strokeWidth={1.75} />{p}</Button>
            ))}
            <Button onClick={() => setDraft((d) => ({ extras: [...d.extras, { id: uid(), label: "", amount: 0 }] }))}><Plus strokeWidth={1.75} />Other charge</Button>
          </div>
        </Card>

        <Card className="p-4 md:p-5">
          <h2 className="font-heading text-base font-semibold">Discount</h2>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex shrink-0 rounded-lg border p-0.5">
              {(["amount", "percent"] as const).map((t) => (
                <button key={t} type="button" aria-pressed={draft.discount.type === t} onClick={() => setDraft({ discount: { type: t, value: 0 } })} className={cn("h-9 rounded-md px-3 text-sm font-medium md:h-8", draft.discount.type === t ? "bg-primary-soft text-primary" : "text-text-muted")}>
                  {t === "amount" ? "₹ Amount" : "% Percent"}
                </button>
              ))}
            </div>
            {draft.discount.type === "amount" ? (
              <MoneyInput value={draft.discount.value} onChange={(value) => setDraft({ discount: { type: "amount", value } })} className="w-40" />
            ) : (
              <Input aria-label="Discount percent" inputMode="decimal" className="tnum w-24" value={draft.discount.value || ""} placeholder="0" onChange={(e) => setDraft({ discount: { type: "percent", value: Math.min(100, Number(e.target.value.replace(/[^\d.]/g, "")) || 0) } })} />
            )}
          </div>
          {needsApproval && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-xs text-warning">
              <ShieldAlert className="size-4 shrink-0" strokeWidth={1.75} />
              {user.role === "owner"
                ? `This is ${totals.discountPct.toFixed(1)}% off, above the ${tenant.discountApprovalPct}% limit. As the owner you can send it.`
                : `This is ${totals.discountPct.toFixed(1)}% off. Anything above ${tenant.discountApprovalPct}% goes to the owner for approval before it can be sent.`}
            </p>
          )}
        </Card>
      </div>

      <Card className="p-4 md:p-5 lg:sticky lg:top-20">
        <h2 className="font-heading text-base font-semibold">Total</h2>
        <dl className="tnum mt-3 space-y-2 text-sm">
          {draft.functions.map((f) => {
            const one = priceQuote({ ...draft, functions: [f], extras: [], discount: { type: "amount", value: 0 }, gstRate: 0, gstInclusive: false }, items, packages, tenant.slabs);
            return <div key={f.id} className="flex justify-between gap-3"><dt className="min-w-0 truncate text-text-muted">{f.name} · {f.pax} guests</dt><dd>{money(one.food)}</dd></div>;
          })}
          {draft.extras.filter((e) => e.amount).map((e) => <div key={e.id} className="flex justify-between gap-3"><dt className="truncate text-text-muted">{e.label || "Other charge"}</dt><dd>{money(e.amount)}</dd></div>)}
          <div className="flex justify-between border-t pt-2"><dt>Subtotal</dt><dd>{money(totals.subtotal)}</dd></div>
          {totals.discount > 0 && <div className="flex justify-between text-success"><dt>Discount</dt><dd>-{money(totals.discount)}</dd></div>}
          <div className="flex justify-between text-text-muted"><dt>GST {tenant.gstRate}%{tenant.gstInclusive ? " (included)" : ""}</dt><dd>{money(totals.gst)}</dd></div>
          <div className="flex items-baseline justify-between border-t pt-3"><dt className="font-medium">Grand total</dt><dd className="font-heading text-2xl font-bold">{money(totals.grand)}</dd></div>
        </dl>
        {!hideMargin && (
          <div className="tnum mt-4 flex items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2 text-xs">
            <span className="text-text-muted">Staff only · food cost {money(totals.cost)}</span>
            <Badge tone={marginTone(totals.marginPct)}>{Math.round(totals.marginPct)}% margin</Badge>
          </div>
        )}
      </Card>
    </div>
  );
}

export function useDraftTotals(draft: QuoteDraft) {
  const tenant = useStore((s) => s.tenant);
  const items = useStore((s) => s.items);
  const packages = useStore((s) => s.packages);
  return React.useMemo(() => {
    const totals = priceQuote({ ...draft, gstRate: tenant.gstRate, gstInclusive: tenant.gstInclusive }, items, packages, tenant.slabs);
    return { totals, needsApproval: totals.discountPct > tenant.discountApprovalPct };
  }, [draft, tenant, items, packages]);
}
