"use client";

import { Gift, RotateCcw, Sparkles, Ticket } from "lucide-react";
import * as React from "react";
import { MoneyInput } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/primitives";
import { priceFunction, type QuoteTotals } from "@/lib/pricing";
import { referrerOf, useStore } from "@/lib/store";
import type { Discount, EventFunction, QuoteDraft, ReferralSettings } from "@/lib/types";
import { money, num } from "@/lib/utils";

/**
 * One editable per-plate price; saved when the field loses focus, so an order logs one change, not one per key.
 * Keyed by its saved price, so it starts over whenever that changes.
 */
function PriceRow({ name, sub, menuPrice, price, pax, onSave, readOnly }: { name: string; sub: string; menuPrice: number; price: number; pax: number; onSave: (price: number | undefined) => void; readOnly?: boolean }) {
  const [value, setValue] = React.useState(price);
  const changed = price !== menuPrice;
  const commit = () => value !== price && onSave(value === menuPrice ? undefined : value);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{name}</span>
        <span className="tnum block truncate text-xs text-text-muted">{sub}{changed && ` · menu price ${money(menuPrice)}`}</span>
      </span>
      {readOnly ? (
        <span className="tnum text-sm font-medium">{money(price)}</span>
      ) : (
        <span className="flex items-center gap-1" onBlur={commit} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLElement).blur()}>
          <MoneyInput value={value} onChange={setValue} className="w-28" />
          {changed && <Button variant="ghost" size="icon" aria-label={`Back to the menu price for ${name}`} title="Back to the menu price" onClick={() => onSave(undefined)}><RotateCcw strokeWidth={1.75} /></Button>}
        </span>
      )}
      <span className="tnum w-24 shrink-0 text-right text-xs text-text-muted">per plate × {num(pax)}<span className="block text-sm font-medium text-text">{money(value * pax)}</span></span>
    </li>
  );
}

/**
 * Dishes picked beyond what a service's package covers, each at an editable per-plate price for this quotation
 * or order only. A custom menu has no package, so every dish there is already priced dish by dish.
 */
export function ExtraDishes({ functions, onPrice, readOnly, title = "Extra dishes" }: { functions: EventFunction[]; onPrice: (functionId: string, itemId: string, price: number | undefined) => void; readOnly?: boolean; title?: string }) {
  const items = useStore((s) => s.items);
  const categories = useStore((s) => s.categories);
  const packages = useStore((s) => s.packages);
  const slabs = useStore((s) => s.tenant.slabs);
  const groups = functions
    .map((f) => ({ f, pkg: packages.find((p) => p.id === f.packageId), ids: priceFunction(f, items, packages, slabs).extraIds }))
    .filter((g) => g.pkg && g.ids.length);
  if (!groups.length) return null;
  return (
    <Card className="p-4 md:p-5">
      <h2 className="flex items-center gap-2 font-heading text-base font-semibold"><Sparkles className="size-4 text-accent-gold" strokeWidth={1.75} />{title}</h2>
      <p className="text-xs text-text-muted">Picked beyond what the package includes. {readOnly ? "" : "Change the per-plate price for this client; the dish's menu price stays as it is."}</p>
      {groups.map(({ f, pkg, ids }) => (
        <section key={f.id} className="mt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{f.name} · {pkg!.name} package</p>
          <ul className="divide-y">
            {ids.map((id) => {
              const item = items.find((i) => i.id === id)!;
              return <PriceRow key={`${id}-${f.itemPrices?.[id] ?? item.price}`} name={item.name} sub={`${categories.find((c) => c.id === item.categoryId)?.name ?? ""}, beyond the package`} menuPrice={item.price} price={f.itemPrices?.[id] ?? item.price} pax={f.pax} onSave={(p) => onPrice(f.id, id, p)} readOnly={readOnly} />;
            })}
          </ul>
        </section>
      ))}
    </Card>
  );
}

/** The discount a referral code gives, as a percent or, when a percent would pass the cap, the cap in rupees. */
export function referralDiscount(r: ReferralSettings, subtotal: number): Discount {
  if (r.type === "amount") return { type: "amount", value: r.value };
  if (r.max > 0 && (subtotal * r.value) / 100 > r.max) return { type: "amount", value: r.max };
  return { type: "percent", value: r.value };
}

export const offerText = (r: ReferralSettings) => (r.type === "percent" ? `${r.value}% off${r.max ? ` (up to ${money(r.max)})` : ""}` : `${money(r.value)} off`);

/** Referral code the new client came with, and referral credit the client has to spend. */
export function ReferralCard({ draft, setDraft, totals }: { draft: QuoteDraft; setDraft: (patch: Partial<QuoteDraft>) => void; totals: QuoteTotals }) {
  const ready = useStore((s) => s.referralsReady);
  const clients = useStore((s) => s.clients);
  const settings = useStore((s) => s.tenant.referral);
  const [code, setCode] = React.useState(draft.referralCode ?? "");
  const [error, setError] = React.useState("");
  const client = clients.find((c) => c.id === draft.clientId);
  const applied = referrerOf(clients, draft.referralCode, draft.clientId);
  const credit = client?.credit ?? 0;
  if (!ready) return <Card className="p-4 text-sm text-text-muted md:p-5">Referral codes and credit work once the 0014 database update is run.</Card>;

  const apply = () => {
    const referrer = referrerOf(clients, code, draft.clientId);
    if (!code.trim()) return setError("Enter the code the client gave you.");
    if (!referrer) return setError(clients.some((c) => c.id === draft.clientId && c.referralCode?.toUpperCase() === code.trim().toUpperCase()) ? "That is this client's own code." : "No client has this code.");
    setError("");
    setDraft({ referralCode: code.trim().toUpperCase(), ...(settings?.enabled ? { discount: referralDiscount(settings, totals.subtotal) } : {}) });
  };

  return (
    <Card className="p-4 md:p-5">
      <h2 className="flex items-center gap-2 font-heading text-base font-semibold"><Ticket className="size-4 text-primary" strokeWidth={1.75} />Referral</h2>
      {applied ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
          <span>Referred by <strong>{applied.name}</strong> ({draft.referralCode}){settings?.enabled ? ` · ${offerText(settings)} applied as the discount` : " · the referral offer is off in Settings"}</span>
          <Button variant="ghost" onClick={() => { setDraft({ referralCode: undefined, ...(settings?.enabled ? { discount: { type: "amount", value: 0 } } : {}) }); setCode(""); }}>Remove</Button>
        </div>
      ) : (
        <>
          <p className="text-xs text-text-muted">Did a client send them? Enter that client&apos;s code{settings?.enabled ? ` for ${offerText(settings)}` : ""}.</p>
          <div className="mt-2 flex gap-2">
            <Input aria-label="Referral code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && apply()} placeholder="RAJESH25" className="tnum max-w-48 uppercase" />
            <Button onClick={apply}>Apply</Button>
          </div>
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </>
      )}
      {credit > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-accent-gold/10 p-3 text-sm">
          <span className="flex items-center gap-2"><Gift className="size-4 text-accent-gold" strokeWidth={1.75} />{client!.name} has {money(credit)} referral credit{draft.creditUsed ? `; ${money(draft.creditUsed)} used here` : ""}.</span>
          {draft.creditUsed ? <Button variant="ghost" onClick={() => setDraft({ creditUsed: 0 })}>Don&apos;t use</Button> : <Button onClick={() => setDraft({ creditUsed: Math.min(credit, Math.max(0, totals.subtotal - totals.discount)) })}>Use credit</Button>}
        </div>
      )}
    </Card>
  );
}
