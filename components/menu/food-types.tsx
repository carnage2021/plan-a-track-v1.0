"use client";

import { Plus, RotateCcw, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/primitives";
import { categoryIcon } from "@/lib/icons";
import { defaultFoodTypes, useFoodTypes } from "@/lib/services";
import { useCurrentUser, useStore } from "@/lib/store";
import type { FoodType } from "@/lib/types";
import { cn, uid } from "@/lib/utils";

/** The owner's food types and the categories each one offers when a service's menu is picked. */
export function FoodTypesEditor() {
  const foodTypes = useFoodTypes();
  const categories = useStore((s) => s.categories);
  const packages = useStore((s) => s.packages);
  const ready = useStore((s) => s.servicesReady);
  const updateTenant = useStore((s) => s.updateTenant);
  const isOwner = useCurrentUser().role === "owner";
  const canEdit = isOwner && ready;

  const save = (next: FoodType[]) => updateTenant({ foodTypes: next });
  const patch = (id: string, change: Partial<FoodType>) => save(foodTypes.map((t) => (t.id === id ? { ...t, ...change } : t)));
  const toggle = (t: FoodType, categoryId: string) => patch(t.id, { categoryIds: t.categoryIds.includes(categoryId) ? t.categoryIds.filter((x) => x !== categoryId) : [...t.categoryIds, categoryId] });
  const remove = (t: FoodType) => {
    const before = foodTypes;
    save(foodTypes.filter((x) => x.id !== t.id));
    toast(`${t.name} removed`, { action: { label: "Undo", onClick: () => save(before) } });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <p className="text-sm text-text-muted">Each catering service in an enquiry, quotation or booking has a food type. When its menu is picked, only the categories ticked here are shown, along with the packages made for that food type.</p>
          {!ready && <p className="mt-2 rounded-lg bg-warning/10 p-3 text-sm text-warning">Run the 0012 database update to save food types. Until then the starting list below is used.</p>}
          {ready && !isOwner && <p className="mt-2 text-sm text-text-muted">Only the owner can change food types.</p>}
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => { const before = foodTypes; save(defaultFoodTypes(categories)); toast("Food types reset to the starting list", { action: { label: "Undo", onClick: () => save(before) } }); }}><RotateCcw strokeWidth={1.75} />Reset</Button>
            <Button variant="primary" onClick={() => save([...foodTypes, { id: uid(), name: "", categoryIds: [] }])}><Plus strokeWidth={2} />Add food type</Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {foodTypes.map((t) => {
          const pkgCount = packages.filter((p) => p.foodTypeId === t.id).length;
          return (
            <Card key={t.id} className="p-4">
              <div className="flex items-center gap-2">
                {canEdit ? (
                  <Input aria-label="Food type name" value={t.name} onChange={(e) => patch(t.id, { name: e.target.value })} placeholder="Gala Dinner" className="font-heading text-base font-semibold" />
                ) : (
                  <h3 className="flex-1 font-heading text-lg font-semibold">{t.name}</h3>
                )}
                {canEdit && <Button variant="ghost" size="icon" aria-label={`Remove ${t.name || "food type"}`} onClick={() => remove(t)}><Trash2 strokeWidth={1.75} /></Button>}
              </div>
              <p className="tnum mt-2 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                {t.categoryIds.length} of {categories.length} categories
                {pkgCount > 0 && <Badge>{pkgCount} {pkgCount === 1 ? "package" : "packages"}</Badge>}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {categories.map((c) => {
                  const on = t.categoryIds.includes(c.id);
                  const Icon = categoryIcon(c.icon);
                  return (
                    <button key={c.id} type="button" disabled={!canEdit} aria-pressed={on} onClick={() => toggle(t, c.id)} className={cn("inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors duration-150 disabled:cursor-default", on ? "border-primary bg-primary-soft font-medium text-primary" : "bg-surface text-text-muted", canEdit && !on && "hover:border-primary/50 hover:text-text")}>
                      <Icon className="size-4" strokeWidth={1.75} />{c.name}
                    </button>
                  );
                })}
              </div>
              {t.categoryIds.length === 0 && <p className="mt-2 text-xs text-warning">Tick at least one category, or this food type shows an empty menu.</p>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
