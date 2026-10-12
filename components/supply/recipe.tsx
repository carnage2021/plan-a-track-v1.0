"use client";

import { Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/badges";
import { MoneyInput } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/input";
import { marginTone } from "@/lib/pricing";
import { useSupply } from "@/lib/supply-store";
import type { MenuItem } from "@/lib/types";
import { money } from "@/lib/utils";
import { Num } from "./common";

/** Recipe for one dish: ingredients for a base guest count, with the wastage buffer. Sets the dish's food cost. */
export function RecipeEditor({ item }: { item: MenuItem }) {
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
