"use client";

import { Copy, Plus, ShieldAlert, Trash2 } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/shared/badges";
import { MoneyInput } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/primitives";
import { marginTone, priceFunction, priceQuote } from "@/lib/pricing";
import { datesBetween, eventSpan } from "@/lib/services";
import { useCurrentUser, useStore } from "@/lib/store";
import type { QuoteDraft } from "@/lib/types";
import { cn, fmtDate, money, uid } from "@/lib/utils";
import { useEventTypes } from "@/lib/event-types";
import { ContactFields, withCurrent } from "./enquiry-sheet";
import { nextService, ServiceCard } from "./service-fields";
import { ExtraDishes, ReferralCard } from "./summary-extras";
import { byDay, EventCharges } from "./event-charges";

type SetDraft = (patch: Partial<QuoteDraft> | ((d: QuoteDraft) => Partial<QuoteDraft>)) => void;

const functionNames: Record<string, string[]> = {
  Wedding: ["Haldi", "Mehndi", "Sangeet", "Wedding", "Reception"],
  Engagement: ["Engagement", "Dinner"],
  Corporate: ["Lunch", "High tea", "Dinner"],
};

/** Step 1: who the client is and which functions the event has. */
export function DetailsForm({ draft, setDraft, showErrors }: { draft: QuoteDraft; setDraft: SetDraft; showErrors?: boolean }) {
  const clients = useStore((s) => s.clients);
  const users = useStore((s) => s.users);
  const eventTypes = useEventTypes();
  const contactsReady = useStore((s) => s.contactsReady);
  const match = clients.find((c) => c.id === draft.clientId);
  const suggestions = draft.clientName.length >= 2 && !match ? clients.filter((c) => c.name.toLowerCase().includes(draft.clientName.toLowerCase())).slice(0, 4) : [];
  const setFn = (id: string, patch: Partial<QuoteDraft["functions"][number]>) => setDraft((d) => ({ functions: d.functions.map((f) => (f.id === id ? { ...f, ...patch } : f)) }));
  const names = functionNames[draft.eventType] ?? [];
  const unused = names.filter((n) => !draft.functions.some((f) => f.name === n));
  const last = draft.functions[draft.functions.length - 1];
  const span = eventSpan(draft.functions);
  const fallback = { date: "", pax: 200, venue: "" };

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
                    <button type="button" className="flex h-11 w-full items-center justify-between gap-2 px-3 text-left text-sm hover:bg-surface-muted" onClick={() => setDraft({ clientId: c.id, clientName: c.name, clientPhone: c.phone, clientEmail: c.email ?? "", clientAltPhone: c.altPhone ?? "", clientAddress: c.address ?? "" })}>
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
            <Select value={draft.eventType} onChange={(e) => setDraft({ eventType: e.target.value })}>{withCurrent(eventTypes, draft.eventType).map((t) => <option key={t}>{t}</option>)}</Select>
          </Field>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <ContactFields
            value={{ email: draft.clientEmail, altPhone: draft.clientAltPhone, address: draft.clientAddress, coordinatorId: draft.coordinatorId }}
            onChange={(p) => setDraft({ ...("email" in p ? { clientEmail: p.email } : {}), ...("altPhone" in p ? { clientAltPhone: p.altPhone } : {}), ...("address" in p ? { clientAddress: p.address } : {}), ...("coordinatorId" in p ? { coordinatorId: p.coordinatorId } : {}) })}
            users={users}
            ready={contactsReady}
          />
        </div>
        {match && <p className="mt-2 flex items-center gap-2 text-xs text-text-muted">Existing client{match.tags.map((t) => <Badge key={t} tone={t === "vip" ? "gold" : "info"}>{t === "vip" ? "VIP" : "Repeat client"}</Badge>)}</p>}
      </Card>

      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <h2 className="font-heading text-base font-semibold">Catering services</h2>
        {span.start && <p className="tnum text-sm text-text-muted">Event {fmtDate(span.start, { day: "numeric", month: "short" })}{span.end > span.start ? ` to ${fmtDate(span.end, { day: "numeric", month: "short" })}, ${datesBetween(span.start, span.end).length} days` : ", one day"} · {draft.functions.length} {draft.functions.length === 1 ? "service" : "services"}</p>}
      </div>
      {draft.functions.map((f, i) => (
        <ServiceCard key={f.id} fn={f} index={i} onChange={(p) => setFn(f.id, p)} onRemove={draft.functions.length > 1 ? () => setDraft((d) => ({ functions: d.functions.filter((x) => x.id !== f.id) })) : undefined} showErrors={showErrors} />
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setDraft((d) => ({ functions: [...d.functions, { ...nextService(d.functions, fallback), name: unused[0] ?? "" }] }))}><Plus strokeWidth={1.75} />Add a service</Button>
        {unused.slice(0, 4).map((n) => (
          <Button key={n} variant="ghost" onClick={() => setDraft((d) => ({ functions: [...d.functions, { ...nextService(d.functions, fallback), name: n }] }))}><Plus strokeWidth={1.75} />{n}</Button>
        ))}
        {last && draft.functions.length === 1 && <span className="flex items-center gap-1 text-xs text-text-muted"><Copy className="size-3.5" strokeWidth={1.75} />A new service copies the date, venue and guests and starts after this one ends; menus can be copied in the next step.</span>}
      </div>
    </div>
  );
}

const extraPresets = ["Service staff", "Transport", "Crockery and cutlery", "Decor", "Live counter setup"];
/** Once staff and cutlery are priced per event, the booking-wide list keeps only the one-off charges. */
const bookingPresets = ["Transport", "Decor", "Live counter setup", "Generator"];

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
  const chargesReady = useStore((s) => s.chargesReady);
  const unusedPresets = (chargesReady ? bookingPresets : extraPresets).filter((p) => !draft.extras.some((e) => e.label === p));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px] lg:items-start">
      <div className="space-y-4">
        <ExtraDishes
          functions={draft.functions}
          onPrice={(fnId, itemId, price) =>
            setDraft((d) => ({
              functions: d.functions.map((f) => {
                if (f.id !== fnId) return f;
                const prices = { ...f.itemPrices };
                if (price === undefined) delete prices[itemId];
                else prices[itemId] = price;
                return { ...f, itemPrices: Object.keys(prices).length ? prices : undefined };
              }),
            }))
          }
        />

        {chargesReady ? <EventCharges draft={draft} setDraft={setDraft} /> : <p className="rounded-lg bg-warning/10 p-3 text-xs text-warning">Staff and cutlery for each event can be priced once the 0018 database update is run.</p>}

        <Card className="p-4 md:p-5">
          <h2 className="font-heading text-base font-semibold">{chargesReady ? "Charges for the whole booking" : "Extra charges"}</h2>
          <p className="text-xs text-text-muted">{chargesReady ? "One-off charges not tied to one event, like transport. Each shows as its own line on the quotation." : "Each one shows as its own line on the quotation."}</p>
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

        <ReferralCard draft={draft} setDraft={setDraft} totals={totals} />
      </div>

      <Card className="p-4 md:p-5 lg:sticky lg:top-20">
        <h2 className="font-heading text-base font-semibold">Total</h2>
        <dl className="tnum mt-3 space-y-2 text-sm">
          {byDay(draft.functions).map(([date, fns]) => (
            <React.Fragment key={date || "none"}>
              <div className="pt-1 text-xs font-semibold uppercase tracking-wide text-text-muted">{date ? fmtDate(date, { weekday: "short", day: "numeric", month: "short" }) : "No date yet"}</div>
              {fns.map((f) => <div key={f.id} className="flex justify-between gap-3 pl-2"><dt className="min-w-0 truncate text-text-muted">{f.name} · {f.pax} guests</dt><dd>{money(priceFunction(f, items, packages, tenant.slabs).eventTotal)}</dd></div>)}
            </React.Fragment>
          ))}
          {draft.extras.filter((e) => e.amount).map((e) => <div key={e.id} className="flex justify-between gap-3"><dt className="truncate text-text-muted">{e.label || "Other charge"}</dt><dd>{money(e.amount)}</dd></div>)}
          <div className="flex justify-between border-t pt-2"><dt>Subtotal</dt><dd>{money(totals.subtotal)}</dd></div>
          {totals.discount > 0 && <div className="flex justify-between text-success"><dt>Discount{draft.referralCode ? " (referral)" : ""}</dt><dd>-{money(totals.discount)}</dd></div>}
          {totals.credit > 0 && <div className="flex justify-between text-success"><dt>Referral credit</dt><dd>-{money(totals.credit)}</dd></div>}
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
