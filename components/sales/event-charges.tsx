"use client";

import { CalendarDays, CookingPot, Copy, Plus, Trash2, Users, UtensilsCrossed } from "lucide-react";
import * as React from "react";
import { MoneyInput } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/primitives";
import { chargeAmount, priceFunction } from "@/lib/pricing";
import { timeRange } from "@/lib/services";
import { suggestedHeadcount, workerRoles } from "@/lib/staff";
import { useStore } from "@/lib/store";
import { assetRequirement } from "@/lib/supply";
import { useSupply } from "@/lib/supply-store";
import type { Asset } from "@/lib/supply-types";
import type { EventCharge, EventFunction, QuoteDraft, SamplePhoto } from "@/lib/types";
import { PhotoThumb, SamplePhotoGallery, ShowPhotosButton } from "./sample-photos";
import { cn, fmtDate, money, num, rate, uid } from "@/lib/utils";

type SetDraft = (patch: Partial<QuoteDraft> | ((d: QuoteDraft) => Partial<QuoteDraft>)) => void;

/** The events grouped by day, in time order; events without a date come last. */
export function byDay(functions: EventFunction[]) {
  const days = new Map<string, EventFunction[]>();
  for (const f of [...functions].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999") || a.time.localeCompare(b.time))) days.set(f.date, [...(days.get(f.date) ?? []), f]);
  return [...days.entries()];
}

/** How many of a role an event of this size usually needs (1 when the role has no rule). */
const headcount = (role: string, pax: number) => suggestedHeadcount(pax).find((t) => t.role === role)?.count ?? 1;

/**
 * Charges on each event, grouped by date: service staff by role and cutlery by the piece, priced from the caterer's own
 * rates and editable here, plus any other charge. Each event shows its food, its charges and its own total.
 */
export function EventCharges({ draft, setDraft }: { draft: QuoteDraft; setDraft: SetDraft }) {
  const tenant = useStore((s) => s.tenant);
  const items = useStore((s) => s.items);
  const packages = useStore((s) => s.packages);
  const assets = useSupply((s) => s.assets);
  const rates = React.useMemo(() => tenant.staffRates ?? [], [tenant.staffRates]);
  // Sample photos to show the client: a uniform for each staff role, a photo for each cutlery item.
  const photos = useStore((s) => s.samplePhotos);
  const [gallery, setGallery] = React.useState<{ open: boolean; start?: SamplePhoto }>({ open: false });
  const photoOf = (c: EventCharge) => (c.kind === "other" ? undefined : photos.find((p) => p.kind === (c.kind === "worker" ? "staff" : "cutlery") && p.name.trim().toLowerCase() === c.label.trim().toLowerCase()));
  const roles = React.useMemo(() => [...new Set([...rates.map((r) => r.name), ...workerRoles])], [rates]);
  const rateOf = (role: string) => rates.find((r) => r.name.toLowerCase() === role.toLowerCase())?.rate ?? 0;

  const setCharges = (fnId: string, next: (c: EventCharge[]) => EventCharge[]) =>
    setDraft((d) => ({ functions: d.functions.map((f) => (f.id === fnId ? { ...f, charges: next(f.charges ?? []) } : f)) }));
  const patch = (fnId: string, id: string, p: Partial<EventCharge>) => setCharges(fnId, (list) => list.map((c) => (c.id === id ? { ...c, ...p } : c)));
  const setMainRate = (fnId: string, mainRate: number) => setDraft((d) => ({ functions: d.functions.map((f) => (f.id === fnId ? { ...f, mainRate: mainRate || undefined } : f)) }));

  const workerLine = (role: string, pax: number): EventCharge => ({ id: uid(), kind: "worker", ref: role, label: role, qty: headcount(role, pax), rate: rateOf(role) });
  const cutleryLine = (a: Asset, f: EventFunction): EventCharge => ({ id: uid(), kind: "cutlery", ref: a.id, label: a.name, qty: assetRequirement(a, f, items), rate: a.rentRate ?? 0 });

  /** Every priced staff role, with the usual headcount for the guests. */
  const fillStaff = (f: EventFunction) =>
    setCharges(f.id, (list) => [...list, ...rates.filter((r) => r.rate > 0 && !list.some((c) => c.kind === "worker" && c.ref === r.name)).map((r) => workerLine(r.name, f.pax))]);
  /** Every cutlery item with a rent, in the quantity its rule gives for this event. */
  const fillCutlery = (f: EventFunction) =>
    setCharges(f.id, (list) => [...list, ...assets.filter((a) => (a.rentRate ?? 0) > 0 && !list.some((c) => c.kind === "cutlery" && c.ref === a.id)).map((a) => cutleryLine(a, f)).filter((c) => c.qty > 0)]);
  /** The same charges on every other event; cutlery and staff counts follow each event's own guests and dishes. */
  const copyToOthers = (from: EventFunction) =>
    setDraft((d) => ({
      functions: d.functions.map((f) => {
        if (f.id === from.id) return f;
        return {
          ...f,
          charges: (from.charges ?? []).map((c) => {
            const asset = c.kind === "cutlery" ? assets.find((a) => a.id === c.ref) : undefined;
            const qty = asset ? assetRequirement(asset, f, items) || c.qty : c.kind === "worker" && c.ref && c.qty === headcount(c.ref, from.pax) ? headcount(c.ref, f.pax) : c.qty;
            return { ...c, id: uid(), qty };
          }),
        };
      }),
    }));

  const days = byDay(draft.functions);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2 px-1">
        <div>
          <h2 className="font-heading text-base font-semibold">Staff, cutlery and charges for each event</h2>
          <p className="text-xs text-text-muted">Prices come from your rates in Settings and Cutlery; change any line for this booking only.</p>
        </div>
        <ShowPhotosButton onClick={() => setGallery({ open: true })} />
      </div>
      <SamplePhotoGallery open={gallery.open} start={gallery.start} onOpenChange={(open) => setGallery({ open })} />
      {days.map(([date, fns]) => {
        const dayTotal = fns.reduce((s, f) => s + priceFunction(f, items, packages, tenant.slabs).eventTotal, 0);
        return (
          <section key={date || "none"} className="space-y-3" aria-label={date ? fmtDate(date) : "No date yet"}>
            <div className="flex items-baseline justify-between gap-2 border-b-2 border-primary/30 px-1 pb-1">
              <h3 className="flex items-center gap-2 font-heading text-base font-semibold"><CalendarDays className="size-4 text-primary" strokeWidth={1.75} />{date ? fmtDate(date, { weekday: "long", day: "numeric", month: "long" }) : "No date yet"}</h3>
              <p className="tnum text-sm text-text-muted">Day total <span className="font-semibold text-text">{money(dayTotal)}</span></p>
            </div>
            {fns.map((f) => {
              const price = priceFunction(f, items, packages, tenant.slabs);
              const charges = f.charges ?? [];
              const unusedRoles = roles.filter((r) => !charges.some((c) => c.kind === "worker" && c.ref === r));
              const unusedAssets = assets.filter((a) => !charges.some((c) => c.kind === "cutlery" && c.ref === a.id));
              return (
                <Card key={f.id} className="p-4 md:p-5" aria-label={`Charges for ${f.name}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-heading text-base font-semibold">{f.name}</h4>
                      <p className="tnum text-xs text-text-muted">{timeRange(f)} · {num(f.pax)} guests{f.venue ? ` · ${f.venue}` : ""}</p>
                    </div>
                    <p className="tnum text-right"><span className="block text-xs text-text-muted">Event total</span><span className="font-heading text-lg font-bold" data-testid="event-total">{money(price.eventTotal)}</span></p>
                  </div>

                  <div className="mt-3 overflow-x-auto">
                    <table className="tnum w-full min-w-[560px] text-sm">
                      <thead className="text-left text-xs text-text-muted">
                        <tr><th className="py-1.5 font-medium">Item</th><th className="w-24 py-1.5 font-medium">Qty</th><th className="w-32 py-1.5 font-medium">Rate</th><th className="w-28 py-1.5 text-right font-medium">Amount</th><th className="w-10" /></tr>
                      </thead>
                      <tbody className="divide-y">
                        {(!price.needsMainRate || price.perPlate - price.mainRate > 0) && (
                          <tr>
                            <td className="py-2"><span className="inline-flex items-center gap-2"><UtensilsCrossed className="size-4 text-text-muted" strokeWidth={1.75} />{price.needsMainRate ? "Other dishes" : "Food"}</span></td>
                            <td className="py-2 text-text-muted">{num(f.pax)}</td>
                            <td className="py-2 text-text-muted">{money(price.perPlate - price.mainRate)} / plate</td>
                            <td className="py-2 text-right">{money((price.perPlate - price.mainRate) * f.pax)}</td>
                            <td />
                          </tr>
                        )}
                        {price.needsMainRate && (
                          <tr className={cn(!f.mainRate && "bg-warning/10")}>
                            <td className="py-1.5 pr-2"><span className="inline-flex items-center gap-2 font-medium"><CookingPot className="size-4 text-primary" strokeWidth={1.75} />Main course</span></td>
                            <td className="py-1.5 text-text-muted">{num(f.pax)}</td>
                            <td className="py-1.5 pr-2"><MoneyInput label={`Main course rate per plate for ${f.name}`} value={f.mainRate ?? 0} onChange={(v) => setMainRate(f.id, v)} /></td>
                            <td className="py-1.5 text-right">{money(price.mainRate * f.pax)}</td>
                            <td />
                          </tr>
                        )}
                        {price.fixed > 0 && <tr><td className="py-2 text-text-muted" colSpan={3}>Counters and add-ons</td><td className="py-2 text-right">{money(price.fixed)}</td><td /></tr>}
                        {charges.map((c) => (
                          <tr key={c.id}>
                            <td className="py-1.5 pr-2">
                              {c.kind === "other" ? (
                                <Input aria-label={`Charge name for ${f.name}`} value={c.label} onChange={(e) => patch(f.id, c.id, { label: e.target.value })} placeholder="What is it for" className="!h-9" />
                              ) : (
                                <span className="inline-flex items-center gap-2">{photoOf(c) ? <PhotoThumb photo={photoOf(c)} onOpen={(p) => setGallery({ open: true, start: p })} /> : c.kind === "worker" ? <Users className="size-4 text-text-muted" strokeWidth={1.75} /> : <UtensilsCrossed className="size-4 text-text-muted" strokeWidth={1.75} />}{c.label}</span>
                              )}
                            </td>
                            <td className="py-1.5 pr-2"><Input aria-label={`Quantity of ${c.label || "charge"} for ${f.name}`} inputMode="decimal" className="tnum !h-9" value={c.qty || ""} placeholder="0" onChange={(e) => patch(f.id, c.id, { qty: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} /></td>
                            <td className="py-1.5 pr-2"><MoneyInput label={`Rate of ${c.label || "charge"} for ${f.name}`} value={c.rate} onChange={(rate) => patch(f.id, c.id, { rate })} /></td>
                            <td className="py-1.5 text-right">{rate(chargeAmount(c))}</td>
                            <td className="py-1.5 text-right"><Button variant="ghost" size="icon" aria-label={`Remove ${c.label || "charge"} from ${f.name}`} onClick={() => setCharges(f.id, (list) => list.filter((x) => x.id !== c.id))}><Trash2 strokeWidth={1.75} /></Button></td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2"><td className="pt-2 font-medium" colSpan={3}>{f.name} total</td><td className="pt-2 text-right font-semibold">{money(price.eventTotal)}</td><td /></tr>
                      </tfoot>
                    </table>
                  </div>

                  {price.needsMainRate && !f.mainRate && <p className="mt-2 text-xs font-medium text-warning">Enter the main course rate per plate for {f.name}. Main course dishes have no price of their own.</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Select creatable aria-label={`Add staff to ${f.name}`} value="" onChange={(e) => e.target.value && setCharges(f.id, (list) => [...list, workerLine(e.target.value, f.pax)])} className="!h-9 w-auto">
                      <option value="">+ Staff…</option>
                      {unusedRoles.map((r) => <option key={r} value={r}>{r}{rateOf(r) ? ` · ${rate(rateOf(r))}` : ""}</option>)}
                    </Select>
                    <Select aria-label={`Add cutlery to ${f.name}`} value="" onChange={(e) => { const a = assets.find((x) => x.id === e.target.value); if (a) setCharges(f.id, (list) => [...list, cutleryLine(a, f)]); }} className="!h-9 w-auto" disabled={!unusedAssets.length}>
                      <option value="">{assets.length ? "+ Cutlery…" : "No cutlery items yet"}</option>
                      {unusedAssets.map((a) => <option key={a.id} value={a.id}>{a.name}{a.rentRate ? ` · ${rate(a.rentRate)}` : ""}</option>)}
                    </Select>
                    <Button variant="ghost" onClick={() => setCharges(f.id, (list) => [...list, { id: uid(), kind: "other", label: "", qty: 1, rate: 0 }])}><Plus strokeWidth={1.75} />Other charge</Button>
                    <span className="flex-1" />
                    {rates.some((r) => r.rate > 0) && <Button variant="ghost" onClick={() => fillStaff(f)}><Users strokeWidth={1.75} />Usual staff</Button>}
                    {assets.some((a) => (a.rentRate ?? 0) > 0) && <Button variant="ghost" onClick={() => fillCutlery(f)}><UtensilsCrossed strokeWidth={1.75} />All cutlery</Button>}
                    {draft.functions.length > 1 && charges.length > 0 && <Button variant="ghost" onClick={() => copyToOthers(f)}><Copy strokeWidth={1.75} />Same for every event</Button>}
                  </div>
                  {!rates.length && <p className={cn("mt-2 text-xs text-text-muted")}>Tip: set what you charge for each staff role in Settings, Service staff rates, and it fills in here.</p>}
                </Card>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
