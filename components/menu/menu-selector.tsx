"use client";

import { AlertTriangle, Check, ChevronUp, Clock, Copy, Eye, EyeOff, LayoutGrid, List, Package, Plus, Search, SlidersHorizontal, Star, UtensilsCrossed, X } from "lucide-react";
import * as React from "react";
import { Badge, VegMark, dietLabel } from "@/components/shared/badges";
import { PaxInput } from "@/components/shared/blocks";
import { DishCard, DishImage, priceLabel } from "@/components/shared/dish";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/input";
import { Chip, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { useAccess } from "@/lib/access";
import { categoryIcon } from "@/lib/icons";
import { additionLine } from "@/lib/packages";
import { marginTone, priceFunction, priceQuote } from "@/lib/pricing";
import { serviceLine, timeRange, useFoodTypes } from "@/lib/services";
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
  /** Sticky offset of the category bar and summary panel below the page header */
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
  { label: "Up to ₹120", max: 120 },
];

/**
 * The showpiece screen (G6), laid out like a showroom: sticky category tabs over one long, sectioned
 * photo menu, and the plate building up on the right. Tabs jump to a section and follow the scroll.
 */
export function MenuSelector({ functions, onChange, activeId, onActive, extras, discount, clientId, booking, top = 72, actions }: Props) {
  const allItems = useStore((s) => s.items);
  const categories = useStore((s) => s.categories);
  const packages = useStore((s) => s.packages);
  const orders = useStore((s) => s.orders);
  const tenant = useStore((s) => s.tenant);
  const { hidePrices } = useAccess();
  const foodTypes = useFoodTypes();

  const [query, setQuery] = React.useState("");
  const [diets, setDiets] = React.useState<Diet[]>([]);
  const [bestsellers, setBestsellers] = React.useState(false);
  const [source, setSource] = React.useState<"all" | "inhouse" | "outsourced">("all");
  const [cuisine, setCuisine] = React.useState("");
  const [priceMax, setPriceMax] = React.useState(0);
  const [sort, setSort] = React.useState<"popular" | "price" | "name">("popular");
  const [more, setMore] = React.useState(false);
  const [view, setView] = React.useState<"grid" | "list">("grid");
  const [detail, setDetail] = React.useState<MenuItem | null>(null);
  const [pickPackage, setPickPackage] = React.useState(false);
  const [summaryOpen, setSummaryOpen] = React.useState(false);
  const [staff, setStaff] = React.useState(!booking);
  const [current, setCurrent] = React.useState("");
  /** Every category, not just the food type's own */
  const [showAll, setShowAll] = React.useState(false);
  const sections = React.useRef(new Map<string, HTMLElement>());
  const tabsRef = React.useRef<HTMLDivElement>(null);

  // The app's sidebar folds away while the menu is open, for room; it comes back as it was afterwards.
  React.useEffect(() => {
    if (booking) return;
    const before = useStore.getState().sidebarCollapsed;
    useStore.setState({ sidebarCollapsed: true });
    return () => {
      useStore.setState({ sidebarCollapsed: before });
    };
  }, [booking]);

  const fn = functions.find((f) => f.id === activeId) ?? functions[0];
  const pkg = packages.find((p) => p.id === fn.packageId);
  const price = React.useMemo(() => priceFunction(fn, allItems, packages, tenant.slabs), [fn, allItems, packages, tenant.slabs]);
  const totals = React.useMemo(
    () => priceQuote({ functions, extras, discount, gstRate: tenant.gstRate, gstInclusive: tenant.gstInclusive }, allItems, packages, tenant.slabs),
    [functions, extras, discount, tenant, allItems, packages],
  );

  const foodType = foodTypes.find((t) => t.id === fn.foodTypeId);
  const patch = (changes: Partial<EventFunction>) => onChange(functions.map((f) => (f.id === fn.id ? { ...f, ...changes } : f)));
  const pickFoodType = (id: string) => {
    // A package made for another food type no longer fits.
    patch({ foodTypeId: id, ...(pkg?.foodTypeId && pkg.foodTypeId !== id ? { packageId: undefined } : {}) });
    setShowAll(false);
  };
  // The food type comes first; a function that already has dishes (from before food types) is not held up.
  const needsFoodType = !foodType && !showAll && fn.itemIds.length === 0;
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

  const cuisines = React.useMemo(() => [...new Set(allItems.map((i) => i.cuisine).filter(Boolean))].sort(), [allItems]);
  const selected = new Set(fn.itemIds);
  const extraFilters = (source !== "all" ? 1 : 0) + (cuisine ? 1 : 0) + (priceMax ? 1 : 0) + (sort !== "popular" ? 1 : 0);
  const filtering = !!query || diets.length > 0 || bestsellers || extraFilters > 0;
  const clearFilters = () => { setQuery(""); setDiets([]); setBestsellers(false); setSource("all"); setCuisine(""); setPriceMax(0); setSort("popular"); };

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return allItems
      .filter((i) => i.active || fn.itemIds.includes(i.id))
      .filter((i) => !q || i.name.toLowerCase().includes(q) || i.nameLocal.includes(query.trim()))
      .filter((i) => diets.length === 0 || diets.some((d) => (d === "veg" ? i.diet !== "nonveg" : i.diet === d)))
      .filter((i) => !bestsellers || i.bestseller)
      .filter((i) => source === "all" || (source === "outsourced") === i.outsourced)
      .filter((i) => !cuisine || i.cuisine === cuisine)
      .filter((i) => !priceMax || (i.pricingType === "plate" && i.price <= priceMax))
      .sort((a, b) => (sort === "price" ? a.price - b.price : sort === "name" ? a.name.localeCompare(b.name) : (popularity.get(b.id) ?? 0) - (popularity.get(a.id) ?? 0) || Number(b.bestseller) - Number(a.bestseller)));
  }, [allItems, fn.itemIds, query, diets, bestsellers, source, cuisine, priceMax, sort, popularity]);

  // One section per category, in the menu's own order, holding only the dishes that pass the filters.
  // The food type's categories, plus any the package asks for or a picked dish sits in, so nothing chosen is hidden.
  const allowed = React.useMemo(() => {
    if (!foodType || showAll) return null;
    const ids = new Set(foodType.categoryIds);
    for (const r of pkg?.rules ?? []) ids.add(r.categoryId);
    for (const i of allItems) if (fn.itemIds.includes(i.id)) ids.add(i.categoryId);
    return ids;
  }, [foodType, showAll, pkg, allItems, fn.itemIds]);
  const grouped = React.useMemo(
    () => (needsFoodType ? [] : categories.filter((c) => !allowed || allowed.has(c.id)).map((c) => ({ c, dishes: visible.filter((i) => i.categoryId === c.id) })).filter((g) => g.dishes.length)),
    [categories, visible, allowed, needsFoodType],
  );
  const hiddenCategories = allowed ? categories.filter((c) => !allowed.has(c.id)).length : 0;
  const beforeRow = !filtering && !needsFoodType ? allItems.filter((i) => clientBefore.has(i.id) && i.active).slice(0, 10) : [];

  // The tab for whichever section is at the top of the screen lights up as the menu scrolls.
  React.useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setCurrent(top.target.getAttribute("data-section") ?? "");
      },
      { rootMargin: `-${top + 60}px 0px -60% 0px` },
    );
    for (const el of sections.current.values()) io.observe(el);
    return () => io.disconnect();
  }, [grouped, top]);
  React.useEffect(() => {
    tabsRef.current?.querySelector(`[data-tab="${current}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [current]);
  const jump = (id: string) => {
    const el = sections.current.get(id);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - top - 64, behavior: "smooth" });
  };

  /** What picking this dish would add on top of the package price. */
  const noteFor = (item: MenuItem) => {
    if (hidePrices || !pkg || item.pricingType !== "plate" || pkg.fixedItemIds.includes(item.id)) return undefined;
    if (selected.has(item.id)) return price.extraIds.includes(item.id) ? `+${money(item.price)} per plate, beyond package` : undefined;
    const rule = price.rules.find((r) => r.categoryId === item.categoryId);
    return !rule || rule.chosen >= rule.choose ? `+${money(item.price)} per plate` : undefined;
  };
  const ruleFor = (categoryId: string) => price.rules.find((r) => r.categoryId === categoryId);
  const countIn = (categoryId: string) => allItems.filter((i) => i.categoryId === categoryId && selected.has(i.id)).length;

  const warnings: string[] = [];
  if (pkg && fn.pax < pkg.minPax) warnings.push(`${pkg.name} needs at least ${pkg.minPax} guests.`);
  for (const r of price.rules) if (!r.met) warnings.push(`${categories.find((c) => c.id === r.categoryId)?.name}: choose ${r.choose - r.chosen} more.`);
  for (const i of allItems) if (selected.has(i.id) && !i.active) warnings.push(`${i.name} is switched off in the menu.`);
  if (!booking || staff) {
    const unmapped = allItems.filter((i) => selected.has(i.id) && i.outsourced && !i.agencyId);
    if (unmapped.length) warnings.push(`${unmapped.map((i) => i.name).join(", ")} ${unmapped.length === 1 ? "is" : "are"} outsourced with no agency chosen.`);
  }

  const summary = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-3 border-b p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate font-heading text-base font-semibold" title={`${fn.name} plate`}>{fn.name}</h2>
            <p className="tnum truncate text-xs text-text-muted">{serviceLine(fn, foodTypes)}</p>
          </div>
          <Button variant="ghost" className="-mr-2 shrink-0" onClick={() => setPickPackage(true)}><Package strokeWidth={1.75} />{pkg ? pkg.name : "Choose package"}</Button>
        </div>
        <PaxInput value={fn.pax} onChange={(pax) => patch({ pax })} compact />
        {pkg && price.rules.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5">
            {price.rules.map((r) => (
              <button key={r.categoryId} type="button" onClick={() => jump(r.categoryId)} className={cn("flex items-center justify-between gap-1 rounded-lg px-2 py-1 text-xs", r.met ? "bg-success/10 text-success" : "bg-warning/10 text-warning")}>
                <span className="truncate">{categories.find((c) => c.id === r.categoryId)?.name}</span>
                <span className="tnum flex shrink-0 items-center gap-0.5 font-semibold">{r.met && <Check className="size-3" strokeWidth={3} />}{Math.min(r.chosen, r.choose)}/{r.choose}</span>
              </button>
            ))}
          </div>
        )}
        {pkg?.additions?.some((a) => a.name.trim()) && (
          <p className="flex flex-wrap gap-1.5 text-xs">{pkg.additions.filter((a) => a.name.trim()).map((a) => <span key={a.id} className="rounded-lg bg-accent-gold/15 px-2 py-1 font-medium text-accent-gold">+ {additionLine(a)}</span>)}</p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {fn.itemIds.length === 0 && <p className="py-8 text-center text-sm text-text-muted">Tap a dish to add it to the plate.</p>}
        {categories.map((c) => {
          const picked = fn.itemIds.map((id) => allItems.find((i) => i.id === id)).filter((i): i is MenuItem => !!i && i.categoryId === c.id);
          if (picked.length === 0) return null;
          return (
            <div key={c.id} className="mb-3">
              <p className="mb-1 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-text-muted">{c.name}<span className="tnum">{picked.length}</span></p>
              <ul className="space-y-1">
                {picked.map((i) => (
                  <li key={i.id} className="flex items-center gap-2">
                    <DishImage item={i} sizes="40px" className="w-10 shrink-0 rounded-md" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm"><VegMark diet={i.diet} /><span className="truncate">{i.name}</span></span>
                      {!hidePrices && price.extraIds.includes(i.id) && <span className="tnum block text-xs text-warning">+{money(i.price)} extra</span>}
                      {!hidePrices && i.pricingType !== "plate" && <span className="tnum block text-xs text-text-muted">{priceLabel(i)}</span>}
                    </span>
                    <button type="button" onClick={() => toggle(i.id)} className="grid size-8 shrink-0 place-items-center rounded-lg text-text-muted hover:bg-surface-muted hover:text-danger" aria-label={`Remove ${i.name}`}><X className="size-4" strokeWidth={1.75} /></button>
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
            {warnings.slice(0, 3).map((w) => <li key={w} className="flex gap-1.5"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />{w}</li>)}
          </ul>
        )}
        {!hidePrices && (
          <dl className="tnum space-y-1 text-sm">
            <div className="flex items-baseline justify-between"><dt className="text-text-muted">Per plate{price.slabPct ? ` (${price.slabPct}% off for ${num(fn.pax)}+)` : ""}</dt><dd className="font-heading text-2xl font-bold">{money(price.perPlate)}</dd></div>
            <div className="flex justify-between text-text-muted"><dt>{fn.name} · {num(fn.pax)} guests</dt><dd>{money(price.total)}</dd></div>
            {functions.length > 1 && <div className="flex justify-between text-text-muted"><dt>All {functions.length} functions</dt><dd>{money(totals.food)}</dd></div>}
            {totals.extras > 0 && <div className="flex justify-between text-text-muted"><dt>Extras</dt><dd>{money(totals.extras)}</dd></div>}
            {totals.discount > 0 && <div className="flex justify-between text-text-muted"><dt>Discount</dt><dd>-{money(totals.discount)}</dd></div>}
            <div className="flex justify-between text-text-muted"><dt>GST {tenant.gstRate}%{tenant.gstInclusive ? " (included)" : ""}</dt><dd>{money(totals.gst)}</dd></div>
            <div className="flex items-baseline justify-between border-t pt-2 font-medium"><dt>Grand total</dt><dd className="font-heading text-lg font-bold">{money(totals.grand)}</dd></div>
          </dl>
        )}
        {staff && !hidePrices && fn.itemIds.length > 0 && (
          <div className="tnum flex items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2 text-xs">
            <span className="text-text-muted">Staff only · food cost {money(price.costPerPlate)} a plate</span>
            <Badge tone={marginTone(totals.marginPct)}>{Math.round(totals.marginPct)}% margin</Badge>
          </div>
        )}
        <div className="flex flex-col gap-2">{actions}</div>
      </div>
    </div>
  );

  const dishGrid = (dishes: MenuItem[]) =>
    view === "grid" ? (
      <div className={cn("grid gap-3", booking ? "grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]" : "grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]")}>
        {dishes.map((i) => <DishCard key={i.id} item={i} selected={selected.has(i.id)} note={noteFor(i)} hideInternal={booking} large={booking} onToggle={() => toggle(i.id)} onOpen={() => setDetail(i)} />)}
      </div>
    ) : (
      <ul className="divide-y overflow-hidden rounded-xl border bg-surface">
        {dishes.map((i) => (
          <li key={i.id} className={cn("flex items-center gap-3 px-3 py-2", selected.has(i.id) && "bg-primary-soft")}>
            <DishImage item={i} sizes="44px" className="w-11 shrink-0 rounded-md" />
            <button type="button" onClick={() => setDetail(i)} className="min-w-0 flex-1 text-left">
              <span className="flex items-center gap-1.5 text-sm font-medium"><VegMark diet={i.diet} /><span className="truncate">{i.name}</span>{i.bestseller && <Star className="size-3.5 shrink-0 fill-accent-gold text-accent-gold" strokeWidth={1.5} />}</span>
              <span className="block truncate text-xs text-text-muted">{i.nameLocal}{noteFor(i) ? ` · ${noteFor(i)}` : ""}</span>
            </button>
            {!hidePrices && <span className="tnum shrink-0 text-sm text-text-muted">{priceLabel(i)}</span>}
            <Button size="icon" variant={selected.has(i.id) ? "secondary" : "ghost"} onClick={() => toggle(i.id)} aria-label={selected.has(i.id) ? `Remove ${i.name}` : `Add ${i.name}`} className={cn(selected.has(i.id) && "border-primary text-primary")}>
              {selected.has(i.id) ? <Check strokeWidth={2.5} /> : <Plus strokeWidth={1.75} />}
            </Button>
          </li>
        ))}
      </ul>
    );

  return (
    <div>
      {/* Functions, when the event has more than one */}
      {(functions.length > 1 || booking) && (
        <div className="no-scrollbar -mx-4 mb-3 flex items-center gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          {functions.map((f) => (
            <Chip key={f.id} active={f.id === fn.id} onClick={() => { onActive(f.id); setShowAll(false); }} className="h-auto min-h-10 px-4 py-1">
              <span className="text-left leading-tight">{f.name}<span className="tnum block text-[11px] font-normal opacity-75">{timeRange(f)}</span></span><span className="tnum rounded-full bg-surface-muted px-1.5 text-xs text-text-muted">{f.itemIds.length}</span>
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
      )}

      <div className="flex items-start gap-4 lg:gap-5">
        <div className="min-w-0 flex-1">
          {/* Food type first: it decides which categories and packages this service offers. */}
          {needsFoodType ? (
            <section className="mb-4 rounded-2xl border bg-surface p-4 shadow-card md:p-6">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-muted"><Clock className="size-3.5" strokeWidth={1.75} />{fn.name} · {serviceLine(fn, foodTypes)}</p>
              <h2 className="mt-1 font-heading text-xl font-semibold">What is this service for?</h2>
              <p className="text-sm text-text-muted">Pick the food type first; the menu then shows only its categories and packages.</p>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {foodTypes.map((t) => (
                  <button key={t.id} type="button" onClick={() => pickFoodType(t.id)} className="flex min-h-16 flex-col items-start justify-center rounded-xl border bg-surface px-4 py-3 text-left transition-colors duration-150 hover:border-primary hover:bg-primary-soft">
                    <span className="flex items-center gap-2 font-heading text-base font-semibold"><UtensilsCrossed className="size-4 text-primary" strokeWidth={1.75} />{t.name}</span>
                    <span className="mt-0.5 line-clamp-1 text-xs text-text-muted">{categories.filter((c) => t.categoryIds.includes(c.id)).map((c) => c.name).join(", ")}</span>
                  </button>
                ))}
              </div>
              <Button variant="ghost" className="mt-3" onClick={() => setShowAll(true)}>Skip and show the full menu</Button>
            </section>
          ) : (
            <div className="no-scrollbar -mx-4 mb-3 flex items-center gap-2 overflow-x-auto px-4 md:mx-0 md:px-0" role="group" aria-label="Food type">
              <span className="shrink-0 text-xs font-medium text-text-muted">Food type</span>
              {foodTypes.map((t) => <Chip key={t.id} active={t.id === fn.foodTypeId} onClick={() => pickFoodType(t.id)} className="shrink-0">{t.name}</Chip>)}
              {foodType && (hiddenCategories > 0 || showAll) && (
                <Chip active={showAll} onClick={() => setShowAll(!showAll)} className="shrink-0 border-dashed">{showAll ? "Only this food type" : `Show all categories (+${hiddenCategories})`}</Chip>
              )}
            </div>
          )}

          {!needsFoodType && (<>
          {/* Toolbar: search and the everyday filters in one row; the rest folds under Filters. */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-48 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-text-muted" strokeWidth={1.75} />
              <span className="sr-only">Search dishes</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search dishes in English or Gujarati" className="h-11 w-full rounded-xl border bg-surface pl-10 pr-9 text-sm placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
              {query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-text-muted hover:bg-surface-muted"><X className="size-4" strokeWidth={1.75} /></button>}
            </label>
            <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
              {(["veg", "jain"] as Diet[]).map((d) => (
                <Chip key={d} active={diets.includes(d)} onClick={() => setDiets((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))} className="h-11 shrink-0"><VegMark diet={d} />{dietLabel(d)}</Chip>
              ))}
              <Chip active={bestsellers} onClick={() => setBestsellers(!bestsellers)} className="h-11 shrink-0"><Star strokeWidth={1.75} />Bestsellers</Chip>
              <Chip active={more || extraFilters > 0} onClick={() => setMore(!more)} className="h-11 shrink-0"><SlidersHorizontal strokeWidth={1.75} />Filters{extraFilters > 0 && <span className="tnum rounded-full bg-primary px-1.5 text-xs text-primary-fg">{extraFilters}</span>}</Chip>
              <Button variant="secondary" size="icon-lg" className="shrink-0 rounded-xl" onClick={() => setView(view === "grid" ? "list" : "grid")} aria-label={view === "grid" ? "Compact list" : "Photo grid"} title={view === "grid" ? "Compact list" : "Photo grid"}>
                {view === "grid" ? <List strokeWidth={1.75} /> : <LayoutGrid strokeWidth={1.75} />}
              </Button>
            </div>
          </div>
          {more && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border bg-surface p-2">
              <Chip active={diets.includes("nonveg")} onClick={() => setDiets((cur) => (cur.includes("nonveg") ? cur.filter((x) => x !== "nonveg") : [...cur, "nonveg"]))}><VegMark diet="nonveg" />{dietLabel("nonveg")}</Chip>
              {!booking && <Chip active={source === "inhouse"} onClick={() => setSource(source === "inhouse" ? "all" : "inhouse")}>In-house</Chip>}
              {!booking && <Chip active={source === "outsourced"} onClick={() => setSource(source === "outsourced" ? "all" : "outsourced")}>Outsourced</Chip>}
              <Select aria-label="Cuisine" value={cuisine} onChange={(e) => setCuisine(e.target.value)} className="!h-9 w-auto rounded-full bg-surface"><option value="">Any cuisine</option>{cuisines.map((c) => <option key={c}>{c}</option>)}</Select>
              {!hidePrices && <Select aria-label="Price" value={priceMax} onChange={(e) => setPriceMax(Number(e.target.value))} className="!h-9 w-auto rounded-full bg-surface">{priceBands.map((b) => <option key={b.max} value={b.max}>{b.label}</option>)}</Select>}
              <Select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="!h-9 w-auto rounded-full bg-surface"><option value="popular">Most popular</option>{!hidePrices && <option value="price">Price, low to high</option>}<option value="name">Name</option></Select>
              {filtering && <Button variant="ghost" onClick={clearFilters}>Clear all</Button>}
            </div>
          )}

          {/* Category tabs, sticky under the page header */}
          <div ref={tabsRef} className="no-scrollbar sticky z-10 -mx-4 mt-3 flex gap-1.5 overflow-x-auto border-b bg-bg/95 px-4 py-2 backdrop-blur md:mx-0 md:px-0" style={{ top }} role="tablist" aria-label="Menu categories">
            {grouped.map(({ c }) => {
              const Icon = categoryIcon(c.icon);
              const rule = ruleFor(c.id);
              const count = countIn(c.id);
              const active = (current || grouped[0]?.c.id) === c.id;
              return (
                <button key={c.id} type="button" role="tab" aria-selected={active} data-tab={c.id} onClick={() => jump(c.id)} className={cn("flex h-10 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors", active ? "border-primary bg-primary text-primary-fg" : "bg-surface text-text-muted hover:text-text")}>
                  <Icon className="size-4" strokeWidth={1.75} />
                  {c.name}
                  {rule ? (
                    <span className={cn("tnum rounded-full px-1.5 text-xs", active ? "bg-primary-fg/20" : rule.met ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>{Math.min(rule.chosen, rule.choose)}/{rule.choose}</span>
                  ) : count > 0 ? (
                    <span className={cn("tnum rounded-full px-1.5 text-xs", active ? "bg-primary-fg/20" : "bg-primary-soft text-primary")}>{count}</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {beforeRow.length > 0 && (
            <section className="mt-4">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">This client ordered before</h3>
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

          {grouped.length === 0 && (
            <div className="mt-10 text-center text-sm text-text-muted">
              <p>No dishes match these filters.</p>
              <Button variant="ghost" className="mt-2" onClick={clearFilters}>Clear filters</Button>
            </div>
          )}

          {grouped.map(({ c, dishes }) => {
            const rule = ruleFor(c.id);
            return (
              <section key={c.id} data-section={c.id} ref={(el) => { if (el) sections.current.set(c.id, el); else sections.current.delete(c.id); }} className="mt-6">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-heading text-lg font-semibold">{c.name}</h3>
                  <span className="text-xs text-text-muted">
                    {rule ? <span className={rule.met ? "text-success" : "text-warning"}>{rule.met ? "Package choice done" : `Choose ${rule.choose - Math.min(rule.chosen, rule.choose)} more for the package`}</span> : `${dishes.length} ${dishes.length === 1 ? "dish" : "dishes"}`}
                    {rule && rule.chosen > rule.choose && !hidePrices && <span className="text-warning"> · {rule.chosen - rule.choose} beyond the package</span>}
                  </span>
                </div>
                {dishGrid(dishes)}
              </section>
            );
          })}
          </>)}
        </div>

        {/* Plate summary panel */}
        <aside className="sticky hidden w-[300px] shrink-0 flex-col overflow-hidden rounded-2xl border bg-surface shadow-card lg:flex xl:w-[340px]" style={{ top, maxHeight: `calc(100dvh - ${top + 16}px)` }} aria-label="Plate summary">
          {summary}
        </aside>
      </div>

      {/* Mobile and tablet: sticky bar that expands into a bottom sheet */}
      <button type="button" onClick={() => setSummaryOpen(true)} className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t bg-surface px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 text-left shadow-sheet lg:hidden">
        <span className="tnum min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{fn.itemIds.length} dishes{hidePrices ? "" : ` · ${money(price.perPlate)} per plate`}</span>
          <span className="block truncate text-xs text-text-muted">{fn.name} · {num(fn.pax)} guests{hidePrices ? "" : ` · ${money(totals.grand)} total`}{warnings.length ? ` · ${warnings.length} to check` : ""}</span>
        </span>
        <span className="flex h-11 items-center gap-1 rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg">Review<ChevronUp className="size-5" strokeWidth={1.75} /></span>
      </button>
      <Sheet open={summaryOpen} onOpenChange={setSummaryOpen} title="Plate summary">
        <div className="-mx-4 -mb-4 flex min-h-0 flex-col md:-mx-6">{summary}</div>
      </Sheet>

      <PackagePicker open={pickPackage} onOpenChange={setPickPackage} value={fn.packageId} pax={fn.pax} foodTypeId={fn.foodTypeId} onPick={choosePackage} />

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)} title={detail?.name ?? ""} description={detail?.nameLocal} wide>
        {detail && (
          <div className="space-y-4">
            <DishImage item={detail} sizes="(max-width: 768px) 100vw, 640px" className="rounded-2xl" />
            <div className="flex flex-wrap items-center gap-2">
              <VegMark diet={detail.diet} withLabel />
              {detail.cuisine && <Badge>{detail.cuisine}</Badge>}
              <Badge>{spiceWords[detail.spice]}</Badge>
              {detail.bestseller && <Badge tone="gold">Bestseller</Badge>}
              {detail.seasonal && <Badge tone="warning">Seasonal</Badge>}
            </div>
            {detail.description && <p className="text-base text-text-muted">{detail.description}</p>}
            {!hidePrices && <p className="tnum font-heading text-2xl font-bold">{priceLabel(detail)}</p>}
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
