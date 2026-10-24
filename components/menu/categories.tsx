"use client";

import { ArrowDown, ArrowUp, PencilLine, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Card, Chip } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/sheet";
import { categoryIcon, categoryIconNames } from "@/lib/icons";
import { useFoodTypes } from "@/lib/services";
import { useCurrentUser, useStore } from "@/lib/store";
import type { MenuCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Add or edit one category: its name, icon and, for the owner, the food types that show it. */
function CategoryModal({ category, onClose }: { category: MenuCategory | "new"; onClose: () => void }) {
  const categories = useStore((s) => s.categories);
  const saveCategory = useStore((s) => s.saveCategory);
  const updateTenant = useStore((s) => s.updateTenant);
  const servicesReady = useStore((s) => s.servicesReady);
  const isOwner = useCurrentUser().role === "owner";
  const foodTypes = useFoodTypes();
  const editing = category !== "new" ? category : undefined;
  const [name, setName] = React.useState(editing?.name ?? "");
  const [icon, setIcon] = React.useState(editing?.icon ?? "Utensils");
  // A new category shows for every food type unless the owner unticks some.
  const [types, setTypes] = React.useState<string[]>(() => foodTypes.filter((t) => !editing || t.categoryIds.includes(editing.id)).map((t) => t.id));
  const canTypes = isOwner && servicesReady;
  const taken = categories.some((c) => c.id !== editing?.id && c.name.trim().toLowerCase() === name.trim().toLowerCase());
  const error = !name.trim() ? "Give it a name" : taken ? "There is already a category with this name" : "";

  const save = () => {
    if (error) return;
    const id = saveCategory({ id: editing?.id, name: name.trim(), icon });
    if (canTypes) {
      const next = foodTypes.map((t) => {
        const has = t.categoryIds.includes(id);
        const want = types.includes(t.id);
        return has === want ? t : { ...t, categoryIds: want ? [...t.categoryIds, id] : t.categoryIds.filter((x) => x !== id) };
      });
      if (next.some((t, i) => t !== foodTypes[i])) updateTenant({ foodTypes: next });
    }
    toast.success(editing ? "Category saved" : `${name.trim()} added`);
    onClose();
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={editing ? `Edit ${editing.name}` : "New category"}
      description="Categories group the dishes on the menu, in packages and on every menu card."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!!error} onClick={save}>{editing ? "Save" : "Add category"}</Button></>}
    >
      <div className="space-y-4">
        <Field label="Name" error={name && error ? error : ""}>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} placeholder="Farsan, Soups, Live counters" />
        </Field>
        <div>
          <span className="mb-1 block text-xs font-medium text-text-muted">Icon</span>
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-9">
            {categoryIconNames.map((n) => {
              const Icon = categoryIcon(n);
              return (
                <button key={n} type="button" aria-label={n} aria-pressed={icon === n} title={n} onClick={() => setIcon(n)} className={cn("grid aspect-square place-items-center rounded-lg border transition-colors duration-150", icon === n ? "border-primary bg-primary-soft text-primary" : "bg-surface text-text-muted hover:text-text")}>
                  <Icon className="size-5" strokeWidth={1.75} />
                </button>
              );
            })}
          </div>
        </div>
        {canTypes && (
          <div>
            <span className="mb-1 block text-xs font-medium text-text-muted">Show for these food types</span>
            <div className="flex flex-wrap gap-1.5">
              {foodTypes.map((t) => <Chip key={t.id} active={types.includes(t.id)} onClick={() => setTypes((cur) => (cur.includes(t.id) ? cur.filter((x) => x !== t.id) : [...cur, t.id]))}>{t.name}</Chip>)}
            </div>
            <p className="mt-1 text-xs text-text-muted">When a service&apos;s menu is picked, this category appears for the ticked food types.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Delete a category; any dishes in it move to the category picked here first. */
function DeleteModal({ category, onClose }: { category: MenuCategory; onClose: () => void }) {
  const categories = useStore((s) => s.categories);
  const items = useStore((s) => s.items);
  const packages = useStore((s) => s.packages);
  const deleteCategory = useStore((s) => s.deleteCategory);
  const dishes = items.filter((i) => i.categoryId === category.id).length;
  const inPackages = packages.filter((p) => !p.archived && p.rules.some((r) => r.categoryId === category.id));
  const others = categories.filter((c) => c.id !== category.id);
  const [moveTo, setMoveTo] = React.useState(others[0]?.id ?? "");
  const [busy, setBusy] = React.useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      await deleteCategory(category.id, dishes ? moveTo : undefined);
      toast.success(`${category.name} deleted`, { description: dishes ? `${dishes} ${dishes === 1 ? "dish" : "dishes"} moved to ${others.find((c) => c.id === moveTo)?.name}.` : undefined });
      onClose();
    } catch (e) {
      toast.error("The category was not deleted", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Delete ${category.name}?`}
      description="This cannot be undone."
      footer={<><Button variant="ghost" onClick={onClose}>Keep it</Button><Button variant="danger" loading={busy} disabled={dishes > 0 && !moveTo} onClick={remove}>Delete category</Button></>}
    >
      <div className="space-y-3 text-sm">
        {dishes > 0 ? (
          others.length ? (
            <Field label={`Move its ${dishes} ${dishes === 1 ? "dish" : "dishes"} to`}>
              <Select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>{others.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
            </Field>
          ) : (
            <p className="text-warning">This is the only category. Add another one first so its dishes have somewhere to go.</p>
          )
        ) : (
          <p className="text-text-muted">It has no dishes.</p>
        )}
        {inPackages.length > 0 && <p className="rounded-lg bg-warning/10 p-3 text-xs text-warning">{inPackages.map((p) => p.name).join(", ")} {inPackages.length === 1 ? "lets" : "let"} the client choose from this category. That choice will be removed from {inPackages.length === 1 ? "the package" : "those packages"}.</p>}
      </div>
    </Modal>
  );
}

/** The menu's categories: their order everywhere, names, icons, and adding or deleting them. */
export function CategoriesEditor({ canEdit }: { canEdit: boolean }) {
  const categories = useStore((s) => s.categories);
  const items = useStore((s) => s.items);
  const reorderCategories = useStore((s) => s.reorderCategories);
  const foodTypes = useFoodTypes();
  const [editing, setEditing] = React.useState<MenuCategory | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<MenuCategory | null>(null);

  const move = (index: number, by: number) => {
    const ids = categories.map((c) => c.id);
    const [id] = ids.splice(index, 1);
    ids.splice(index + by, 0, id);
    reorderCategories(ids);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-text-muted">The order here is the order on the menu screen, in packages and on every menu card and quotation.</p>
        {canEdit && <Button variant="primary" onClick={() => setEditing("new")}><Plus strokeWidth={2} />Add category</Button>}
      </div>
      <Card className="divide-y overflow-hidden">
        {categories.map((c, i) => {
          const Icon = categoryIcon(c.icon);
          const count = items.filter((x) => x.categoryId === c.id).length;
          const types = foodTypes.filter((t) => t.categoryIds.includes(c.id)).map((t) => t.name);
          return (
            <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 md:px-4">
              {canEdit && (
                <span className="flex shrink-0 flex-col">
                  <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${c.name} up`} className="grid size-6 place-items-center rounded text-text-muted hover:bg-surface-muted hover:text-text disabled:opacity-30"><ArrowUp className="size-4" strokeWidth={1.75} /></button>
                  <button type="button" disabled={i === categories.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${c.name} down`} className="grid size-6 place-items-center rounded text-text-muted hover:bg-surface-muted hover:text-text disabled:opacity-30"><ArrowDown className="size-4" strokeWidth={1.75} /></button>
                </span>
              )}
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><Icon className="size-5" strokeWidth={1.75} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{c.name}</span>
                <span className="tnum block truncate text-xs text-text-muted">{count} {count === 1 ? "dish" : "dishes"}{types.length ? ` · ${types.length === foodTypes.length ? "every food type" : types.join(", ")}` : " · no food type"}</span>
              </span>
              {canEdit && (
                <span className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}><PencilLine strokeWidth={1.75} /></Button>
                  <Button variant="ghost" size="icon" aria-label={`Delete ${c.name}`} onClick={() => setDeleting(c)}><Trash2 strokeWidth={1.75} /></Button>
                </span>
              )}
            </div>
          );
        })}
        {categories.length === 0 && <p className="p-8 text-center text-sm text-text-muted">No categories yet. Add the first one, such as Welcome drinks or Starters.</p>}
      </Card>
      {editing && <CategoryModal category={editing} onClose={() => setEditing(null)} />}
      {deleting && <DeleteModal category={deleting} onClose={() => setDeleting(null)} />}
    </div>
  );
}
