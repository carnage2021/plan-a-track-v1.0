"use client";

import { BookOpen, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/badges";
import { MoneyInput } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/input";
import { marginTone } from "@/lib/pricing";
import { nameKey, summarise } from "@/lib/recipe-book";
import { useSupply } from "@/lib/supply-store";
import type { MenuItem } from "@/lib/types";
import { money } from "@/lib/utils";
import { Num } from "./common";

/** A dish's recipe: one picked from the Recipes page, or written here. */
export function RecipeEditor({ item }: { item: MenuItem }) {
  const saved = useSupply((s) => s.recipes);
  // Starts again from what is saved whenever the dish's recipe changes from outside (a recipe picked below).
  const version = saved.filter((r) => r.itemId === item.id).map((r) => `${r.ingredientId}:${r.qty}`).join("|");
  return (
    <div className="space-y-2">
      <BookPicker item={item} />
      <RecipeLines key={version} item={item} />
    </div>
  );
}

/** Gives the dish a recipe kept on the Recipes page, for example one uploaded before the dish was on the menu. */
function BookPicker({ item }: { item: MenuItem }) {
  const { book, bookReady, ingredients, linkBook } = useSupply();
  if (!bookReady) return null;
  const linked = book.find((r) => r.itemId === item.id);
  if (linked) {
    const sum = summarise(linked, ingredients);
    return (
      <p className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-muted p-3 text-sm">
        <BookOpen className="size-4 text-text-muted" strokeWidth={1.75} />
        <span>Recipe from the Recipes page: <span className="font-medium" data-no-title-case>{linked.name}</span></span>
        {!sum.complete && <Badge tone="warning">{sum.missing + sum.unit} raw {sum.missing + sum.unit === 1 ? "material" : "materials"} to include first</Badge>}
        <Link href={`/recipes?open=${linked.id}`} className="ml-auto text-primary hover:underline">Open in Recipes</Link>
      </p>
    );
  }
  const free = book.filter((r) => !r.itemId);
  if (!free.length) return null;
  // The recipes named like the dish come first.
  const k = nameKey(item.name);
  const like = (n: string) => { const x = nameKey(n); return x === k ? 0 : x.includes(k) || k.includes(x) ? 1 : 2; };
  const options = [...free].sort((a, b) => like(a.name) - like(b.name) || a.name.localeCompare(b.name));
  return (
    <Field label="Use a recipe from the Recipes page" hint="Recipes uploaded for dishes not on the menu yet. Choosing one replaces the recipe below.">
      <Select value="" onChange={(e) => {
        const r = free.find((x) => x.id === e.target.value);
        if (!r) return;
        const res = linkBook(r.id, item.id);
        if (res === "applied") toast.success(`${r.name} is now the recipe of ${item.name}`, { description: "Raw material lists and food cost follow it." });
        else toast.success(`${r.name} is linked to ${item.name}`, { description: "Some of its raw materials are not included yet. Include them on the Recipes page and the dish takes the recipe." });
      }}>
        <option value="">Choose a recipe</option>
        {options.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </Select>
    </Field>
  );
}

/** Recipe for one dish: ingredients for a base guest count, with the wastage buffer. Sets the dish's food cost. */
function RecipeLines({ item }: { item: MenuItem }) {
  const ingredients = useSupply((s) => s.ingredients);
  const saved = useSupply((s) => s.recipes);
  const saveRecipe = useSupply((s) => s.saveRecipe);
  const [lines, setLines] = React.useState(() => saved.filter((r) => r.itemId === item.id).map((r) => ({ ingredientId: r.ingredientId, qty: r.qty })));
  const [base, setBase] = React.useState(item.recipeBase);
  const [buffer, setBuffer] = React.useState(item.bufferPct);
  const [dirty, setDirty] = React.useState(false);
  const touch = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setDirty(true); };
  const unit = (id: string) => ingredients.find((i) => i.id === id)?.unit ?? "";
  const cost = lines.reduce((s, l) => s + l.qty * (ingredients.find((i) => i.id === l.ingredientId)?.lastRate ?? 0), 0) / (base || 100);
  const margin = item.price ? ((item.price - cost) / item.price) * 100 : 0;
  const unused = ingredients.filter((i) => !lines.some((l) => l.ingredientId === i.id));

  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-heading text-base font-semibold">Recipe</h3>
        {lines.length > 0 && <span className="tnum flex items-center gap-2 text-xs text-text-muted">{money(Math.round(cost * 100) / 100)} per {item.pricingType === "plate" ? "plate" : "counter"}<Badge tone={marginTone(margin)}>{Math.round(margin)}%</Badge></span>}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Field label="Written for (guests)"><Num className="text-left" value={base} onChange={touch((v: number) => setBase(Math.max(1, Math.round(v))))} /></Field>
        <Field label="Wastage buffer %"><Num className="text-left" value={buffer} onChange={touch(setBuffer)} /></Field>
      </div>
      <ul className="mt-2 space-y-1">
        {lines.map((l, i) => (
          <li key={l.ingredientId} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm">{ingredients.find((x) => x.id === l.ingredientId)?.name}</span>
            <Num aria-label="Quantity" className="w-20" value={l.qty} onChange={touch((v: number) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: v } : x))))} />
            <span className="w-8 text-xs text-text-muted">{unit(l.ingredientId)}</span>
            <Button variant="ghost" size="icon" aria-label="Remove ingredient" onClick={() => { setLines(lines.filter((_, j) => j !== i)); setDirty(true); }}><Trash2 strokeWidth={1.75} /></Button>
          </li>
        ))}
      </ul>
      {lines.length === 0 && <p className="mt-2 text-xs text-text-muted">No recipe yet, so this dish is left out of raw material lists and its cost is the number typed above.</p>}
      <div className="mt-2 flex gap-2">
        <Select aria-label="Add an ingredient" value="" onChange={(e) => { if (e.target.value) { setLines([...lines, { ingredientId: e.target.value, qty: 1 }]); setDirty(true); } }}>
          <option value="">Add an ingredient</option>
          {unused.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
        </Select>
        <Button disabled={!dirty} onClick={() => { saveRecipe(item.id, lines, base, buffer); setDirty(false); toast.success("Recipe saved", { description: lines.length ? `Food cost is now ${money(Math.round(cost * 100) / 100)}` : undefined }); }}><Plus strokeWidth={1.75} />Save recipe</Button>
      </div>
    </div>
  );
}

/** Which third-party agency makes an outsourced dish, and what they charge. */
export function AgencyFields({ agencyId, agencyRate, onChange }: { agencyId?: string; agencyRate: number; onChange: (patch: { agencyId?: string; agencyRate?: number }) => void }) {
  const vendors = useSupply((s) => s.vendors);
  const agencies = vendors.filter((v) => v.type === "food_agency");
  return (
    <div className="grid grid-cols-2 gap-3 rounded-xl border p-3">
      <Field label="Made by" hint={agencies.length ? undefined : "Add a third-party food vendor on the Vendors page first."}>
        <Select value={agencyId ?? ""} onChange={(e) => onChange({ agencyId: e.target.value || undefined })}>
          <option value="">Choose an agency</option>
          {agencies.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </Select>
      </Field>
      <Field label="Agency rate"><MoneyInput value={agencyRate} onChange={(v) => onChange({ agencyRate: v })} /></Field>
    </div>
  );
}
