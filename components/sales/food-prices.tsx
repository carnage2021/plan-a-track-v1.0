"use client";

import { RotateCcw, UtensilsCrossed } from "lucide-react";
import * as React from "react";
import { VegMark } from "@/components/shared/badges";
import { MoneyInput } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { fullPath, pricedAtBooking, rootOf, subPath, treeOrder } from "@/lib/categories";
import { menuPrices, priceFunction } from "@/lib/pricing";
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
 * Step 3: every dish picked, day by day and event by event, with its price for this booking. Built dish by dish,
 * each category (Welcome drinks, Starters, Breads ...) shows its dishes under one price per plate that starts at
 * their total and can be changed; the main course (every sub-category under it) takes one price typed in; counters
 * keep their own price. With a package, the package is one block: its price per plate (which can be changed) covers
 * every dish chosen inside it, listed without prices. Dishes beyond the package each take a price that is added to
 * the package's: a main course dish starts empty for the price to be typed in, any other starts at its menu price.
 */
export function FoodPrices({ functions, onPatch }: { functions: EventFunction[]; onPatch: Patch }) {
  const items = useStore((s) => s.items);
  const packages = useStore((s) => s.packages);
  const categories = useStore((s) => s.categories);
  const slabs = useStore((s) => s.tenant.slabs);
  const ready = useStore((s) => s.dishGuestsReady);
  const catReady = useStore((s) => s.categoryPricesReady);
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
            // Menu prices on this event: a dish in a category with one price takes it (or its share of a set).
            const menu = menuPrices(f, items);
            const mp = (i: MenuItem) => menu.get(i.id) ?? i.price;
            const pkg = packages.find((x) => x.id === f.packageId);
            const dishes = f.itemIds
              .map((id) => items.find((i) => i.id === id))
              .filter((i): i is MenuItem => !!i)
              .sort((a, b) => (order.get(a.categoryId) ?? 0) - (order.get(b.categoryId) ?? 0));
            const mains = dishes.filter((i) => !pkg && i.pricingType === "plate" && pricedAtBooking(i.categoryId));
            const setDish = (i: MenuItem, price: number) =>
              onPatch(f.id, (cur) => {
                // Inside a package a dish costs nothing extra; main course dishes have no menu price.
                const base = (pkg && !p.extraIds.includes(i.id) && i.pricingType === "plate") || pricedAtBooking(i.categoryId) ? 0 : mp(i);
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
            // A category price equal to its dishes' total is not kept, so the dishes' prices carry on counting.
            const setCategory = (categoryId: string, v: number, dishTotal: number) =>
              onPatch(f.id, (cur) => {
                const prices = { ...cur.categoryPrices };
                if (v === dishTotal) delete prices[categoryId];
                else prices[categoryId] = v;
                return { categoryPrices: Object.keys(prices).length ? prices : undefined };
              });
            const counters = pkg ? [] : dishes.filter((i) => i.pricingType !== "plate");
            return (
              <div key={f.id} className="mt-2 rounded-xl border">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b bg-surface-muted/50 px-3 py-2">
                  <p className="font-medium">{f.name}<span className="tnum text-xs font-normal text-text-muted"> · {[serviceLine(f, foodTypes), `${num(f.pax)} guests`].filter(Boolean).join(" · ")}</span></p>
                  <p className="tnum text-sm"><span className="font-semibold">{rate(p.perPlate)}</span><span className="text-text-muted"> a plate{p.slabPct ? `, ${p.slabPct}% off for ${num(f.pax)} guests` : ""}</span></p>
                </div>
                <ul className="divide-y">
                  {pkg && (
                    <Group
                      title={`${pkg.name} package`}
                      fnName={f.name}
                      dishes={dishes.filter((i) => i.pricingType === "plate" && !p.extraIds.includes(i.id))}
                      value={p.packagePrice}
                      hint={!ready ? "Run the 0024 database update to change the package price" : p.addOnPerPlate ? `One price per plate for the package, plus ${rate(p.addOnPerPlate)} added earlier on its dishes; changing the price includes them` : "One price per plate for the package, every dish below included"}
                      // The package price covers its dishes, so prices once added on top of them go with a new price.
                      onChange={ready ? (v) => onPatch(f.id, (cur) => {
                        const prices = { ...cur.itemPrices };
                        for (const id of p.addOnIds) delete prices[id];
                        return { packagePrice: v === pkg.pricePerPlate ? undefined : v, itemPrices: Object.keys(prices).length ? prices : undefined };
                      }) : undefined}
                      onReset={f.packagePrice !== undefined && f.packagePrice !== pkg.pricePerPlate ? () => onPatch(f.id, () => ({ packagePrice: undefined })) : undefined}
                      resetLabel="Back to the package's own price"
                    />
                  )}
                  {dishes.map((i) => {
                    const plate = i.pricingType === "plate";
                    const main = !pkg && plate && pricedAtBooking(i.categoryId);
                    // The main course shows once, where its first dish would be, with every dish of it inside.
                    if (main) return i.id === firstMain ? <Group key="main" main title="Main course" fnName={f.name} dishes={mains} value={f.mainRate ?? 0} onChange={setMain} /> : null;
                    // Built dish by dish, other per-plate dishes show as their top category, once, at its first dish.
                    if (!pkg && plate) {
                      const part = p.parts.find((x) => x.itemIds.includes(i.id));
                      if (!part || part.itemIds[0] !== i.id) return null;
                      const name = categories.find((c) => c.id === part.categoryId)?.name ?? "Other dishes";
                      return (
                        <Group
                          key={`cat-${part.categoryId}`}
                          title={name}
                          fnName={f.name}
                          dishes={part.itemIds.map((id) => dishes.find((d) => d.id === id)).filter((d): d is MenuItem => !!d)}
                          value={part.perPlate}
                          hint={!catReady ? "Run the 0025 database update to price a category as a whole" : part.typed ? `Dishes add up to ${rate(part.dishTotal)}; this booking uses the price typed here` : "The total of the dishes below; change it to price them as one"}
                          onChange={catReady ? (v) => setCategory(part.categoryId, v, part.dishTotal) : undefined}
                          onReset={part.typed ? () => setCategory(part.categoryId, part.dishTotal, part.dishTotal) : undefined}
                        />
                      );
                    }
                    // Counters are priced per counter, not per plate, so they stay on their own lines at the end.
                    if (!pkg) return null;
                    // Dishes inside the package are listed in its block above.
                    if (plate && !p.extraIds.includes(i.id)) return null;
                    // A main course dish has no menu price, so beyond the package its box starts empty for the price to be typed.
                    const mainBeyond = plate && pricedAtBooking(i.categoryId);
                    const value = f.itemPrices?.[i.id] ?? (mainBeyond ? 0 : mp(i));
                    const tag = plate ? (mainBeyond && !value ? "Beyond the package: enter its price" : "Beyond the package") : "Counter";
                    return (
                      <Row
                        key={i.id}
                        item={i}
                        name={i.name}
                        sub={[categories.find((c) => c.id === rootOf(i.categoryId))?.name, subPath(i.categoryId)].filter(Boolean).join(" › ")}
                        tag={tag}
                        value={value}
                        changed={f.itemPrices?.[i.id] !== undefined && !mainBeyond}
                        onChange={(v) => setDish(i, v)}
                        onReset={() => onPatch(f.id, (cur) => ({ itemPrices: withPrice(cur, i.id, mp(i), mp(i)) }))}
                        unit={plate ? "a plate" : "a counter"}
                      />
                    );
                  })}
                  {pkg && p.extraPerPlate + p.addOnPerPlate > 0 && (
                    <li className="tnum flex flex-wrap justify-between gap-x-3 bg-primary-soft/40 px-3 py-2 text-sm">
                      <span className="text-text-muted">{pkg.name} package {rate(p.packagePrice)} + beyond the package {rate(p.extraPerPlate + p.addOnPerPlate)}</span>
                      <span className="font-semibold">{rate(p.packagePrice + p.extraPerPlate + p.addOnPerPlate)} a plate</span>
                    </li>
                  )}
                  {counters.length > 0 && <li className="bg-surface-muted/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">Counters · priced per counter</li>}
                  {counters.map((i) => (
                    <Row
                      key={i.id}
                      item={i}
                      name={i.name}
                      sub={[categories.find((c) => c.id === rootOf(i.categoryId))?.name, subPath(i.categoryId)].filter(Boolean).join(" › ")}
                      tag="Counter"
                      value={f.itemPrices?.[i.id] ?? mp(i)}
                      changed={f.itemPrices?.[i.id] !== undefined}
                      onChange={(v) => setDish(i, v)}
                      onReset={() => onPatch(f.id, (cur) => ({ itemPrices: withPrice(cur, i.id, mp(i), mp(i)) }))}
                      unit="a counter"
                    />
                  ))}
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

/**
 * One category of an event with its dishes listed by sub-category and one price per plate for all of them. The main
 * course starts empty and must be typed in; any other category starts at its dishes' total.
 */
function Group({ title, fnName, dishes, value, onChange, onReset, resetLabel = "Back to the dishes' total", hint, main }: { title: string; fnName: string; dishes: MenuItem[]; value: number; onChange?: (v: number) => void; onReset?: () => void; resetLabel?: string; hint?: string; main?: boolean }) {
  const groups = new Map<string, MenuItem[]>();
  for (const d of dishes) {
    const key = main ? fullPath(d.categoryId) : subPath(d.categoryId);
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  const missing = main && !value;
  return (
    <li className={cn("px-3 py-2.5", missing && "bg-warning/10")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1 basis-48">
          <p className="text-sm font-medium">{title} · {dishes.length} {dishes.length === 1 ? "dish" : "dishes"}</p>
          <p className={cn("text-xs", missing ? "font-medium text-warning" : "text-text-muted")}>{main ? (value ? "One price per plate for the whole main course, every dish below included" : "Enter one price per plate for the whole main course") : hint}</p>
        </div>
        <div className="flex items-center gap-1">
          {onReset && <Button variant="ghost" size="icon" aria-label={`${resetLabel} for ${title}`} title={resetLabel} onClick={onReset}><RotateCcw strokeWidth={1.75} /></Button>}
          {onChange ? <MoneyInput label={`${title} price per plate for ${fnName}`} value={value} onChange={onChange} className="w-28" /> : <span className="tnum w-28 text-right text-sm">{rate(value)}</span>}
          <span className="w-16 text-xs text-text-muted">a plate</span>
        </div>
      </div>
      <dl className="mt-2 space-y-1 border-l-2 border-primary/30 pl-3">
        {[...groups].map(([group, list]) => (
          <div key={group || "top"} className="text-xs sm:flex sm:gap-2">
            {group && <dt className="shrink-0 font-medium text-text-muted sm:w-40">{group}</dt>}
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
