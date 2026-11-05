"use client";

import { AlertTriangle, Plus, Search, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { VegMark } from "@/components/shared/badges";
import { MoneyInput } from "@/components/shared/blocks";
import { DishImage, priceLabel } from "@/components/shared/dish";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { useBilling } from "@/lib/billing";
import { isWithin, pricedAtBooking, roots } from "@/lib/categories";
import { priceFunction, priceQuote } from "@/lib/pricing";
import { useStore } from "@/lib/store";
import { useSupply } from "@/lib/supply-store";
import type { EventFunction, MenuItem, Order } from "@/lib/types";
import { cn, money } from "@/lib/utils";

const fold = (s: string) => s.toLowerCase().replace(/[^a-z0-9ऀ-૿]/g, "");

/**
 * Adds dishes to, or takes them off, one event of a confirmed order. The bill, raw material, kitchen lists and agency
 * orders not yet sent follow; the change and what it does to the total go in the order's change log.
 */
export function ChangeMenu({ order, fn, open, onOpenChange }: { order: Order; fn: EventFunction; open: boolean; onOpenChange: (open: boolean) => void }) {
  const items = useStore((s) => s.items);
  const categories = useStore((s) => s.categories);
  const packages = useStore((s) => s.packages);
  const slabs = useStore((s) => s.tenant.slabs);
  const setOrderMenu = useStore((s) => s.setOrderMenu);
  const invoiced = useBilling((s) => s.invoices.some((i) => i.orderId === order.id && i.kind === "tax"));
  const sentAgency = useSupply((s) => s.outsourceOrders.some((o) => o.orderId === order.id && o.functionId === fn.id && o.status !== "draft" && o.status !== "cancelled"));
  const [ids, setIds] = React.useState(fn.itemIds);
  const [query, setQuery] = React.useState("");
  const [mainRate, setMainRate] = React.useState(fn.mainRate ?? 0);
  // Starts again from the event as saved each time it is opened.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) { setIds(fn.itemIds); setQuery(""); setMainRate(fn.mainRate ?? 0); }
  }

  const next: EventFunction = { ...fn, itemIds: ids, mainRate: mainRate || undefined };
  const nextOrder = { ...order, functions: order.functions.map((f) => (f.id === fn.id ? next : f)) };
  const impact = Math.round(priceQuote(nextOrder, items, packages, slabs).grand - priceQuote(order, items, packages, slabs).grand);
  const needsRate = priceFunction(next, items, packages, slabs).needsMainRate;
  const added = ids.filter((id) => !fn.itemIds.includes(id));
  const removed = fn.itemIds.filter((id) => !ids.includes(id));
  const changed = added.length > 0 || removed.length > 0 || (needsRate && mainRate !== (fn.mainRate ?? 0));
  const byId = (id: string) => items.find((i) => i.id === id);
  const picked = ids.map(byId).filter((i): i is MenuItem => !!i);

  const q = fold(query);
  const results = q ? items.filter((i) => i.active && !ids.includes(i.id) && (fold(i.name).includes(q) || fold(i.nameLocal).includes(q))).slice(0, 40) : [];

  const save = () => {
    if (!ids.length) return toast.error("An event needs at least one dish");
    if (needsRate && !(mainRate > 0)) return toast.error("Type the main course rate per plate", { description: "This event now has main course dishes, which are priced per plate for the whole main course." });
    setOrderMenu(order.id, fn.id, ids, impact, needsRate ? mainRate : undefined);
    const newAgency = added.map(byId).some((i) => i?.outsourced && i.agencyId);
    toast.success("Menu changed", {
      description: [
        impact ? `Order total ${impact > 0 ? "up" : "down"} by ${money(Math.abs(impact))}.` : "The order total is the same.",
        "Logged in the change log.",
        sentAgency ? "An agency order already sent keeps its dishes: tell the agency." : newAgency ? "Agency orders not yet sent take the new dishes; draft one on the Agencies tab for a new agency." : "",
      ].filter(Boolean).join(" "),
    });
    onOpenChange(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Change the menu of ${fn.name}`}
      description={`${fn.pax} guests booked. Raw material, kitchen lists and the bill follow the new menu.`}
      footer={
        <div className="flex w-full flex-wrap items-center gap-3">
          <span className="tnum mr-auto text-sm">
            {changed ? <>{added.length ? `${added.length} added` : ""}{added.length && removed.length ? ", " : ""}{removed.length ? `${removed.length} removed` : ""}{(added.length || removed.length) ? " · " : ""}<span className={cn("font-semibold", impact > 0 ? "text-success" : impact < 0 ? "text-danger" : "")}>{impact === 0 ? "total unchanged" : `total ${impact > 0 ? "+" : "−"}${money(Math.abs(impact))}`}</span></> : <span className="text-text-muted">No changes yet</span>}
          </span>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" disabled={!changed} onClick={save}>Save menu</Button>
        </div>
      }
    >
      <div className="space-y-4">
        {(invoiced || sentAgency) && (
          <p className="flex gap-2 rounded-lg bg-warning/10 p-3 text-sm text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            <span>{invoiced ? "A tax invoice is already made for this order and keeps its lines; issue a new one or a credit note after this change. " : ""}{sentAgency ? "An agency order for this event is already sent and keeps its dishes." : ""}</span>
          </p>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" strokeWidth={1.75} />
          <Input autoFocus className="pl-9" placeholder="Search a dish to add" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search a dish to add" />
        </div>
        {q && (
          <ul className="max-h-72 divide-y overflow-y-auto rounded-xl border">
            {results.length === 0 && <li className="p-3 text-sm text-text-muted">No dish matches, or it is already on this menu.</li>}
            {results.map((i) => (
              <li key={i.id} className="flex items-center gap-3 p-2">
                <DishImage item={i} sizes="40px" className="w-10 shrink-0 rounded-lg" />
                <span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 truncate text-sm font-medium"><VegMark diet={i.diet} />{i.name}</span><span className="text-xs text-text-muted">{pricedAtBooking(i.categoryId) ? "Main course, priced per plate" : priceLabel(i)}</span></span>
                <Button className="!h-8" onClick={() => { setIds((x) => [...x, i.id]); setQuery(""); }} aria-label={`Add ${i.name}`}><Plus strokeWidth={1.75} />Add</Button>
              </li>
            ))}
          </ul>
        )}

        {needsRate && (
          <Field label="Main course rate per plate *" hint="Built dish by dish, the main course is one price per plate for all of it.">
            <MoneyInput value={mainRate} onChange={setMainRate} label="Main course rate per plate" />
          </Field>
        )}

        <div className="space-y-4">
          {roots(categories).map((c) => {
            const here = picked.filter((i) => isWithin(i.categoryId, c.id));
            if (!here.length) return null;
            return (
              <div key={c.id}>
                <p className="mb-1.5 text-xs font-medium text-text-muted">{c.name}</p>
                <ul className="space-y-1.5">
                  {here.map((i) => (
                    <li key={i.id} className={cn("flex items-center gap-3 rounded-lg p-1.5", added.includes(i.id) && "bg-success/10")}>
                      <DishImage item={i} sizes="36px" className="w-9 shrink-0 rounded-lg" />
                      <span className="min-w-0 flex-1 truncate text-sm">{i.name}{added.includes(i.id) && <span className="ml-2 text-xs text-success">new</span>}</span>
                      <Button variant="ghost" size="icon" aria-label={`Remove ${i.name}`} onClick={() => setIds((x) => x.filter((id) => id !== i.id))}><X strokeWidth={1.75} /></Button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {removed.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-text-muted">Taken off</p>
              <ul className="space-y-1.5">
                {removed.map(byId).filter((i): i is MenuItem => !!i).map((i) => (
                  <li key={i.id} className="flex items-center gap-3 rounded-lg bg-danger/5 p-1.5">
                    <span className="min-w-0 flex-1 truncate text-sm text-text-muted line-through">{i.name}</span>
                    <Button variant="ghost" className="!h-8" onClick={() => setIds((x) => [...x, i.id])}>Put back</Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}
