"use client";

import { AlertTriangle, Check, ChevronUp, Copy, Eye, EyeOff, LayoutGrid, List, Package, Plus, Search, Star, X } from "lucide-react";
import * as React from "react";
import { Badge, VegMark, dietLabel } from "@/components/shared/badges";
import { PaxInput } from "@/components/shared/blocks";
import { DishCard, DishImage, priceLabel } from "@/components/shared/dish";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/input";
import { Chip, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { categoryIcon } from "@/lib/icons";
import { marginTone, priceFunction, priceQuote } from "@/lib/pricing";
import { useStore } from "@/lib/store";
import type { Diet, Discount, EventFunction, ExtraCharge, MenuItem } from "@/lib/types";
import { cn, money, num } from "@/lib/utils";
import { PackagePicker } from "./package-picker";

interface Props {
  functions: EventFunction[];
  onChange: (functions: EventFunction[]) => void;
  activeId: string;
  onActive: (id: string) => void;
  extras: ExtraCharge[];
  discount: Discount;
  clientId?: string;
  /** Presentation mode used with the client: larger photos, no internal information unless toggled */
  booking?: boolean;
  /** Sticky offset of the summary panel below the page header */
  top?: number;
  /** Buttons shown under the totals */
  actions: React.ReactNode;
}

const spiceWords = ["Not spicy", "Mild", "Medium", "Spicy"];
const priceBands = [
  { label: "Any price", max: 0 },
  { label: "Up to ₹30", max: 30 },
  { label: "Up to ₹50", max: 50 },
  { label: "Up to ₹80", max: 80 },
];

/** The showpiece screen (G6): photo grid of dishes with a live plate summary. */
export function MenuSelector({ functions, onChange, activeId, onActive, extras, discount, clientId, booking, top = 72, actions }: Props) {
  const allItems = useStore((s) => s.items);
  const categories = useStore((s) => s.categories);
  const packages = useStore((s) => s.packages);
  const orders = useStore((s) => s.orders);
  const tenant = useStore((s) => s.tenant);

  const [category, setCategory] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const [diets, setDiets] = React.useState<Diet[]>([]);
  const [bestsellers, setBestsellers] = React.useState(false);
  const [source, setSource] = React.useState<"all" | "inhouse" | "outsourced">("all");
  const [cuisine, setCuisine] = React.useState("");
  const [priceMax, setPriceMax] = React.useState(0);
  const [sort, setSort] = React.useState<"popular" | "price" | "name">("popular");
  const [view, setView] = React.useState<"grid" | "list">("grid");
  const [detail, setDetail] = React.useState<MenuItem | null>(null);
  const [pickPackage, setPickPackage] = React.useState(false);
  const [summaryOpen, setSummaryOpen] = React.useState(false);
  const [staff, setStaff] = React.useState(!booking);

  const fn = functions.find((f) => f.id === activeId) ?? functions[0];
  const pkg = packages.find((p) => p.id === fn.packageId);
  const price = React.useMemo(() => priceFunction(fn, allItems, packages, tenant.slabs), [fn, allItems, packages, tenant.slabs]);
  const totals = React.useMemo(
    () => priceQuote({ functions, extras, discount, gstRate: tenant.gstRate, gstInclusive: tenant.gstInclusive }, allItems, packages, tenant.slabs),
    [functions, extras, discount, tenant, allItems, packages],
  );

  const patch = (changes: Partial<EventFunction>) => onChange(functions.map((f) => (f.id === fn.id ? { ...f, ...changes } : f)));
  const toggle = (id: string) => patch({ itemIds: fn.itemIds.includes(id) ? fn.itemIds.filter((x) => x !== id) : [...fn.itemIds, id] });
  const choosePackage = (packageId?: string) => {
    const next = packages.find((p) => p.id === packageId);
    patch({ packageId, itemIds: next ? [...new Set([...next.fixedItemIds, ...fn.itemIds])] : fn.itemIds });
  };

  const { popularity, clientBefore } = React.useMemo(() => {
    const counts = new Map<string, number>();
    const before = new Set<string>();
    for (const o of orders)
      for (const f of o.functions)
        for (const id of f.itemIds) {
          counts.set(id, (counts.get(id) ?? 0) + 1);
          if (clientId && o.clientId === clientId) before.add(id);
        }
    return { popularity: counts, clientBefore: before };
  }, [orders, clientId]);

  const cuisines = React.useMemo(() => [...new Set(allItems.map((i) => i.cuisine))].sort(), [allItems]);
  const selected = new Set(fn.itemIds);
  const filtering = !!query || diets.length > 0 || bestsellers || source !== "all" || !!cuisine || priceMax > 0;

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return allItems
      .filter((i) => i.active || fn.itemIds.includes(i.id))
      .filter((i) => category === "all" || i.categoryId === category)
      .filter((i) => !q || i.name.toLowerCase().includes(q) || i.nameLocal.includes(query.trim()))
      .filter((i) => diets.length === 0 || diets.some((d) => (d === "veg" ? i.diet !== "nonveg" : i.diet === d)))
      .filter((i) => !bestsellers || i.bestseller)
      .filter((i) => source === "all" || (source === "outsourced") === i.outsourced)
      .filter((i) => !cuisine || i.cuisine === cuisine)
      .filter((i) => !priceMax || (i.pricingType === "plate" && i.price <= priceMax))
      .sort((a, b) => (sort === "price" ? a.price - b.price : sort === "name" ? a.name.localeCompare(b.name) : (popularity.get(b.id) ?? 0) - (popularity.get(a.id) ?? 0) || Number(b.bestseller) - Number(a.bestseller)));
  }, [allItems, fn.itemIds, category, query, diets, bestsellers, source, cuisine, priceMax, sort, popularity]);

  const plateDishes = visible.filter((i) => i.pricingType === "plate");
  const addOns = visible.filter((i) => i.pricingType !== "plate");
  const beforeRow = !filtering && category === "all" ? allItems.filter((i) => clientBefore.has(i.id) && i.active).slice(0, 8) : [];

  /** What picking this dish would add on top of the package price. */
  const noteFor = (item: MenuItem) => {
    if (!pkg || item.pricingType !== "plate" || pkg.fixedItemIds.includes(item.id)) return undefined;
    if (selected.has(item.id)) return price.extraIds.includes(item.id) ? `+${money(item.price)} per plate, beyond package` : undefined;
    const rule = price.rules.find((r) => r.categoryId === item.categoryId);
    return !rule || rule.chosen >= rule.choose ? `+${money(item.price)} per plate` : undefined;
  };

  const warnings: string[] = [];
  if (pkg && fn.pax < pkg.minPax) warnings.push(`${pkg.name} needs at least ${pkg.minPax} guests.`);
  for (const r of price.rules) if (!r.met) warnings.push(`${categories.find((c) => c.id === r.categoryId)?.name}: choose ${r.choose - r.chosen} more.`);
  for (const i of allItems) if (selected.has(i.id) && !i.active) warnings.push(`${i.name} is switched off in the menu.`);
  if (!booking || staff) {
    const outsourced = allItems.filter((i) => selected.has(i.id) && i.outsourced).length;
    if (outsourced) warnings.push(`${outsourced} outsourced ${outsourced === 1 ? "dish needs" : "dishes need"} a vendor (vendor mapping arrives in phase 3).`);
  }

  const summary = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-3 border-b p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading text-base font-semibold">{fn.name} plate</h2>
          <Button variant="ghost" className="-mr-2" onClick={() => setPickPackage(true)}>
            <Package strokeWidth={1.75} />{pkg ? pkg.name : "Custom"}
          </Button>
        </div>
        <PaxInput value={fn.pax} onChange={(pax) => patch({ pax })} compact />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {fn.itemIds.length === 0 && <p className="py-8 text-center text-sm text-text-muted">Tap dishes to build the plate.</p>}
        {categories.map((c) => {
          const picked = fn.itemIds.map((id) => allItems.find((i) => i.id === id)).filter((i): i is MenuItem => !!i && i.categoryId === c.id);
          if (picked.length === 0) return null;
          return (
            <div key={c.id} className="mb-4">
              <p className="mb-1.5 flex items-center justify-between text-xs font-medium text-text-muted">{c.name}<span className="tnum">{picked.length}</span></p>
              <ul className="space-y-1">
                {picked.map((i) => (
                  <li key={i.id} className="group flex items-center gap-2">
                    <DishImage item={i} sizes="48px" className="w-12 shrink-0 rounded-lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{i.name}</span>
                      {price.extraIds.includes(i.id) && <span className="tnum block text-xs text-warning">+{money(i.price)} extra</span>}
                      {i.pricingType !== "plate" && <span className="tnum block text-xs text-text-muted">{priceLabel(i)}</span>}
                    </span>
                    <button type="button" onClick={() => toggle(i.id)} className="grid size-9 shrink-0 place-items-center rounded-lg text-text-muted hover:bg-surface-muted hover:text-danger" aria-label={`Remove ${i.name}`}>
                      <X className="size-4" strokeWidth={1.75} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="shrink-0 space-y-3 border-t p-4">
        {warnings.length > 0 && (
          <ul className="space-y-1 rounded-lg bg-warning/10 p-2 text-xs text-warning">
            {warnings.slice(0, 4).map((w) => <li key={w} className="flex gap-1.5"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />{w}</li>)}
          </ul>
        )}
        <dl className="tnum space-y-1 text-sm">
          <div className="flex items-baseline justify-between"><dt className="text-text-muted">Per plate{price.slabPct ? ` (${price.slabPct}% off for ${num(fn.pax)}+)` : ""}</dt><dd className="font-heading text-xl font-bold">{money(price.perPlate)}</dd></div>
          <div className="flex justify-between text-text-muted"><dt>{fn.name} · {num(fn.pax)} guests</dt><dd>{money(price.total)}</dd></div>
          {functions.length > 1 && <div className="flex justify-between text-text-muted"><dt>All {functions.length} functions</dt><dd>{money(totals.food)}</dd></div>}
          {totals.extras > 0 && <div className="flex justify-between text-text-muted"><dt>Extras</dt><dd>{money(totals.extras)}</dd></div>}
          {totals.discount > 0 && <div className="flex justify-between text-text-muted"><dt>Discount</dt><dd>-{money(totals.discount)}</dd></div>}
          <div className="flex justify-between text-text-muted"><dt>GST {tenant.gstRate}%{tenant.gstInclusive ? " (included)" : ""}</dt><dd>{money(totals.gst)}</dd></div>
          <div className="flex items-baseline justify-between border-t pt-2 font-medium"><dt>Grand total</dt><dd className="font-heading text-lg font-bold">{money(totals.grand)}</dd></div>
        </dl>
        {staff && fn.itemIds.length > 0 && (
          <div className="tnum flex items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2 text-xs">
            <span className="text-text-muted">Staff only · food cost {money(price.costPerPlate)} per plate</span>
            <Badge tone={marginTone(totals.marginPct)}>{Math.round(totals.marginPct)}% margin</Badge>
          </div>
        )}
        <div className="flex flex-col gap-2">{actions}</div>
      </div>
    </div>
  );

  return (
    <div>
      {/* Function tabs */}
      <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {functions.map((f) => (
          <Chip key={f.id} active={f.id === fn.id} onClick={() => onActive(f.id)} className="h-11 px-4">
            {f.name}<span className="tnum rounded-full bg-surface-muted px-1.5 text-xs text-text-muted">{f.itemIds.length}</span>
          </Chip>
        ))}
        {functions.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" className="shrink-0"><Copy strokeWidth={1.75} />Copy menu from</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {functions.filter((f) => f.id !== fn.id).map((f) => (
                <DropdownMenuItem key={f.id} onSelect={() => patch({ packageId: f.packageId, itemIds: [...f.itemIds] })}>{f.name}<span className="tnum ml-auto text-xs text-text-muted">{f.itemIds.length} dishes</span></DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <span className="flex-1" />
        {booking && (
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setStaff(!staff)} aria-pressed={staff} aria-label={staff ? "Hide staff panel" : "Show staff panel"} title="Staff panel">
            {staff ? <EyeOff strokeWidth={1.75} /> : <Eye strokeWidth={1.75} />}
          </Button>
        )}
      </div>

      <div className="mt-4 flex items-start gap-4 lg:gap-6">
        {/* Category rail */}
        <nav className={cn("no-scrollbar sticky hidden w-16 shrink-0 space-y-0.5 overflow-y-auto md:block", booking ? "xl:w-52" : "2xl:w-52")} style={{ top, maxHeight: `calc(100dvh - ${top + 16}px)` }} aria-label="Categories">
          {[{ id: "all", name: "All dishes", icon: "" }, ...categories].map((c) => {
            const Icon = c.id === "all" ? LayoutGrid : categoryIcon(c.icon);
            const count = c.id === "all" ? fn.itemIds.length : allItems.filter((i) => i.categoryId === c.id && selected.has(i.id)).length;
            const active = category === c.id;
            return (
              <button key={c.id} type="button" title={c.name} onClick={() => setCategory(c.id)} aria-pressed={active} className={cn("relative flex h-11 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm font-medium transition-colors duration-150", active ? "bg-primary-soft text-primary" : "text-text-muted hover:bg-surface-muted hover:text-text")}>
                <Icon className={cn("mx-auto size-5 shrink-0", booking ? "xl:mx-0" : "2xl:mx-0")} strokeWidth={1.75} />
                <span className={cn("hidden flex-1 truncate", booking ? "xl:block" : "2xl:block")}>{c.name}</span>
                {count > 0 && <span className={cn("tnum absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-xs leading-none text-primary-fg", booking ? "xl:static xl:h-5 xl:min-w-5" : "2xl:static 2xl:h-5 2xl:min-w-5")}>{count}</span>}
              </button>
            );
          })}
        </nav>

        {/* Dish grid */}
        <div className="min-w-0 flex-1">
          <div className="flex gap-2">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-text-muted" strokeWidth={1.75} />
              <span className="sr-only">Search dishes</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search dishes in English or Gujarati" className="h-11 w-full rounded-lg border bg-surface pl-10 pr-3 text-sm placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </label>
            <Button variant="secondary" size="icon-lg" onClick={() => setView(view === "grid" ? "list" : "grid")} aria-label={view === "grid" ? "Compact list" : "Photo grid"} title={view === "grid" ? "Compact list" : "Photo grid"}>
              {view === "grid" ? <List strokeWidth={1.75} /> : <LayoutGrid strokeWidth={1.75} />}
            </Button>
          </div>

          <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 md:hidden">
            {[{ id: "all", name: "All" }, ...categories].map((c) => <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>{c.name}</Chip>)}
          </div>

          <div className="no-scrollbar -mx-4 mt-3 flex items-center gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
            {(["veg", "jain", "nonveg"] as Diet[]).map((d) => (
              <Chip key={d} active={diets.includes(d)} onClick={() => setDiets((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))}><VegMark diet={d} />{dietLabel(d)}</Chip>
            ))}
            <Chip active={bestsellers} onClick={() => setBestsellers(!bestsellers)}><Star strokeWidth={1.75} />Bestsellers</Chip>
            {!booking && <Chip active={source === "inhouse"} onClick={() => setSource(source === "inhouse" ? "all" : "inhouse")}>In-house</Chip>}
            {!booking && <Chip active={source === "outsourced"} onClick={() => setSource(source === "outsourced" ? "all" : "outsourced")}>Outsourced</Chip>}
            <Select aria-label="Cuisine" value={cuisine} onChange={(e) => setCuisine(e.target.value)} className="!h-9 w-auto shrink-0 rounded-full bg-surface">
              <option value="">Any cuisine</option>
              {cuisines.map((c) => <option key={c}>{c}</option>)}
            </Select>
            <Select aria-label="Price range" value={priceMax} onChange={(e) => setPriceMax(Number(e.target.value))} className="!h-9 w-auto shrink-0 rounded-full bg-surface">
              {priceBands.map((b) => <option key={b.max} value={b.max}>{b.label}</option>)}
            </Select>
            <Select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="!h-9 w-auto shrink-0 rounded-full bg-surface">
              <option value="popular">Most popular</option>
              <option value="price">Price, low to high</option>
              <option value="name">Name</option>
            </Select>
          </div>

          {pkg && (
            <div className="mt-3 flex flex-wrap gap-2">
              {price.rules.map((r) => (
                <button key={r.categoryId} type="button" onClick={() => setCategory(r.categoryId)}>
                  <Badge tone={r.met ? "success" : "warning"} className="h-7 px-2.5">
                    {r.met && <Check strokeWidth={2.5} />}
                    {categories.find((c) => c.id === r.categoryId)?.name} <span className="tnum">{Math.min(r.chosen, r.choose)} of {r.choose}</span> chosen
                    {r.chosen > r.choose && <span className="tnum">, +{r.chosen - r.choose} extra</span>}
                  </Badge>
                </button>
              ))}
            </div>
          )}

          {beforeRow.length > 0 && (
            <section className="mt-4">
              <h3 className="mb-2 text-xs font-medium text-text-muted">This client ordered before</h3>
              <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
                {beforeRow.map((i) => (
                  <button key={i.id} type="button" onClick={() => toggle(i.id)} aria-pressed={selected.has(i.id)} className={cn("flex h-11 shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition-colors duration-150", selected.has(i.id) ? "border-primary bg-primary-soft text-primary" : "bg-surface")}>
                    <DishImage item={i} sizes="48px" className="w-11 rounded-full" />
                    {i.name}
                    {selected.has(i.id) ? <Check className="size-4" strokeWidth={2.5} /> : <Plus className="size-4 text-text-muted" strokeWidth={1.75} />}
                  </button>
                ))}
              </div>
            </section>
          )}

          {visible.length === 0 && (
            <div className="mt-10 text-center text-sm text-text-muted">
              <p>No dishes match these filters.</p>
              <Button variant="ghost" className="mt-2" onClick={() => { setQuery(""); setDiets([]); setBestsellers(false); setSource("all"); setCuisine(""); setPriceMax(0); setCategory("all"); }}>Clear filters</Button>
            </div>
          )}

          {view === "grid" ? (
            <div className={cn("mt-4 grid grid-cols-2 gap-3", booking ? "lg:grid-cols-3" : "xl:grid-cols-3")}>
              {plateDishes.map((i) => <DishCard key={i.id} item={i} selected={selected.has(i.id)} note={noteFor(i)} hideInternal={booking} large={booking} onToggle={() => toggle(i.id)} onOpen={() => setDetail(i)} />)}
            </div>
          ) : (
            <ul className="mt-4 divide-y rounded-xl border bg-surface">
              {plateDishes.map((i) => (
                <li key={i.id} className={cn("flex items-center gap-3 px-3 py-2", selected.has(i.id) && "bg-primary-soft")}>
                  <VegMark diet={i.diet} />
                  <button type="button" onClick={() => setDetail(i)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-medium">{i.name}</span>
                    <span className="block truncate text-xs text-text-muted">{i.nameLocal}{noteFor(i) ? ` · ${noteFor(i)}` : ""}</span>
                  </button>
                  <span className="tnum shrink-0 text-sm text-text-muted">{money(i.price)}</span>
                  <Button size="icon" variant={selected.has(i.id) ? "secondary" : "ghost"} onClick={() => toggle(i.id)} aria-label={selected.has(i.id) ? `Remove ${i.name}` : `Add ${i.name}`} className={cn(selected.has(i.id) && "border-primary text-primary")}>
                    {selected.has(i.id) ? <Check strokeWidth={2.5} /> : <Plus strokeWidth={1.75} />}
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {addOns.length > 0 && (
            <section className="mt-8">
              <h3 className="font-heading text-base font-semibold">Add-ons and live counters</h3>
              <p className="text-xs text-text-muted">Priced per counter or as a flat amount, on top of the plate price.</p>
              <div className={cn("mt-3 grid grid-cols-2 gap-3", booking ? "lg:grid-cols-3" : "xl:grid-cols-3")}>
                {addOns.map((i) => <DishCard key={i.id} item={i} selected={selected.has(i.id)} hideInternal={booking} large={booking} onToggle={() => toggle(i.id)} onOpen={() => setDetail(i)} />)}
              </div>
            </section>
          )}
        </div>

        {/* Plate summary panel */}
        <aside className="sticky hidden w-[320px] shrink-0 flex-col overflow-hidden rounded-2xl border bg-surface shadow-card lg:flex xl:w-[360px]" style={{ top, maxHeight: `calc(100dvh - ${top + 16}px)` }} aria-label="Plate summary">
          {summary}
        </aside>
      </div>

      {/* Mobile and tablet: sticky bar that expands into a bottom sheet */}
      <button type="button" onClick={() => setSummaryOpen(true)} className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t bg-surface px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 text-left shadow-sheet lg:hidden">
        <span className="tnum min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{fn.itemIds.length} dishes · {money(price.perPlate)} per plate</span>
          <span className="block truncate text-xs text-text-muted">{fn.name} · {num(fn.pax)} guests · {money(totals.grand)} total{warnings.length ? ` · ${warnings.length} to check` : ""}</span>
        </span>
        <span className="flex h-11 items-center gap-1 rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg">Review<ChevronUp className="size-5" strokeWidth={1.75} /></span>
      </button>
      <Sheet open={summaryOpen} onOpenChange={setSummaryOpen} title="Plate summary">
        <div className="-mx-4 -mb-4 flex min-h-0 flex-col md:-mx-6">{summary}</div>
      </Sheet>

      <PackagePicker open={pickPackage} onOpenChange={setPickPackage} value={fn.packageId} pax={fn.pax} onPick={choosePackage} />

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)} title={detail?.name ?? ""} description={detail?.nameLocal}>
        {detail && (
          <div className="space-y-4">
            <DishImage item={detail} sizes="(max-width: 768px) 100vw, 420px" />
            <div className="flex flex-wrap items-center gap-2">
              <VegMark diet={detail.diet} withLabel />
              <Badge>{detail.cuisine}</Badge>
              <Badge>{spiceWords[detail.spice]}</Badge>
              {detail.bestseller && <Badge tone="gold">Bestseller</Badge>}
              {detail.seasonal && <Badge tone="warning">Seasonal</Badge>}
            </div>
            <p className="text-sm text-text-muted">{detail.description}</p>
            <p className="tnum font-heading text-xl font-bold">{priceLabel(detail)}</p>
            <Field label={`Note for ${fn.name}`} hint="Printed on the event sheet for the kitchen.">
              <Textarea value={fn.itemNotes?.[detail.id] ?? ""} onChange={(e) => patch({ itemNotes: { ...fn.itemNotes, [detail.id]: e.target.value } })} placeholder="Less spicy, serve in kulhad, Jain version on the side" />
            </Field>
            <Button size="lg" className="w-full" variant={selected.has(detail.id) ? "secondary" : "primary"} onClick={() => { toggle(detail.id); setDetail(null); }}>
              {selected.has(detail.id) ? "Remove from plate" : "Add to plate"}
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
