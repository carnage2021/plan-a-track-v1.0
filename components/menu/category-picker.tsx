"use client";

import { Check, Plus, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { lineage, roots } from "@/lib/categories";
import { useStore } from "@/lib/store";

/**
 * Where a dish sits, one level at a time: Category, then Sub-category, then the next level down, each list
 * showing only what is inside the one above. A dish can stop at any level. A new sub-category can be made
 * here, inside whatever is picked, without leaving the dish.
 */
export function CategoryPicker({ value, onChange, canAdd }: { value: string; onChange: (categoryId: string) => void; canAdd?: boolean }) {
  const categories = useStore((s) => s.categories);
  const ready = useStore((s) => s.subcategoriesReady);
  const saveCategory = useStore((s) => s.saveCategory);
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState("");

  // Top-level first: the picked category and everything above it.
  const path = value ? lineage(value).reverse() : [];
  const childrenOf = (id: string) => categories.filter((c) => c.parentId === id);
  const levels: { options: typeof categories; picked: string; parent?: string }[] = [{ options: roots(categories), picked: path[0] ?? "" }];
  for (let k = 1; k <= path.length; k++) {
    const parent = path[k - 1];
    const options = childrenOf(parent);
    if (!options.length) break;
    levels.push({ options, picked: path[k] ?? "", parent });
  }
  const label = (k: number) => (k === 0 ? "Category" : k === 1 ? "Sub-category" : `Sub-category, level ${k + 1}`);
  const here = categories.find((c) => c.id === value);

  const add = () => {
    const n = name.trim();
    if (!n || !here) return;
    if (childrenOf(here.id).some((c) => c.name.toLowerCase() === n.toLowerCase())) return toast.error(`${here.name} already has ${n}`);
    const id = saveCategory({ name: n, icon: here.icon, parentId: here.id });
    onChange(id);
    toast.success(`${n} added inside ${here.name}`);
    setName("");
    setAdding(false);
  };

  return (
    <div className="col-span-2 space-y-2">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {levels.map((lv, k) => (
          <Field key={k} label={label(k)}>
            <Select value={lv.picked} onChange={(e) => onChange(e.target.value || lv.parent!)}>
              {k === 0 ? !lv.picked && <option value="">Choose a category</option> : <option value="">None, directly in {categories.find((c) => c.id === lv.parent)?.name}</option>}
              {lv.options.map((c) => <option key={c.id} value={c.id}>{c.name}{childrenOf(c.id).length ? " ›" : ""}</option>)}
            </Select>
          </Field>
        ))}
      </div>
      {ready && canAdd && here && (
        adding ? (
          <div className="flex items-center gap-2">
            <Input autoFocus aria-label={`New sub-category in ${here.name}`} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } if (e.key === "Escape") setAdding(false); }} placeholder={`New sub-category in ${here.name}`} className="flex-1" />
            <Button size="icon" variant="primary" aria-label="Add sub-category" disabled={!name.trim()} onClick={add}><Check strokeWidth={2} /></Button>
            <Button size="icon" variant="ghost" aria-label="Cancel" onClick={() => { setAdding(false); setName(""); }}><X strokeWidth={1.75} /></Button>
          </div>
        ) : (
          <Button variant="ghost" className="-ml-2" onClick={() => setAdding(true)}><Plus strokeWidth={1.75} />New sub-category in {here.name}</Button>
        )
      )}
    </div>
  );
}
