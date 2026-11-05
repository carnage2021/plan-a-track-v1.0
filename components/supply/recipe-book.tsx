"use client";

import { AlertTriangle, BookOpen, ChevronRight, DatabaseZap, PackagePlus, Search, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/badges";
import { EmptyState, MoneyInput } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Card, Chip } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/sheet";
import { useAccess } from "@/lib/access";
import { fromDish, keptIn, nameKey, qtyText, summarise, type BookLine, type BookRecipe } from "@/lib/recipe-book";
import { guessSection, normUnit } from "@/lib/recipe-import";
import { useStore } from "@/lib/store";
import { useSupply } from "@/lib/supply-store";
import { sections, units, type Section } from "@/lib/supply-types";
import { cn, decimal, money, rate } from "@/lib/utils";

type Filter = "all" | "unlinked" | "missing";

/** Every recipe: those kept on the Recipes page, and those written straight on a dish before it. */
function useAllRecipes() {
  const { book, recipes, ingredients } = useSupply();
  const items = useStore((s) => s.items);
  return React.useMemo(() => {
    const linked = new Set(book.map((r) => r.itemId).filter(Boolean));
    const onDishes = items.filter((i) => !linked.has(i.id) && recipes.some((r) => r.itemId === i.id)).map((i) => ({ ...fromDish(i, recipes, ingredients), dishOnly: true }));
    return [...book.map((r) => ({ ...r, dishOnly: false })), ...onDishes];
  }, [book, recipes, ingredients, items]);
}

export function RecipeBook() {
  const params = useSearchParams();
  const { bookReady, ingredients } = useSupply();
  const role = useStore((s) => s.myRole);
  const all = useAllRecipes();
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [open, setOpen] = React.useState<string | null>(params.get("open"));
  const [including, setIncluding] = React.useState<BookLine | null>(null);

  // A recipe opened from a dish's details scrolls into view.
  React.useEffect(() => {
    const id = params.get("open");
    if (id) document.getElementById(`recipe-${id}`)?.scrollIntoView({ block: "center" });
  }, [params]);

  const rows = React.useMemo(() => all.map((r) => ({ recipe: r, sum: summarise(r, ingredients) })), [all, ingredients]);
  const q = nameKey(query);
  const shown = rows
    .filter(({ recipe }) => !q || nameKey(recipe.name).includes(q) || recipe.lines.some((l) => nameKey(l.name).includes(q)))
    .filter(({ recipe, sum }) => filter === "all" || (filter === "unlinked" ? !recipe.itemId : sum.missing + sum.unit > 0))
    // Recipes with something to sort out come first, then A to Z.
    .sort((a, b) => Number(b.sum.missing + b.sum.unit > 0 || !b.recipe.itemId) - Number(a.sum.missing + a.sum.unit > 0 || !a.recipe.itemId) || a.recipe.name.localeCompare(b.recipe.name, undefined, { sensitivity: "base" }));

  const unlinked = rows.filter((r) => !r.recipe.itemId).length;
  const notIncluded = new Set(rows.flatMap(({ sum }) => sum.states.filter((s) => s.state === "missing").map((s) => nameKey(s.line.name)))).size;

  return (
    <div className="space-y-4">
      {!bookReady && (
        <Card className="flex items-start gap-3 border-warning/40 bg-warning/5 p-4 text-sm">
          <DatabaseZap className="mt-0.5 size-5 shrink-0 text-warning" strokeWidth={1.75} />
          <p>{role === "owner" ? "Run supabase/migrations/0026_recipe_book.sql in the Supabase SQL editor, then reload. Until then this page shows the recipes on your dishes, and an upload saves only recipes of dishes already on the menu." : "Recipes for dishes not on the menu need one database update. Ask the owner to run it."}</p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Recipes" value={rows.length} />
        <Stat label="On a menu dish" value={rows.length - unlinked} />
        <Stat label="Not on the menu" value={unlinked} tone={unlinked ? "warning" : undefined} />
        <Stat label="Raw materials not included" value={notIncluded} tone={notIncluded ? "warning" : undefined} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" strokeWidth={1.75} />
          <Input className="pl-9" placeholder="Search a recipe or a raw material" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search recipes" />
        </div>
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>All</Chip>
        <Chip active={filter === "unlinked"} onClick={() => setFilter("unlinked")}>Not on the menu</Chip>
        <Chip active={filter === "missing"} onClick={() => setFilter("missing")}>Raw material not included</Chip>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={BookOpen} title="No recipes yet" help="Upload your recipe sheet: one row per raw material of a dish. Recipes for dishes not on your menu are kept here too." action={<Button variant="primary" asChild><Link href="/import?list=recipes"><Upload strokeWidth={1.75} />Upload recipes</Link></Button>} />
      ) : shown.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-text-muted">No recipe matches.</p>
      ) : (
        <Card className="divide-y overflow-hidden">
          {shown.map(({ recipe, sum }) => (
            <RecipeRow key={recipe.id} recipe={recipe} sum={sum} open={open === recipe.id} onToggle={() => setOpen((o) => (o === recipe.id ? null : recipe.id))} onInclude={setIncluding} />
          ))}
        </Card>
      )}

      <IncludeDialog line={including} onClose={() => setIncluding(null)} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warning" }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className={cn("tnum mt-1 font-heading text-2xl font-semibold", tone === "warning" && "text-warning")}>{value}</p>
    </Card>
  );
}

type Row = BookRecipe & { dishOnly: boolean };
type Sum = ReturnType<typeof summarise>;

function RecipeRow({ recipe, sum, open, onToggle, onInclude }: { recipe: Row; sum: Sum; open: boolean; onToggle: () => void; onInclude: (l: BookLine) => void }) {
  const items = useStore((s) => s.items);
  const role = useStore((s) => s.myRole);
  const { hidePrices } = useAccess();
  const showCost = role === "owner" || !hidePrices;
  const dish = items.find((i) => i.id === recipe.itemId);
  const toFix = sum.missing + sum.unit;
  return (
    <section id={`recipe-${recipe.id}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-muted/60">
        <ChevronRight className={cn("size-4 shrink-0 text-text-muted transition-transform", open && "rotate-90")} strokeWidth={2} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium" data-no-title-case>{recipe.name}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
            {dish ? <Badge tone="success">On the menu{nameKey(dish.name) !== nameKey(recipe.name) ? `: ${dish.name}` : ""}</Badge> : <Badge tone="neutral">Not on the menu</Badge>}
            {toFix > 0 && <Badge tone="warning">{sum.missing > 0 ? `${sum.missing} not included` : ""}{sum.missing > 0 && sum.unit > 0 ? " · " : ""}{sum.unit > 0 ? `${sum.unit} unit to check` : ""}</Badge>}
            <span>{recipe.lines.length} raw {recipe.lines.length === 1 ? "material" : "materials"} · for {recipe.recipeBase} guests</span>
          </span>
        </span>
        {showCost && sum.total > 0 && (
          <span className="tnum shrink-0 text-right text-sm">
            <span className="block font-medium">{rate(Math.round(sum.perPlate * 100) / 100)}</span>
            <span className="block text-xs text-text-muted" data-no-title-case>a plate{toFix || sum.unpriced ? ", so far" : ""}</span>
          </span>
        )}
      </button>
      {open && <RecipeDetail recipe={recipe} sum={sum} showCost={showCost} onInclude={onInclude} />}
    </section>
  );
}

function RecipeDetail({ recipe, sum, showCost, onInclude }: { recipe: Row; sum: Sum; showCost: boolean; onInclude: (l: BookLine) => void }) {
  const items = useStore((s) => s.items);
  const { recipes, linkBook, deleteBook } = useSupply();
  const role = useStore((s) => s.myRole);
  const canInclude = role === "owner" || role === "store" || role === "kitchen";
  const [deleting, setDeleting] = React.useState(false);
  const dish = items.find((i) => i.id === recipe.itemId);
  const dishHasOwn = (itemId: string) => recipes.some((r) => r.itemId === itemId);

  const link = (itemId: string) => {
    const target = items.find((i) => i.id === itemId);
    const res = linkBook(recipe.id, itemId || undefined);
    if (!target) toast.success(`${recipe.name} is no longer linked to a dish`, { description: "The dish keeps the recipe it has." });
    else if (res === "applied") toast.success(`${recipe.name} is now the recipe of ${target.name}`, { description: "Raw material lists and food cost follow it." });
    else toast.success(`Linked to ${target.name}`, { description: "The dish takes this recipe once every raw material below is included." });
  };

  return (
    <div className="animate-unfold space-y-3 border-t bg-surface-muted/30 px-4 pb-4 pt-3">
      <p className="text-xs text-text-muted">Written for {recipe.recipeBase} guests, with {decimal(recipe.bufferPct)}% wastage added when it is scaled to an event.</p>
      <div className="overflow-x-auto rounded-xl border bg-surface">
        <table className="tnum w-full min-w-[560px] text-left text-sm">
          <thead className="bg-surface-muted text-xs text-text-muted">
            <tr><th className="px-3 py-2 font-medium">Raw material</th><th className="py-2 pr-3 font-medium">Quantity</th>{showCost && <><th className="py-2 pr-3 font-medium">Rate</th><th className="py-2 pr-3 text-right font-medium">Amount</th></>}</tr>
          </thead>
          <tbody className="divide-y">
            {sum.states.map((s, i) => (
              <tr key={i} className={cn(s.state !== "ok" && "bg-warning/5")}>
                <td className="px-3 py-2"><span data-no-title-case>{s.state === "ok" ? s.ingredient.name : s.line.name}</span></td>
                <td className="py-2 pr-3">
                  {s.state === "ok" ? qtyText(s.qty, s.ingredient.unit) : qtyText(s.line.qty, s.line.unit)}
                  {s.state === "ok" && s.line.unit && normUnit(s.line.unit) !== normUnit(s.ingredient.unit) && <span className="block text-xs text-text-muted">{qtyText(s.line.qty, s.line.unit)} in the sheet</span>}
                </td>
                {showCost && (
                  s.state === "ok" ? (
                    <>
                      <td className="py-2 pr-3">{s.ingredient.lastRate > 0 ? `${rate(s.ingredient.lastRate)} / ${s.ingredient.unit}` : <span className="text-warning">No rate yet</span>}</td>
                      <td className="py-2 pr-3 text-right">{s.ingredient.lastRate > 0 ? rate(Math.round(s.amount * 100) / 100) : "-"}</td>
                    </>
                  ) : (
                    <td colSpan={2} className="py-2 pr-3 text-right">
                      {s.state === "missing" ? (
                        <span className="inline-flex flex-wrap items-center justify-end gap-2">
                          <Badge tone="warning">Not included</Badge>
                          {canInclude && <Button className="!h-8" variant="primary" onClick={() => onInclude(s.line)}><PackagePlus strokeWidth={1.75} />Include</Button>}
                        </span>
                      ) : (
                        <span className="text-xs text-warning">{s.ingredient.name} is kept in {s.ingredient.unit}; {normUnit(s.line.unit)} does not change into it. Fix the unit in the sheet and upload again.</span>
                      )}
                    </td>
                  )
                )}
                {!showCost && s.state !== "ok" && <td className="sr-only">{s.state === "missing" ? "Not included" : "Unit to check"}</td>}
              </tr>
            ))}
          </tbody>
          {showCost && (
            <tfoot className="border-t bg-surface-muted/60 text-sm">
              <tr>
                <td className="px-3 py-2 font-medium" colSpan={3}>Total for {recipe.recipeBase} guests{sum.missing + sum.unit + sum.unpriced > 0 ? " (without the raw materials not included or with no rate)" : ""}</td>
                <td className="py-2 pr-3 text-right font-semibold">{money(sum.total)}</td>
              </tr>
              <tr><td className="px-3 pb-2 text-text-muted" colSpan={3}>Per plate</td><td className="pb-2 pr-3 text-right font-medium">{rate(Math.round(sum.perPlate * 100) / 100)}</td></tr>
            </tfoot>
          )}
        </table>
      </div>

      {recipe.dishOnly ? (
        <p className="text-sm text-text-muted">Written on the dish itself. Change it from the dish on the <Link className="text-primary hover:underline" href={`/menu?q=${encodeURIComponent(recipe.name)}`}>Menu</Link> page.</p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Dish on the menu" className="min-w-64 flex-1" hint={dish ? (sum.complete ? `This is the recipe of ${dish.name}: raw material lists and food cost use it.` : `${dish.name} takes this recipe once every raw material above is included.`) : "Link it to a dish to use it for raw material lists and food cost."}>
            <Select value={recipe.itemId ?? ""} onChange={(e) => link(e.target.value)} aria-label={`Dish for ${recipe.name}`}>
              <option value="">Not linked to a dish</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.name}{i.id !== recipe.itemId && dishHasOwn(i.id) ? " (has a recipe, replaced)" : ""}</option>)}
            </Select>
          </Field>
          <Button variant="ghost" onClick={() => setDeleting(true)}><Trash2 strokeWidth={1.75} />Delete recipe</Button>
        </div>
      )}
      {!recipe.dishOnly && !dish && sum.missing > 0 && <p className="flex items-center gap-2 text-xs text-text-muted"><AlertTriangle className="size-4 text-warning" strokeWidth={1.75} />Include the raw materials marked above so the recipe is complete before you link it.</p>}

      <Modal open={deleting} onOpenChange={setDeleting} title={`Delete the recipe "${recipe.name}"?`} description={dish ? `${dish.name} keeps the recipe it has now; only this copy on the Recipes page goes.` : "It is removed from the Recipes page."}
        footer={<><Button variant="ghost" onClick={() => setDeleting(false)}>Cancel</Button><Button variant="danger" onClick={() => { deleteBook(recipe.id); setDeleting(false); toast.success("Recipe deleted"); }}>Delete</Button></>}>{null}</Modal>
    </div>
  );
}

/** Adds a raw material a recipe uses to the inventory, with its rate, so every recipe using it is complete. */
function IncludeDialog({ line, onClose }: { line: BookLine | null; onClose: () => void }) {
  const { ingredients, book, saveIngredient, saveBook, applyBookAll } = useSupply();
  const [form, setForm] = React.useState({ name: "", unit: "kg", section: "grocery" as Section, rate: 0 });
  const [opened, setOpened] = React.useState<BookLine | null>(null);
  // Filled afresh for each raw material opened.
  if (line && line !== opened) {
    setOpened(line);
    setForm({ name: line.name.trim(), unit: keptIn(line.unit), section: guessSection(line.name), rate: 0 });
  }
  const usedIn = line ? book.filter((r) => r.lines.some((l) => nameKey(l.name) === nameKey(line.name))) : [];
  const same = ingredients.find((i) => nameKey(i.name) === nameKey(form.name));
  const valid = !!form.name.trim() && form.rate > 0;

  const save = () => {
    if (!line || !valid) return;
    const id = saveIngredient({ ...(same ?? {}), name: same?.name ?? form.name.trim(), unit: same?.unit ?? form.unit, section: same?.section ?? form.section, lastRate: form.rate, reorderLevel: same?.reorderLevel ?? 0, location: same?.location ?? "", id: same?.id });
    // Typed under another name: every recipe line with the sheet's name points at it.
    if (nameKey(form.name) !== nameKey(line.name)) for (const r of usedIn) saveBook({ ...r, lines: r.lines.map((l) => (nameKey(l.name) === nameKey(line.name) ? { ...l, ingredientId: id } : l)) });
    const applied = applyBookAll();
    toast.success(`${same?.name ?? form.name.trim()} is in your raw materials`, { description: `Used in ${usedIn.length} ${usedIn.length === 1 ? "recipe" : "recipes"}.${applied ? ` ${applied} ${applied === 1 ? "dish now uses its recipe" : "dishes now use their recipes"}.` : ""}` });
    onClose();
  };

  return (
    <Modal open={!!line} onOpenChange={(o) => !o && onClose()} title="Include a raw material" description={line ? `Added to your raw materials with its purchase rate. Used in ${usedIn.map((r) => r.name).slice(0, 3).join(", ")}${usedIn.length > 3 ? ` and ${usedIn.length - 3} more` : ""}.` : undefined}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid} onClick={save}><PackagePlus strokeWidth={1.75} />Include</Button></>}>
      <div className="space-y-3">
        <Field label="Raw material name *" hint={same ? `Already in your raw materials as ${same.name} (${same.unit}): its rate is updated and the recipe uses it.` : undefined}>
          <Input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kept in" hint={line?.unit ? `The recipe says ${normUnit(line.unit) || line.unit}` : undefined}>
            <Select value={same?.unit ?? form.unit} disabled={!!same} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}>{[...new Set([form.unit, ...units])].map((u) => <option key={u}>{u}</option>)}</Select>
          </Field>
          <Field label="Section">
            <Select value={same?.section ?? form.section} disabled={!!same} onChange={(e) => setForm((f) => ({ ...f, section: e.target.value as Section }))}>{sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select>
          </Field>
        </div>
        <Field label={`Purchase rate per ${same?.unit ?? form.unit} *`}>
          <MoneyInput value={form.rate} onChange={(v) => setForm((f) => ({ ...f, rate: v }))} label="Purchase rate" />
        </Field>
      </div>
    </Modal>
  );
}
