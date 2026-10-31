"use client";

import { RotateCcw, UtensilsCrossed } from "lucide-react";
import * as React from "react";
import { VegMark } from "@/components/shared/badges";
import { MoneyInput } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { pricedAtBooking, rootOf, subPath, treeOrder } from "@/lib/categories";
import { priceFunction } from "@/lib/pricing";
import { serviceLine, useFoodTypes } from "@/lib/services";
import { useStore } from "@/lib/store";
import type { EventFunction, MenuItem } from "@/lib/types";
import { cn, fmtDate, money, num, rate } from "@/lib/utils";
import { byDay } from "./event-charges";

type Patch = (fnId: string, patch: (f: EventFunction) => Partial<EventFunction>) => void;

/** A per-booking dish price: kept when it differs from what the dish costs by default, dropped otherwise. */
function withPrice(f: EventFunction, id: string, price: number, base: number) {
  const prices = { ...f.itemPrices };
  if (price === base) delete prices[id];
  else prices[id] = price;
  return Object.keys(prices).length ? prices : undefined;
}

/**
 * Step 3: every dish picked, day by day and event by event, with its price for this booking. Dishes priced per
 * plate or per counter take a new price; main course dishes add up to the event's main course rate; with a package
 * its price per plate can be changed, and a price typed on a dish inside it is added on top.
 */
export function FoodPrices({ functions, onPatch }: { functions: EventFunction[]; onPatch: Patch }) {
  const items = useStore((s) => s.items);
  const packages = useStore((s) => s.packages);
  const categories = useStore((s) => s.categories);
  const slabs = useStore((s) => s.tenant.slabs);
  const ready = useStore((s) => s.dishGuestsReady);
  const foodTypes = useFoodTypes();
  const order = React.useMemo(() => new Map(treeOrder(categories).map((x, i) => [x.c.id, i])), [categories]);
  if (!functions.some((f) => f.itemIds.length || f.packageId)) return null;

  return (
    <Card className="p-4 md:p-5">
      <h2 className="flex items-center gap-2 font-heading text-base font-semibold"><UtensilsCrossed className="size-4 text-primary" strokeWidth={1.75} />Food items and prices</h2>
      <p className="text-xs text-text-muted">Every dish on this booking. A price changed here is for this client only; the menu keeps its own price.</p>
      {byDay(functions).map(([date, fns]) => (
        <section key={date || "none"} className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{date ? fmtDate(date, { weekday: "long", day: "numeric", month: "long" }) : "No date yet"}</p>
          {fns.map((f) => {
            const p = priceFunction(f, items, packages, slabs);
            const pkg = packages.find((x) => x.id === f.packageId);
            const dishes = f.itemIds
              .map((id) => items.find((i) => i.id === id))
              .filter((i): i is MenuItem => !!i)
              .sort((a, b) => (order.get(a.categoryId) ?? 0) - (order.get(b.categoryId) ?? 0));
            const mains = dishes.filter((i) => !pkg && i.pricingType === "plate" && pricedAtBooking(i.categoryId));
            const setDish = (i: MenuItem, price: number) =>
              onPatch(f.id, (cur) => {
                const main = !pkg && i.pricingType === "plate" && pricedAtBooking(i.categoryId);
                // Inside a package a dish costs nothing extra; main course dishes have no menu price.
                const base = main || (pkg && !p.extraIds.includes(i.id) && i.pricingType === "plate") ? 0 : pricedAtBooking(i.categoryId) ? 0 : i.price;
                const itemPrices = withPrice(cur, i.id, price, base);
                // The main course rate is the total of its dishes' prices.
                return main ? { itemPrices, mainRate: mains.reduce((s, m) => s + (m.id === i.id ? price : itemPrices?.[m.id] ?? 0), 0) || undefined } : { itemPrices };
              });
            return (
              <div key={f.id} className="mt-2 rounded-xl border">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b bg-surface-muted/50 px-3 py-2">
                  <p className="font-medium">{f.name}<span className="tnum text-xs font-normal text-text-muted"> · {[serviceLine(f, foodTypes), `${num(f.pax)} guests`].filter(Boolean).join(" · ")}</span></p>
                  <p className="tnum text-sm"><span className="font-semibold">{rate(p.perPlate)}</span><span className="text-text-muted"> a plate{p.slabPct ? `, ${p.slabPct}% off for ${num(f.pax)} guests` : ""}</span></p>
                </div>
                <ul className="divide-y">
                  {pkg && (
                    <Row
                      name={`${pkg.name} package`}
                      sub={ready ? "Price per plate for this booking" : "Run the 0024 database update to change the package price"}
                      tag="Package"
                      value={p.packagePrice}
                      changed={f.packagePrice !== undefined && f.packagePrice !== pkg.pricePerPlate}
                      onChange={ready ? (v) => onPatch(f.id, () => ({ packagePrice: v === pkg.pricePerPlate ? undefined : v })) : undefined}
                      onReset={() => onPatch(f.id, () => ({ packagePrice: undefined }))}
                      unit="a plate"
                    />
                  )}
                  {dishes.map((i) => {
                    const plate = i.pricingType === "plate";
                    const main = !pkg && plate && pricedAtBooking(i.categoryId);
                    const inPkg = !!pkg && plate && !p.extraIds.includes(i.id);
                    const value = f.itemPrices?.[i.id] ?? (inPkg || pricedAtBooking(i.categoryId) ? 0 : i.price);
                    const tag = inPkg ? (p.addOnIds.includes(i.id) ? "In package, added on top" : "In package") : main ? "Adds to the main course rate" : pkg && plate ? "Beyond the package" : !plate ? "Counter" : "";
                    return (
                      <Row
                        key={i.id}
                        item={i}
                        name={i.name}
                        sub={[categories.find((c) => c.id === rootOf(i.categoryId))?.name, subPath(i.categoryId)].filter(Boolean).join(" › ")}
                        tag={tag}
                        value={value}
                        changed={f.itemPrices?.[i.id] !== undefined && !main && !inPkg}
                        onChange={(v) => setDish(i, v)}
                        onReset={() => onPatch(f.id, (cur) => ({ itemPrices: withPrice(cur, i.id, i.price, i.price) }))}
                        unit={plate ? "a plate" : "a counter"}
                      />
                    );
                  })}
                </ul>
                {mains.length > 0 && (
                  <p className={cn("tnum border-t px-3 py-2 text-xs", p.mainRate ? "text-text-muted" : "bg-warning/10 font-medium text-warning")}>
                    {p.mainRate ? `Main course rate ${rate(p.mainRate)} a plate: the total of the main course prices above, or the rate typed for the event below.` : "Price the main course dishes above, or type one main course rate for the event below."}
                  </p>
                )}
                <p className="tnum flex justify-between border-t px-3 py-2 text-sm"><span className="text-text-muted">Food for {f.name}</span><span className="font-semibold">{money(p.total)}</span></p>
              </div>
            );
          })}
        </section>
      ))}
    </Card>
  );
}

function Row({ item, name, sub, tag, value, changed, onChange, onReset, unit }: { item?: MenuItem; name: string; sub: string; tag: string; value: number; changed: boolean; onChange?: (v: number) => void; onReset: () => void; unit: string }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
      <div className="min-w-0 flex-1 basis-48">
        <p className="flex items-center gap-1.5 text-sm" data-no-title-case>{item && <VegMark diet={item.diet} />}<span className="truncate">{name}</span></p>
        <p className="truncate text-xs text-text-muted">{[sub, tag].filter(Boolean).join(" · ")}</p>
      </div>
      <div className="flex items-center gap-1">
        {changed && <Button variant="ghost" size="icon" aria-label={`Back to the menu price for ${name}`} title="Back to the menu price" onClick={onReset}><RotateCcw strokeWidth={1.75} /></Button>}
        {onChange ? <MoneyInput label={`Price of ${name}`} value={value} onChange={onChange} className="w-28" /> : <span className="tnum w-28 text-right text-sm">{rate(value)}</span>}
        <span className="w-16 text-xs text-text-muted">{unit}</span>
      </div>
    </li>
  );
}
