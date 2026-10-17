"use client";

import { AlarmClock, ChefHat, ChevronLeft, ChevronRight, DatabaseZap, Flame, Layers, ListOrdered, Printer, Undo2 } from "lucide-react";
import * as React from "react";
import { VegMark } from "@/components/shared/badges";
import { EmptyState, PageHeader } from "@/components/shared/blocks";
import { Num } from "@/components/supply/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/ui/primitives";
import { clock, dishFlow, dishLabel, kitchenKey, portions, readyBy, useKitchen, type DishStatus } from "@/lib/kitchen";
import { useStore } from "@/lib/store";
import { fmtQty, requirementFor, roundQty } from "@/lib/supply";
import { useSupply } from "@/lib/supply-store";
import type { MenuItem } from "@/lib/types";
import { printLight } from "@/lib/ui";
import { addDays, cn, fmtDate, fmtTime, isoDate, num, parseDate } from "@/lib/utils";

const tone: Record<DishStatus, string> = {
  pending: "bg-surface-muted text-text-muted",
  prep: "bg-info/15 text-info",
  cooking: "bg-warning/15 text-warning",
  ready: "bg-success/15 text-success",
  packed: "bg-primary-soft text-primary",
};

interface Use { key: string; fnName: string; client: string; pax: number; time: string; venue: string; portions: number }
interface Dish { item: MenuItem; category: string; uses: Use[]; total: number; readyBy: number; status: DishStatus; done: number }

/** Everything to cook on one date, one card per dish, with the same dish across events cooked together. */
function useProduction(date: string) {
  const { orders, items, categories, clients } = useStore();
  const rows = useKitchen((s) => s.rows);
  return React.useMemo(() => {
    const map = new Map<string, Dish>();
    for (const o of orders) {
      if (o.status === "cancelled" || o.status === "tentative") continue;
      for (const fn of o.functions) {
        if (fn.date !== date) continue;
        for (const id of fn.itemIds) {
          const item = items.find((i) => i.id === id);
          // Outsourced dishes arrive from the agency; the kitchen does not cook them.
          if (!item || item.outsourced) continue;
          const category = categories.find((c) => c.id === item.categoryId)?.name ?? "";
          const dish = map.get(id) ?? { item, category, uses: [], total: 0, readyBy: Infinity, status: "pending" as DishStatus, done: 0 };
          dish.uses.push({ key: kitchenKey(fn.id, id), fnName: fn.name, client: clients.find((c) => c.id === o.clientId)?.name ?? "", pax: fn.pax, time: fn.time, venue: fn.venue, portions: portions(item, fn.pax) });
          dish.total += portions(item, fn.pax);
          dish.readyBy = Math.min(dish.readyBy, readyBy(fn.time, category));
          map.set(id, dish);
        }
      }
    }
    // A combined dish is only as far along as its slowest function.
    return [...map.values()]
      .map((d) => {
        const statuses = d.uses.map((u) => rows[u.key]?.status ?? "pending");
        return { ...d, status: dishFlow[Math.min(...statuses.map((s) => dishFlow.indexOf(s)))], done: statuses.filter((s) => s === "ready" || s === "packed").length };
      })
      .sort((a, b) => a.readyBy - b.readyBy || a.item.name.localeCompare(b.item.name));
  }, [orders, items, categories, clients, rows, date]);
}

function DishCard({ dish, now, isToday, recipeTop }: { dish: Dish; now: number; isToday: boolean; recipeTop: string }) {
  const setStatus = useKitchen((s) => s.setStatus);
  const setLeftover = useKitchen((s) => s.setLeftover);
  const rows = useKitchen((s) => s.rows);
  const i = dishFlow.indexOf(dish.status);
  const next = dishFlow[i + 1];
  const late = isToday && now > dish.readyBy && i < dishFlow.indexOf("ready");
  return (
    <article className={cn("flex flex-col rounded-2xl border bg-surface p-5", late && "border-danger")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm text-text-muted"><VegMark diet={dish.item.diet} />{dish.category}</p>
          <h3 className="mt-1 font-heading text-2xl font-bold leading-tight">{dish.item.name}</h3>
          {dish.item.nameLocal && <p className="text-base text-text-muted">{dish.item.nameLocal}</p>}
        </div>
        <p className="tnum shrink-0 text-right font-heading text-4xl font-bold">{num(dish.total)}<span className="block text-sm font-normal text-text-muted">{dish.item.pricingType === "plate" ? "portions" : "counters"}</span></p>
      </div>

      <p className={cn("mt-3 flex items-center gap-2 text-base font-medium", late ? "text-danger" : "text-text")}>
        <AlarmClock className="size-5" strokeWidth={1.75} />Ready by {clock(dish.readyBy)}{late && " · running late"}
      </p>
      {recipeTop && <p className="mt-1 text-sm text-text-muted">{recipeTop}</p>}

      <ul className="tnum mt-3 divide-y border-y text-sm">
        {dish.uses.map((u) => (
          <li key={u.key} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0"><span className="block truncate font-medium">{u.client} · {u.fnName}</span><span className="block truncate text-text-muted">Serve {fmtTime(u.time)} · {u.venue}</span></span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="font-semibold">{num(u.portions)}</span>
              {dish.uses.length > 1 && <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", tone[rows[u.key]?.status ?? "pending"])}>{dishLabel[rows[u.key]?.status ?? "pending"]}</span>}
            </span>
          </li>
        ))}
      </ul>
      {dish.uses.length > 1 && <p className="mt-2 text-xs text-text-muted">Cooked together for {dish.uses.length} functions; split at packing as listed.</p>}

      <div className="mt-auto pt-4">
        <ol className="flex gap-1" aria-label={`Status: ${dishLabel[dish.status]}`}>{dishFlow.slice(1).map((s, k) => <li key={s} className={cn("h-2 flex-1 rounded-full", k < i ? "bg-success" : "bg-surface-muted")} title={dishLabel[s]} />)}</ol>
        <div className="mt-3 flex items-center gap-2">
          <span className={cn("rounded-full px-3 py-1 text-sm font-semibold", tone[dish.status])}>{dishLabel[dish.status]}</span>
          {i > 0 && <Button variant="ghost" size="icon-lg" aria-label="Back one step" onClick={() => setStatus(dish.uses.map((u) => u.key), dishFlow[i - 1])}><Undo2 strokeWidth={1.75} /></Button>}
          {next && <Button variant={next === "cooking" ? "primary" : "secondary"} size="lg" className="flex-1 text-base" onClick={() => setStatus(dish.uses.map((u) => u.key), next)}>{next === "cooking" && <Flame strokeWidth={1.75} />}Mark {dishLabel[next].toLowerCase()}</Button>}
        </div>
        {dish.status === "packed" && (
          <div className="mt-3 space-y-1.5 rounded-xl bg-surface-muted p-3">
            <p className="text-xs font-medium text-text-muted">Left over after the event (portions)</p>
            {dish.uses.map((u) => <label key={u.key} className="flex items-center justify-between gap-3 text-sm"><span className="truncate">{u.fnName}</span><Num aria-label={`Leftover for ${u.fnName}`} className="w-24 bg-surface" value={rows[u.key]?.leftover ?? 0} onChange={(v) => setLeftover(u.key, v)} /></label>)}
          </div>
        )}
      </div>
    </article>
  );
}

export default function KitchenPage() {
  const ready = useKitchen((s) => s.ready);
  const [date, setDate] = React.useState(() => isoDate(new Date()));
  const [filter, setFilter] = React.useState<"all" | "todo" | "done">("all");
  const [now, setNow] = React.useState(() => new Date().getHours() * 60 + new Date().getMinutes());
  const dishes = useProduction(date);
  const items = useStore((s) => s.items);
  const { recipes, ingredients } = useSupply();
  const isToday = date === isoDate(new Date());

  React.useEffect(() => {
    // Keeps "running late" honest during a long service without reloading.
    const t = setInterval(() => setNow(new Date().getHours() * 60 + new Date().getMinutes()), 60000);
    return () => clearInterval(t);
  }, []);

  // The three biggest ingredients for each dish, scaled to its combined quantity.
  const recipeTop = (d: Dish) => {
    const need = requirementFor(d.uses.map((u) => ({ pax: u.pax, itemIds: [d.item.id] })), items, recipes);
    return ingredients.filter((i) => need.has(i.id)).map((i) => ({ i, q: roundQty(need.get(i.id)!, i.unit) })).sort((a, b) => b.q * b.i.lastRate - a.q * a.i.lastRate).slice(0, 3).map((x) => `${x.i.name} ${fmtQty(x.q)} ${x.i.unit}`).join(" · ");
  };
  const shown = dishes.filter((d) => (filter === "all" ? true : filter === "done" ? d.status === "ready" || d.status === "packed" : d.status !== "ready" && d.status !== "packed"));
  const finished = dishes.filter((d) => d.status === "ready" || d.status === "packed").length;
  const orders = useStore((s) => s.orders);
  const guests = orders.filter((o) => o.status !== "cancelled" && o.status !== "tentative").flatMap((o) => o.functions).filter((f) => f.date === date).reduce((s, f) => s + f.pax, 0);
  const step = (n: number) => setDate(isoDate(addDays(parseDate(date), n)));

  return (
    <>
      <PageHeader title="Kitchen" subtitle="What to cook, how much, and by when. Dishes needed at several events are cooked together." action={<Button onClick={printLight}><Printer strokeWidth={1.75} /><span className="max-sm:hidden">Production sheet</span></Button>} />
      {!ready ? (
        <EmptyState icon={DatabaseZap} title="One database step is pending" help="Run supabase/migrations/0005_kitchen.sql in the Supabase SQL editor, then reload this page. It stores where each dish stands in the kitchen." />
      ) : (
        // Kitchen tablets run dark, whatever the rest of the app is set to.
        <div data-theme="dark" className="-mx-4 rounded-none bg-bg px-4 py-5 text-text md:mx-0 md:rounded-2xl md:p-6 print:bg-transparent">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="icon-lg" aria-label="Previous day" onClick={() => step(-1)}><ChevronLeft strokeWidth={1.75} /></Button>
            <Input type="date" aria-label="Date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="!h-11 w-auto text-base" />
            <Button variant="ghost" size="icon-lg" aria-label="Next day" onClick={() => step(1)}><ChevronRight strokeWidth={1.75} /></Button>
            {!isToday && <Button variant="ghost" onClick={() => setDate(isoDate(new Date()))}>Today</Button>}
            <p className="tnum ml-auto text-base">{fmtDate(date, { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>

          {dishes.length === 0 ? (
            <div className="mt-6"><EmptyState icon={ChefHat} title="Nothing to cook on this day" help="Dishes from confirmed orders appear here on the day of their function. Tentative orders are left out until the advance is in." /></div>
          ) : (
            <>
              <dl className="tnum mt-5 grid grid-cols-3 gap-3">
                {[["Dishes", num(dishes.length)], ["Guests", num(guests)], ["Ready or packed", `${finished} of ${dishes.length}`]].map(([k, v]) => <div key={k} className="rounded-2xl bg-surface-muted p-4"><dt className="text-sm text-text-muted">{k}</dt><dd className="font-heading text-3xl font-bold">{v}</dd></div>)}
              </dl>
              <div className="mt-4 flex flex-wrap items-center gap-2 print:hidden">
                <Chip active={filter === "all"} onClick={() => setFilter("all")}><Layers strokeWidth={1.75} />All</Chip>
                <Chip active={filter === "todo"} onClick={() => setFilter("todo")}><ListOrdered strokeWidth={1.75} />Still to cook</Chip>
                <Chip active={filter === "done"} onClick={() => setFilter("done")}>Ready or packed</Chip>
                <span className="ml-auto text-sm text-text-muted">Ordered by the time each dish must be ready</span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {shown.map((d) => <DishCard key={d.item.id} dish={d} now={now} isToday={isToday} recipeTop={recipeTop(d)} />)}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
