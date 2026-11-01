"use client";

import { RotateCcw, UtensilsCrossed } from "lucide-react";
import * as React from "react";
import { VegMark } from "@/components/shared/badges";
import { MoneyInput } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { fullPath, pricedAtBooking, rootOf, subPath, treeOrder } from "@/lib/categories";
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
 * plate or per counter take a new price; the main course (soups, rotis, sabjis, dal, rice and every sub-category
 * under it) takes one price per plate for the whole of it; with a package its price per plate can be changed, and a
 * price typed on a dish inside it is added on top.
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
                // Inside a package a dish costs nothing extra; main course dishes have no menu price.
                const base = (pkg && !p.extraIds.includes(i.id) && i.pricingType === "plate") || pricedAtBooking(i.categoryId) ? 0 : i.price;
                return { itemPrices: withPrice(cur, i.id, price, base) };
              });
            // One price for the whole main course; any old per-dish main course prices are dropped with it.
            const setMain = (v: number) =>
              onPatch(f.id, (cur) => {
                const prices = { ...cur.itemPrices };
                for (const m of mains) delete prices[m.id];
                return { mainRate: v || undefined, itemPrices: Object.keys(prices).length ? prices : undefined };
              });
            const firstMain = mains[0]?.id;
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
                    // The main course shows once, where its first dish would be, with every dish of it inside.
                    if (main) return i.id === firstMain ? <MainCourse key="main" fnName={f.name} dishes={mains} value={f.mainRate ?? 0} onChange={setMain} /> : null;
                    const inPkg = !!pkg && plate && !p.extraIds.includes(i.id);
                    const value = f.itemPrices?.[i.id] ?? (inPkg || pricedAtBooking(i.categoryId) ? 0 : i.price);
                    const tag = inPkg ? (p.addOnIds.includes(i.id) ? "In package, added on top" : "In package") : pkg && plate ? "Beyond the package" : !plate ? "Counter" : "";
                    return (
                      <Row
                        key={i.id}
                        item={i}
                        name={i.name}
                        sub={[categories.find((c) => c.id === rootOf(i.categoryId))?.name, subPath(i.categoryId)].filter(Boolean).join(" › ")}
                        tag={tag}
                        value={value}
                        changed={f.itemPrices?.[i.id] !== undefined && !inPkg}
                        onChange={(v) => setDish(i, v)}
                        onReset={() => onPatch(f.id, (cur) => ({ itemPrices: withPrice(cur, i.id, i.price, i.price) }))}
                        unit={plate ? "a plate" : "a counter"}
                      />
                    );
                  })}
                </ul>
                <p className="tnum flex justify-between border-t px-3 py-2 text-sm"><span className="text-text-muted">Food for {f.name}</span><span className="font-semibold">{money(p.total)}</span></p>
              </div>
            );
          })}
        </section>
      ))}
    </Card>
  );
}

/** The whole main course of one event: one price per plate that covers every dish in it, sub-category by sub-category. */
function MainCourse({ fnName, dishes, value, onChange }: { fnName: string; dishes: MenuItem[]; value: number; onChange: (v: number) => void }) {
  const groups = new Map<string, MenuItem[]>();
  for (const d of dishes) {
    const key = fullPath(d.categoryId);
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  return (
    <li className={cn("px-3 py-2.5", !value && "bg-warning/10")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1 basis-48">
          <p className="text-sm font-medium">Main course · {dishes.length} {dishes.length === 1 ? "dish" : "dishes"}</p>
          <p className={cn("text-xs", value ? "text-text-muted" : "font-medium text-warning")}>{value ? "One price per plate for the whole main course, every dish below included" : "Enter one price per plate for the whole main course"}</p>
        </div>
        <div className="flex items-center gap-1">
          <MoneyInput label={`Main course price per plate for ${fnName}`} value={value} onChange={onChange} className="w-28" />
          <span className="w-16 text-xs text-text-muted">a plate</span>
        </div>
      </div>
      <dl className="mt-2 space-y-1 border-l-2 border-primary/30 pl-3">
        {[...groups].map(([group, list]) => (
          <div key={group} className="text-xs sm:flex sm:gap-2">
            <dt className="shrink-0 font-medium text-text-muted sm:w-40">{group}</dt>
            <dd className="flex flex-wrap gap-x-3 gap-y-0.5" data-no-title-case>{list.map((d) => <span key={d.id} className="inline-flex items-center gap-1"><VegMark diet={d.diet} />{d.name}</span>)}</dd>
          </div>
        ))}
      </dl>
    </li>
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
