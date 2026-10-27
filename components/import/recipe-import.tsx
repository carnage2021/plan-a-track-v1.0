"use client";

import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, PackagePlus, Upload } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Card } from "@/components/ui/primitives";
import { download, readTable, useLeaveGuard, sheetSummary, toCsv, type Table } from "@/lib/imports";
import { analyse, recipeColumns, type RecipeSnapshot } from "@/lib/recipe-import";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase/client";
import { ingredientRow } from "@/lib/supply-db";
import { useSupply } from "@/lib/supply-store";
import { sections, units, type Section } from "@/lib/supply-types";
import { cn, isoDate, uid } from "@/lib/utils";

type SB = ReturnType<typeof supabase>;
async function ok(query: PromiseLike<{ error: { message: string } | null }>, what: string) {
  const { error } = await query;
  if (error) throw new Error(`${what}: ${error.message}`);
}

/**
 * Writes many dishes' recipes with their guest count, wastage and food cost. Done in batches (a few calls for the
 * whole file, not three per dish), so even hundreds of recipes save in seconds.
 */
async function writeRecipes(sb: SB, list: RecipeSnapshot[]) {
  const ids = list.map((s) => s.itemId);
  for (let i = 0; i < ids.length; i += 100) await ok(sb.from("recipe_lines").delete().in("item_id", ids.slice(i, i + 100)), "Clearing the old recipes");
  const lines = list.flatMap((s) => s.lines.map((l) => ({ item_id: s.itemId, ingredient_id: l.ingredientId, qty: l.qty })));
  for (let i = 0; i < lines.length; i += 500) await ok(sb.from("recipe_lines").insert(lines.slice(i, i + 500)), "Saving the recipes");
  // Each dish has its own guest count and cost, so these go as single updates, ten at a time.
  for (let i = 0; i < list.length; i += 10) {
    await Promise.all(list.slice(i, i + 10).map((s) => ok(sb.from("menu_items").update({ recipe_base: s.recipeBase, buffer_pct: s.bufferPct, cost: s.cost }).eq("id", s.itemId), "Saving the dishes")));
  }
}

/** Puts back the recipes a recipe upload replaced. Used by Undo on the Import page. */
export async function undoRecipeUpload(ids: Record<string, string[]>) {
  const sb = supabase();
  await writeRecipes(sb, (ids._before ?? []).map((text) => JSON.parse(text) as RecipeSnapshot));
  await useSupply.getState().load();
}

export function RecipeImport({ onSaved }: { onSaved: () => void }) {
  const items = useStore((s) => s.items);
  const reload = useStore((s) => s.reload);
  const { ingredients, recipes, ready } = useSupply();
  const [file, setFile] = React.useState<{ name: string; table: Table } | null>(null);
  const [overrides, setOverrides] = React.useState<Record<string, { unit?: string; section?: Section }>>({});
  const [busy, setBusy] = React.useState<"" | "adding" | "importing">("");
  const input = React.useRef<HTMLInputElement>(null);
  useLeaveGuard(!!busy);

  // Rechecked whenever the inventory changes, so added raw materials free up their dishes at once.
  const result = React.useMemo(() => (file ? analyse(file.table, items, ingredients, recipes) : null), [file, items, ingredients, recipes]);

  const onFile = async (f?: File) => {
    if (!f) return;
    try {
      // A blank Dish (or merged Dish cells) takes the dish above it, or the sheet's name when each dish has its own sheet.
      setFile({ name: f.name, table: await readTable(f, recipeColumns.map((c) => c.label), "Dish") });
      setOverrides({});
    } catch (e) {
      toast.error("That file could not be read", { description: e instanceof Error ? e.message : "Save it as .xlsx or .csv and try again." });
    } finally {
      if (input.current) input.current.value = "";
    }
  };

  const addMissing = async () => {
    if (!result?.missing.length) return;
    setBusy("adding");
    const sb = supabase();
    const rows = result.missing.map((m) => ingredientRow({ id: uid(), name: m.name.trim(), unit: overrides[m.name]?.unit ?? m.unit, section: overrides[m.name]?.section ?? m.section, reorderLevel: 0, lastRate: 0, location: "" }));
    try {
      await ok(sb.from("ingredients").insert(rows), "Adding raw materials");
      // Recorded like an ingredients upload, so it shows under Recent uploads and can be undone there.
      await sb.from("imports").insert({ list: "ingredients", file_name: `${file!.name} (raw materials for recipes)`, row_count: rows.length, ids: { ingredients: rows.map((r) => r.id as string) } });
      await useSupply.getState().load();
      toast.success(`${rows.length} raw ${rows.length === 1 ? "material" : "materials"} added to your inventory`, { description: "Add their purchase rates on the Purchase and Stock page so food cost is worked out." });
      onSaved();
    } catch (e) {
      toast.error("The raw materials were not added", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy("");
    }
  };

  const importRecipes = async () => {
    if (!result?.ready.length) return;
    setBusy("importing");
    const sb = supabase();
    const rate = new Map(ingredients.map((i) => [i.id, i.lastRate]));
    const before: RecipeSnapshot[] = result.ready.map((p) => ({ itemId: p.item.id, recipeBase: p.item.recipeBase || 100, bufferPct: p.item.bufferPct ?? 5, cost: p.item.cost, lines: recipes.filter((r) => r.itemId === p.item.id).map((r) => ({ ingredientId: r.ingredientId, qty: r.qty })) }));
    const next: RecipeSnapshot[] = result.ready.map((p) => {
      const lines = [...p.lines].map(([ingredientId, qty]) => ({ ingredientId, qty }));
      // Food cost follows the recipe once every raw material in it has a purchase rate; until then it stays.
      const priced = lines.every((l) => (rate.get(l.ingredientId) ?? 0) > 0);
      const cost = priced ? Math.round((lines.reduce((s, l) => s + l.qty * rate.get(l.ingredientId)!, 0) / p.recipeBase) * 100) / 100 : p.item.cost;
      return { itemId: p.item.id, recipeBase: p.recipeBase, bufferPct: p.bufferPct, cost, lines };
    });
    try {
      await writeRecipes(sb, next);
      await ok(sb.from("imports").insert({ list: "recipes", file_name: file!.name, row_count: result.ready.length, ids: { recipes: result.ready.map((p) => p.item.id), _before: before.map((b) => JSON.stringify(b)) } }), "Recording the upload");
      toast.success(`Recipes saved for ${result.ready.length} ${result.ready.length === 1 ? "dish" : "dishes"}`, { description: "You can undo this upload below." });
      setFile(null);
    } catch (e) {
      // Put back every dish as it was, so a half upload never lingers.
      await writeRecipes(sb, before).catch(() => undefined);
      toast.error("No recipes were changed", { description: e instanceof Error ? e.message : undefined });
    } finally {
      await useSupply.getState().load();
      await reload();
      onSaved();
      setBusy("");
    }
  };

  const template = () =>
    download("recipes-template.csv", toCsv(recipeColumns.map((c) => c.label), [
      ["Paneer Tikka", "Paneer", "12", "kg", "100", "5"],
      ["Paneer Tikka", "Curd", "3", "kg", "100", "5"],
      ["Paneer Tikka", "Capsicum", "4", "kg", "100", "5"],
      ["Dal Makhani", "Urad dal", "6", "kg", "100", "3"],
      ["Dal Makhani", "Butter", "1500", "g", "100", "3"],
    ]));
  const exportAll = () => {
    const rows = recipes.flatMap((r) => {
      const item = items.find((i) => i.id === r.itemId);
      const ing = ingredients.find((i) => i.id === r.ingredientId);
      return item && ing ? [[item.name, ing.name, String(r.qty), ing.unit, String(item.recipeBase || 100), String(item.bufferPct ?? 5)]] : [];
    }).sort((a, b) => a[0].localeCompare(b[0]));
    download(`recipes-${isoDate(new Date())}.csv`, toCsv(recipeColumns.map((c) => c.label), rows));
    toast.success(`${rows.length} recipe lines exported`);
  };

  if (!ready) return <Card className="p-5 text-sm text-text-muted">Recipes need the Purchase and Stock module, which is not set up for this account yet.</Card>;

  const problems = result?.rows.filter((r) => r.errors.length) ?? [];
  const waiting = result?.plans.filter((p) => p.blocked && !p.lines.size && !problems.some((r) => r.dish.toLowerCase() === p.item.name.toLowerCase())).length ?? 0;
  const replacing = result?.ready.filter((p) => p.replaces).length ?? 0;

  return (
    <Card className="p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold">Recipes</h2>
          <p className="text-sm text-text-muted">One row per raw material of a dish. Columns: {recipeColumns.map((c) => c.label + (c.required ? "*" : "")).join(", ")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={template}><FileSpreadsheet strokeWidth={1.75} />Template</Button>
          <Button variant="ghost" onClick={exportAll}><Download strokeWidth={1.75} />Export</Button>
        </div>
      </div>
      <input ref={input} type="file" accept=".xlsx,.csv" className="sr-only" tabIndex={-1} aria-label="Choose a recipe file" onChange={(e) => onFile(e.target.files?.[0])} />
      <button type="button" onClick={() => input.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void onFile(e.dataTransfer.files[0]); }} className="mt-4 flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center text-text-muted transition-colors hover:border-primary hover:text-primary">
        <Upload className="size-8" strokeWidth={1.5} />
        <span className="font-medium text-text">Drop your recipe sheet here, or tap to choose</span>
        <span className="text-xs">Each dish in the sheet gets the sheet&apos;s recipe in full; dishes not in the sheet keep theirs. Units like g and kg are converted.</span>
      </button>

      {file && result && (
        <div className="mt-5 space-y-4">
          {result.missingColumns.length > 0 && <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">No {result.missingColumns.join(", ")} column was found. Each sheet needs a row with the column names from the template.</p>}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{file.name}</span>
            <Badge tone="success">{result.ready.length} {result.ready.length === 1 ? "dish" : "dishes"} ready</Badge>
            {replacing > 0 && <Badge tone="warning">{replacing} will replace an existing recipe</Badge>}
            {result.missing.length > 0 && <Badge tone="warning">{result.missing.length} raw materials to add</Badge>}
            {problems.length > 0 && <Badge tone="danger">{problems.length} rows with problems</Badge>}
            <Button variant="primary" className="ml-auto" loading={busy === "importing"} disabled={!result.ready.length || !!busy} onClick={importRecipes}><CheckCircle2 strokeWidth={1.75} />Import recipes for {result.ready.length} {result.ready.length === 1 ? "dish" : "dishes"}</Button>
          </div>
          {sheetSummary(file.table.sheets) && <p className="rounded-lg bg-surface-muted p-2 text-sm text-text-muted">{sheetSummary(file.table.sheets)}</p>}
          {result.unknown.length > 0 && <p className="rounded-lg bg-warning/10 p-2 text-sm text-warning">Columns not in the template are ignored: {result.unknown.join(", ")}</p>}

          {result.missing.length > 0 && (
            <section className="rounded-xl border border-warning/40 bg-warning/5 p-4">
              <h3 className="flex items-center gap-2 font-heading text-base font-semibold"><AlertTriangle className="size-5 text-warning" strokeWidth={1.75} />{result.missing.length} raw {result.missing.length === 1 ? "material is" : "materials are"} not in your inventory</h3>
              <p className="mt-1 text-sm text-text-muted">The recipes that use {result.missing.length === 1 ? "it" : "them"} wait until {result.missing.length === 1 ? "it is" : "they are"} added. Check the unit and section, then add them all at once.</p>
              <div className="mt-3 overflow-x-auto rounded-lg border bg-surface">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-surface-muted text-xs text-text-muted"><tr><th className="px-3 py-2 font-medium">Raw material</th><th className="py-2 pr-3 font-medium">Unit</th><th className="py-2 pr-3 font-medium">Section</th><th className="py-2 pr-3 font-medium">Used in</th></tr></thead>
                  <tbody className="divide-y">
                    {result.missing.map((m) => {
                      const unit = overrides[m.name]?.unit ?? m.unit;
                      return (
                        <tr key={m.name}>
                          <td className="px-3 py-1.5 font-medium">{m.name}</td>
                          <td className="py-1.5 pr-3"><Select aria-label={`Unit for ${m.name}`} className="!h-9 w-28" value={unit} onChange={(e) => setOverrides((o) => ({ ...o, [m.name]: { ...o[m.name], unit: e.target.value } }))}>{[...new Set([unit, ...units])].map((u) => <option key={u}>{u}</option>)}</Select></td>
                          <td className="py-1.5 pr-3"><Select aria-label={`Section for ${m.name}`} className="!h-9 w-36" value={overrides[m.name]?.section ?? m.section} onChange={(e) => setOverrides((o) => ({ ...o, [m.name]: { ...o[m.name], section: e.target.value as Section } }))}>{sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select></td>
                          <td className="max-w-64 truncate py-1.5 pr-3 text-text-muted">{m.dishes.join(", ")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Button className="mt-3" variant="primary" loading={busy === "adding"} disabled={!!busy} onClick={addMissing}><PackagePlus strokeWidth={1.75} />Add {result.missing.length} raw {result.missing.length === 1 ? "material" : "materials"} to inventory</Button>
            </section>
          )}

          {(result.held.length > 0 || result.blankDish > 0) && (
            <section className="rounded-xl border border-danger/30 bg-danger/5 p-4">
              <h3 className="flex items-center gap-2 font-heading text-base font-semibold"><AlertTriangle className="size-5 text-danger" strokeWidth={1.75} />{result.held.length} {result.held.length === 1 ? "dish" : "dishes"} in the file will not be saved yet</h3>
              <ul className="mt-2 max-h-60 space-y-1 overflow-auto text-sm">
                {result.held.map((h) => <li key={h.dish}><span className="font-medium">{h.dish}</span> <span className="text-text-muted">· {h.reason || "no usable rows"}</span></li>)}
                {result.blankDish > 0 && <li className="text-text-muted">{result.blankDish} {result.blankDish === 1 ? "row has" : "rows have"} no dish name and nothing above to take it from.</li>}
              </ul>
            </section>
          )}

          <div className="max-h-[28rem] overflow-auto rounded-xl border">
            <table className="tnum w-full min-w-[640px] text-left text-sm">
              <thead className="sticky top-0 bg-surface-muted text-xs text-text-muted"><tr><th className="px-3 py-2 font-medium">Row</th><th className="py-2 pr-3 font-medium">Dish</th><th className="py-2 pr-3 font-medium">Raw material</th><th className="py-2 pr-3 font-medium">Quantity</th><th className="py-2 pr-3 font-medium">Check</th></tr></thead>
              <tbody className="divide-y">
                {result.rows.slice(0, 300).map((r) => (
                  <tr key={r.row} className={cn(r.errors.length ? "bg-danger/5" : r.waiting ? "bg-warning/5" : "")}>
                    <td className="whitespace-nowrap px-3 py-1.5 text-text-muted">{r.row}</td>
                    <td className="max-w-48 truncate py-1.5 pr-3">{r.dish}</td>
                    <td className="max-w-48 truncate py-1.5 pr-3">{r.raw}</td>
                    <td className="py-1.5 pr-3">{r.qty} {r.unit}</td>
                    <td className="py-1.5 pr-3">{r.errors.length ? <span className="text-danger">{r.errors.join("; ")}</span> : r.waiting ? <span className="text-warning">Add this raw material first</span> : <span className="text-success">OK</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.rows.length > 300 && <p className="text-xs text-text-muted">Showing the first 300 of {result.rows.length} rows; all of them are checked.</p>}
          {(waiting > 0 || problems.length > 0) && <p className="text-xs text-text-muted">A dish with any row in error, or waiting for a raw material, is held back whole so no recipe is saved half done. The rest can be imported now.</p>}
        </div>
      )}
    </Card>
  );
}
