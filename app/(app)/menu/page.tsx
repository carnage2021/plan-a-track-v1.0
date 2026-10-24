"use client";

import { Check, ImageOff, LayoutGrid, PencilLine, Plus, Search, Settings2, Shapes, Soup, TrendingUp, Users, UtensilsCrossed, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { CategoriesEditor } from "@/components/menu/categories";
import { FoodTypesEditor } from "@/components/menu/food-types";
import { ItemSheet, PackageSheet } from "@/components/menu/item-sheet";
import { PackageCollage } from "@/components/menu/package-picker";
import { Badge, VegMark } from "@/components/shared/badges";
import { EmptyState, PageHeader } from "@/components/shared/blocks";
import { DishImage, dishTag, priceLabel } from "@/components/shared/dish";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip, Skeleton, Switch, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/sheet";
import { categoryIcon } from "@/lib/icons";
import { offered, packageLines } from "@/lib/packages";
import { marginTone } from "@/lib/pricing";
import { useFoodTypes } from "@/lib/services";
import { useCurrentUser, useStore } from "@/lib/store";
import type { MenuItem, MenuPackage } from "@/lib/types";
import { cn, money } from "@/lib/utils";
import { useAccess } from "@/lib/access";

function Menu() {
  const params = useSearchParams();
  const role = useCurrentUser().role;
  const { items, categories, packages: allPackages } = useStore();
  const packages = offered(allPackages);
  const patchItems = useStore((s) => s.patchItems);
  const raisePrices = useStore((s) => s.raisePrices);
  const restoreItems = useStore((s) => s.restoreItems);
  const canEdit = role === "owner" || role === "sales";
  const { hidePrices } = useAccess();
  const foodTypes = useFoodTypes();
  const seesCost = (role === "owner" || role === "sales") && !hidePrices;

  const [category, setCategory] = React.useState("all");
  const [query, setQuery] = React.useState(params.get("q") ?? "");
  const [noPhoto, setNoPhoto] = React.useState(false);
  const [offOnly, setOffOnly] = React.useState(false);
  const [picked, setPicked] = React.useState<string[]>([]);
  const [tab, setTab] = React.useState(() => (["categories", "packages", "food-types"].includes(params.get("tab") ?? "") ? params.get("tab")! : "dishes"));
  const [editing, setEditing] = React.useState<MenuItem | "new" | null>(null);
  const [editingPkg, setEditingPkg] = React.useState<MenuPackage | "new" | null>(null);
  const [raise, setRaise] = React.useState(false);
  const [pct, setPct] = React.useState("5");

  const visible = items
    .filter((i) => category === "all" || i.categoryId === category)
    .filter((i) => !query.trim() || i.name.toLowerCase().includes(query.trim().toLowerCase()) || i.nameLocal.includes(query.trim()))
    .filter((i) => !noPhoto || !i.photo)
    .filter((i) => !offOnly || !i.active);
  const missing = items.filter((i) => !i.photo).length;

  /** Every bulk change can be undone from the toast instead of asking for confirmation first. */
  const withUndo = (message: string, change: () => void) => {
    const before = useStore.getState().items;
    change();
    setPicked([]);
    toast(message, { action: { label: "Undo", onClick: () => restoreItems(before) } });
  };
  const togglePick = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <>
      <PageHeader title="Menu" subtitle={`${items.filter((i) => i.active).length} dishes on the menu, ${packages.length} packages.`} action={canEdit && <Button variant="primary" onClick={() => setEditing("new")}><Plus strokeWidth={2} /><span className="max-sm:hidden">Add dish</span></Button>} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="dishes"><UtensilsCrossed className="size-5" strokeWidth={1.75} />Dishes</TabsTrigger>
          <TabsTrigger value="categories"><Shapes className="size-5" strokeWidth={1.75} />Categories</TabsTrigger>
          <TabsTrigger value="packages"><LayoutGrid className="size-5" strokeWidth={1.75} />Packages</TabsTrigger>
          <TabsTrigger value="food-types"><Soup className="size-5" strokeWidth={1.75} />Food types</TabsTrigger>
        </TabsList>

        <TabsContent value="dishes">
          <div className="flex items-start gap-6">
            <nav className="sticky top-20 hidden w-52 shrink-0 space-y-0.5 lg:block" aria-label="Categories">
              {[{ id: "all", name: "All dishes", icon: "" }, ...categories].map((c) => {
                const Icon = c.id === "all" ? LayoutGrid : categoryIcon(c.icon);
                return (
                  <button key={c.id} type="button" onClick={() => setCategory(c.id)} aria-pressed={category === c.id} className={cn("flex h-10 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm font-medium transition-colors duration-150", category === c.id ? "bg-primary-soft text-primary" : "text-text-muted hover:bg-surface-muted hover:text-text")}>
                    <Icon className="size-5 shrink-0" strokeWidth={1.75} /><span className="flex-1 truncate">{c.name}</span>
                    <span className="tnum text-xs">{c.id === "all" ? items.length : items.filter((i) => i.categoryId === c.id).length}</span>
                  </button>
                );
              })}
              {canEdit && (
                <button type="button" onClick={() => setTab("categories")} className="flex h-10 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm font-medium text-primary hover:bg-primary-soft">
                  <Settings2 className="size-5 shrink-0" strokeWidth={1.75} />Manage categories
                </button>
              )}
            </nav>

            <div className="min-w-0 flex-1">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-text-muted" strokeWidth={1.75} />
                <span className="sr-only">Search the menu</span>
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the menu in English or Gujarati" className="!h-11 bg-surface pl-10" />
              </label>
              <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
                <span className="contents lg:hidden">{[{ id: "all", name: "All" }, ...categories].map((c) => <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>{c.name}</Chip>)}{canEdit && <Chip onClick={() => setTab("categories")}><Settings2 strokeWidth={1.75} />Categories</Chip>}</span>
                <Chip active={noPhoto} onClick={() => setNoPhoto(!noPhoto)}><ImageOff strokeWidth={1.75} />Missing photo<span className="tnum text-xs">{missing}</span></Chip>
                <Chip active={offOnly} onClick={() => setOffOnly(!offOnly)}>Switched off</Chip>
              </div>

              {visible.length === 0 ? (
                <div className="mt-6"><EmptyState icon={UtensilsCrossed} title="No dishes match" help="Clear the search or filters, or add this dish to your menu." action={canEdit && <Button variant="primary" onClick={() => setEditing("new")}>Add dish</Button>} /></div>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                  {visible.map((i) => {
                    const margin = i.price ? ((i.price - i.cost) / i.price) * 100 : 0;
                    const isPicked = picked.includes(i.id);
                    const tag = dishTag(i);
                    return (
                      <article key={i.id} className={cn("relative flex flex-col rounded-2xl border bg-surface p-2 transition-colors duration-150", isPicked ? "border-primary bg-primary-soft" : "border-border")}>
                        <button type="button" disabled={!canEdit} onClick={() => setEditing(i)} className="relative block rounded-2xl text-left disabled:cursor-default" aria-label={`Edit ${i.name}`}>
                          <DishImage item={i} className={cn(!i.active && "opacity-50 grayscale")} />
                          <span className="absolute left-2 top-2"><VegMark diet={i.diet} /></span>
                          {tag && <Badge tone={tag === "Bestseller" ? "gold" : "neutral"} className="absolute bottom-2 left-2 bg-surface">{tag}</Badge>}
                        </button>
                        {canEdit && (
                          <button type="button" onClick={() => togglePick(i.id)} aria-pressed={isPicked} aria-label={`Select ${i.name}`} className={cn("absolute right-4 top-4 grid size-7 place-items-center rounded-lg border-2 transition-colors duration-150", isPicked ? "border-primary bg-primary text-primary-fg" : "border-surface bg-surface/80 text-transparent hover:text-text-muted")}>
                            <Check className="size-4" strokeWidth={2.5} />
                          </button>
                        )}
                        <div className="flex flex-1 flex-col px-1 pb-1 pt-3">
                          <h3 className="truncate font-heading text-base font-semibold">{i.name}</h3>
                          <p className="truncate text-xs text-text-muted">{i.nameLocal || "No local name"}</p>
                          <div className="mt-2 flex items-end justify-between gap-2">
                            <div className="tnum min-w-0">
                              {!hidePrices && <p className="truncate text-sm font-medium">{priceLabel(i)}</p>}
                              {seesCost && <p className="flex items-center gap-1.5 text-xs text-text-muted">Cost {money(i.cost)}<Badge tone={marginTone(margin)} className="h-5 px-1.5">{Math.round(margin)}%</Badge></p>}
                            </div>
                            {canEdit && <Switch checked={i.active} label={`${i.name} available`} onCheckedChange={(v) => { patchItems([i.id], { active: v }); toast(`${i.name} switched ${v ? "on" : "off"}`, { action: { label: "Undo", onClick: () => patchItems([i.id], { active: !v }) } }); }} />}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="packages">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {packages.map((p) => (
              <article key={p.id} className="flex flex-col rounded-2xl border bg-surface p-2 shadow-card">
                <div className="relative"><PackageCollage pkg={p} />{p.tier === "premium" && <Badge tone="gold" className="absolute left-2 top-2 bg-surface">Premium</Badge>}</div>
                <div className="flex flex-1 flex-col px-2 pb-2 pt-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-heading text-xl font-semibold">{p.name}{p.foodTypeId && <Badge className="ml-2 align-middle">{foodTypes.find((t) => t.id === p.foodTypeId)?.name ?? "Food type removed"}</Badge>}</h3>
                    <p className="tnum text-sm"><span className="font-heading text-xl font-bold">{money(p.pricePerPlate)}</span> per plate</p>
                  </div>
                  <p className="mt-1 text-sm text-text-muted">{p.description}</p>
                  <p className="tnum mt-2 flex items-center gap-1.5 text-xs text-text-muted"><Users className="size-3.5" strokeWidth={1.75} />Minimum {p.minPax} guests · {p.fixedItemIds.length} dishes always included</p>
                  <ul className="mt-3 flex-1 space-y-1 text-sm">
                    {packageLines(p, categories).map((line, k) => <li key={k} className="flex items-center gap-2"><Check className={cn("size-4 shrink-0", k < p.rules.length ? "text-success" : "text-accent-gold")} strokeWidth={2} />{line}</li>)}
                  </ul>
                  {canEdit && <Button className="mt-4" onClick={() => setEditingPkg(p)}><PencilLine strokeWidth={1.75} />Edit or delete</Button>}
                </div>
              </article>
            ))}
            {canEdit && (
              <button type="button" onClick={() => setEditingPkg("new")} className="grid min-h-48 place-items-center rounded-2xl border border-dashed text-sm font-medium text-text-muted transition-colors duration-150 hover:border-primary hover:text-primary">
                <span className="flex items-center gap-2"><Plus className="size-5" strokeWidth={1.75} />New package</span>
              </button>
            )}
          </div>
        </TabsContent>

        <TabsContent value="categories">
          <CategoriesEditor canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="food-types">
          <FoodTypesEditor />
        </TabsContent>
      </Tabs>

      {picked.length > 0 && (
        <div className="fixed inset-x-4 bottom-20 z-20 mx-auto flex max-w-2xl flex-wrap items-center gap-2 rounded-2xl border bg-surface p-2 pl-4 shadow-sheet md:bottom-6">
          <span className="tnum flex-1 text-sm font-medium">{picked.length} selected</span>
          <Button onClick={() => withUndo(`${picked.length} dishes switched on`, () => patchItems(picked, { active: true }))}>Switch on</Button>
          <Button onClick={() => withUndo(`${picked.length} dishes switched off`, () => patchItems(picked, { active: false }))}>Switch off</Button>
          <Button onClick={() => setRaise(true)}><TrendingUp strokeWidth={1.75} />Change price</Button>
          <Button variant="ghost" size="icon" aria-label="Clear selection" onClick={() => setPicked([])}><X strokeWidth={1.75} /></Button>
        </div>
      )}

      <Modal
        open={raise}
        onOpenChange={setRaise}
        title={`Change price of ${picked.length} dishes`}
        description="Enter a percentage. Use a minus sign to reduce prices."
        footer={<><Button variant="ghost" onClick={() => setRaise(false)}>Cancel</Button><Button variant="primary" disabled={!Number(pct)} onClick={() => { setRaise(false); withUndo(`Prices changed by ${Number(pct)}% on ${picked.length} dishes`, () => raisePrices(picked, Number(pct))); }}>Apply</Button></>}
      >
        <div className="flex items-center gap-2"><Input autoFocus inputMode="decimal" className="tnum w-24 text-center" value={pct} onChange={(e) => setPct(e.target.value.replace(/[^\d.-]/g, ""))} /><span className="text-sm text-text-muted">percent</span></div>
      </Modal>

      <ItemSheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)} item={editing && editing !== "new" ? editing : undefined} categoryId={category} />
      <PackageSheet open={!!editingPkg} onOpenChange={(o) => !o && setEditingPkg(null)} pkg={editingPkg && editingPkg !== "new" ? editingPkg : undefined} />
    </>
  );
}

export default function MenuPage() {
  return (
    <React.Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <Menu />
    </React.Suspense>
  );
}
