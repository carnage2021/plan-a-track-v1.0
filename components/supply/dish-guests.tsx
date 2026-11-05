"use client";

import { Save, Undo2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { VegMark } from "@/components/shared/badges";
import { DishImage } from "@/components/shared/dish";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardTitle } from "@/components/ui/primitives";
import { isWithin, roots } from "@/lib/categories";
import { useStore } from "@/lib/store";
import { dishGuests } from "@/lib/supply";
import { useSupply } from "@/lib/supply-store";
import type { EventFunction, MenuItem, Order } from "@/lib/types";
import { cn, num } from "@/lib/utils";

const digits = (v: string) => Number(v.replace(/\D/g, "").slice(0, 6)) || 0;

/**
 * One event's menu with the guests each dish is cooked for. The booking is for the event's guests, but the kitchen
 * rarely makes every dish for all of them: after a big round of starters the main course may be cooked for fewer.
 * The count here scales the dish's raw material, its agency work order and its dispatch portions; the client's
 * bill stays at the booked guests.
 */
/** Keyed by this so the card starts again from the saved counts after a save or a change of booked guests. */
export const dishGuestsKey = (fn: EventFunction) => `${fn.id}-${fn.pax}-${JSON.stringify(fn.itemPax ?? {})}`;

export function DishGuests({ order, fn, readOnly, action }: { order: Order; fn: EventFunction; readOnly?: boolean; action?: React.ReactNode }) {
  const items = useStore((s) => s.items);
  const categories = useStore((s) => s.categories);
  const ready = useStore((s) => s.dishGuestsReady);
  const setOrderItemPax = useStore((s) => s.setOrderItemPax);
  const outsource = useSupply((s) => s.outsourceOrders);
  const saved = React.useMemo(() => Object.fromEntries(fn.itemIds.map((id) => [id, dishGuests(fn, id)])), [fn]);
  const [counts, setCounts] = React.useState<Record<string, number>>(saved);
  const [bulk, setBulk] = React.useState<Record<string, string>>({});
  const editable = ready && !readOnly;
  const dirty = fn.itemIds.filter((id) => (counts[id] || 0) !== saved[id]);
  const lowered = fn.itemIds.filter((id) => saved[id] !== fn.pax).length;

  const save = () => {
    if (fn.itemIds.some((id) => !counts[id])) return toast.error("Every dish needs at least 1 guest", { description: "Remove a dish from the menu instead of setting it to 0." });
    setOrderItemPax(order.id, fn.id, counts);
    // Work orders already sent to the vendor keep their quantity; say so when one of their dishes changed.
    const stale = outsource.filter((o) => o.orderId === order.id && o.functionId === fn.id && o.status !== "draft" && o.status !== "cancelled" && o.lines.some((l) => dirty.includes(l.itemId)));
    toast.success("Kitchen guests saved", { description: stale.length ? "Raw material is updated. A work order already sent keeps its old quantity: tell the agency." : "Raw material, agency orders not yet sent and dispatch portions follow the new counts." });
  };

  return (
    <Card>
      <CardTitle action={<span className="flex flex-wrap items-center justify-end gap-3"><span className="tnum text-xs text-text-muted">{fn.itemIds.length} dishes · {num(fn.pax)} guests booked{lowered ? ` · ${lowered} cooked for a different count` : ""}</span>{action}</span>}>{fn.name}</CardTitle>
      {!ready && <p className="mx-4 rounded-lg bg-warning/10 p-2 text-xs text-warning md:mx-5">Run the 0024 database update to set kitchen guests per dish.</p>}
      <div className="grid gap-x-6 gap-y-5 p-4 sm:grid-cols-2 md:px-5 lg:grid-cols-3">
        {roots(categories).map((c) => {
          const picked = fn.itemIds.map((i) => items.find((x) => x.id === i)).filter((i): i is MenuItem => !!i && isWithin(i.categoryId, c.id));
          if (!picked.length) return null;
          const applyAll = () => {
            const n = digits(bulk[c.id] ?? "");
            if (!n) return;
            setCounts((cur) => ({ ...cur, ...Object.fromEntries(picked.map((i) => [i.id, n])) }));
            setBulk((b) => ({ ...b, [c.id]: "" }));
          };
          return (
            <div key={c.id}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-text-muted">{c.name}</p>
                {editable && (
                  <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); applyAll(); }}>
                    <Input aria-label={`Guests for every dish in ${c.name}`} inputMode="numeric" placeholder="Set all" value={bulk[c.id] ?? ""} onChange={(e) => setBulk((b) => ({ ...b, [c.id]: e.target.value.replace(/\D/g, "") }))} className="tnum !h-8 w-20 text-xs" />
                    <Button type="submit" variant="ghost" className="!h-8" disabled={!digits(bulk[c.id] ?? "")}>Apply</Button>
                  </form>
                )}
              </div>
              <ul className="space-y-2">
                {picked.map((i) => {
                  const n = counts[i.id] ?? fn.pax;
                  return (
                    <li key={i.id} className="flex items-center gap-2">
                      <DishImage item={i} sizes="40px" className="w-10 shrink-0 rounded-lg" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-sm"><VegMark diet={i.diet} /><span className="truncate">{i.name}</span></span>
                        {fn.itemNotes?.[i.id] && <span className="block truncate text-xs text-warning">{fn.itemNotes[i.id]}</span>}
                        {n !== fn.pax && <span className="tnum block text-xs text-accent-gold">{n < fn.pax ? `${num(fn.pax - n)} fewer` : `${num(n - fn.pax)} more`} than booked</span>}
                      </span>
                      {editable ? (
                        <Input aria-label={`Kitchen guests for ${i.name}`} inputMode="numeric" value={n ? String(n) : ""} onChange={(e) => setCounts((cur) => ({ ...cur, [i.id]: digits(e.target.value) }))} className={cn("tnum !h-9 w-20 shrink-0 text-right", !n && "border-danger")} />
                      ) : (
                        <span className="tnum w-16 shrink-0 text-right text-sm">{num(n)}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      {dirty.length > 0 && (
        <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t bg-surface px-4 py-3 md:px-5">
          <p className="mr-auto text-xs text-text-muted">{dirty.length} {dirty.length === 1 ? "dish" : "dishes"} changed. Raw material, agency orders and portions follow once saved.</p>
          <Button variant="ghost" onClick={() => setCounts(saved)}><Undo2 strokeWidth={1.75} />Undo</Button>
          <Button variant="primary" onClick={save}><Save strokeWidth={1.75} />Save kitchen guests</Button>
        </div>
      )}
    </Card>
  );
}
