"use client";

import { ArrowDown, ArrowDownAZ, ArrowUp, CornerDownRight, GripVertical, PencilLine, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Card, Chip } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/sheet";
import { branch, fullPath, isWithin, treeOrder } from "@/lib/categories";
import { categoryIcon, categoryIconNames } from "@/lib/icons";
import { useFoodTypes } from "@/lib/services";
import { useCurrentUser, useStore } from "@/lib/store";
import type { MenuCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

type Editing = { category?: MenuCategory; parentId?: string };

/** Add or edit one category: name, where it sits, icon and, for a top-level one, the food types that show it. */
function CategoryModal({ editing, onClose }: { editing: Editing; onClose: () => void }) {
  const categories = useStore((s) => s.categories);
  const saveCategory = useStore((s) => s.saveCategory);
  const updateTenant = useStore((s) => s.updateTenant);
  const servicesReady = useStore((s) => s.servicesReady);
  const subReady = useStore((s) => s.subcategoriesReady);
  const isOwner = useCurrentUser().role === "owner";
  const foodTypes = useFoodTypes();
  const current = editing.category;
  const [name, setName] = React.useState(current?.name ?? "");
  const [icon, setIcon] = React.useState(current?.icon ?? categories.find((c) => c.id === editing.parentId)?.icon ?? "Utensils");
  const [parentId, setParentId] = React.useState(current ? (current.parentId ?? "") : (editing.parentId ?? ""));
  // A new top-level category shows for every food type unless the owner unticks some.
  const [types, setTypes] = React.useState<string[]>(() => foodTypes.filter((t) => !current || t.categoryIds.includes(current.id)).map((t) => t.id));
  const canTypes = isOwner && servicesReady && !parentId;
  // A category cannot sit inside itself or anything under it.
  const parents = treeOrder(categories).filter(({ c }) => !current || !isWithin(c.id, current.id));
  const siblings = categories.filter((c) => c.id !== current?.id && (c.parentId ?? "") === parentId);
  const taken = siblings.some((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase());
  const error = !name.trim() ? "Give it a name" : taken ? "There is already a category with this name here" : "";

  const save = () => {
    if (error) return;
    const id = saveCategory({ id: current?.id, name: name.trim(), icon, parentId: parentId || undefined });
    if (canTypes) {
      const next = foodTypes.map((t) => {
        const has = t.categoryIds.includes(id);
        const want = types.includes(t.id);
        return has === want ? t : { ...t, categoryIds: want ? [...t.categoryIds, id] : t.categoryIds.filter((x) => x !== id) };
      });
      if (next.some((t, i) => t !== foodTypes[i])) updateTenant({ foodTypes: next });
    }
    toast.success(current ? "Category saved" : `${name.trim()} added`, { description: parentId ? `Inside ${fullPath(parentId)}` : undefined });
    onClose();
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={current ? `Edit ${current.name}` : parentId ? `New sub-category in ${categories.find((c) => c.id === parentId)?.name}` : "New category"}
      description="Categories group the dishes on the menu, in packages and on every menu card."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!!error} onClick={save}>{current ? "Save" : "Add"}</Button></>}
    >
      <div className="space-y-4">
        <Field label="Name" error={name && error ? error : ""}>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} placeholder={parentId ? "Paneer sabji, Gujarati sabji" : "Farsan, Soups, Live counters"} />
        </Field>
        {subReady && (
          <Field label="Sits inside" hint="Leave as a main category, or put it inside another, e.g. Main course › Sabji.">
            <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">Main category (top level)</option>
              {parents.map(({ c, depth }) => <option key={c.id} value={c.id}>{"   ".repeat(depth)}{depth ? "› " : ""}{c.name}</option>)}
            </Select>
          </Field>
        )}
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
            <p className="mt-1 text-xs text-text-muted">When a service&apos;s menu is picked, this category and everything inside it appears for the ticked food types.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

/**
 * Delete a category, and with it its dishes or not. Dishes on past quotations or orders cannot be removed
 * (those records must stay whole), so they are switched off and kept elsewhere; the dialog says which.
 */
function DeleteModal({ category, onClose }: { category: MenuCategory; onClose: () => void }) {
  const categories = useStore((s) => s.categories);
  const items = useStore((s) => s.items);
  const packages = useStore((s) => s.packages);
  const quotations = useStore((s) => s.quotations);
  const orders = useStore((s) => s.orders);
  const deleteCategory = useStore((s) => s.deleteCategory);
  const dishes = items.filter((i) => i.categoryId === category.id);
  const children = categories.filter((c) => c.parentId === category.id);
  const parent = categories.find((c) => c.id === category.parentId);
  const inPackages = packages.filter((p) => !p.archived && p.rules.some((r) => r.categoryId === category.id));
  const others = treeOrder(categories).filter(({ c }) => !isWithin(c.id, category.id) || children.some((k) => isWithin(c.id, k.id)));
  // Dishes this account's quotations or orders list; the database has the final say when deleting.
  const usedIds = new Set([...quotations, ...orders].flatMap((x) => x.functions.flatMap((f) => f.itemIds)));
  const used = dishes.filter((d) => usedIds.has(d.id));
  const [mode, setMode] = React.useState<"delete" | "move">("delete");
  const [moveTo, setMoveTo] = React.useState(parent?.id ?? "");
  const [busy, setBusy] = React.useState(false);
  const needsTarget = dishes.length > 0 && (mode === "move" || used.length > 0);
  const where = (id: string) => fullPath(id);

  const remove = async () => {
    setBusy(true);
    try {
      const r = await deleteCategory(category.id, mode, moveTo || undefined);
      const lines = [
        r.deleted ? `${r.deleted} ${r.deleted === 1 ? "dish" : "dishes"} deleted.` : "",
        r.moved ? `${r.moved} ${r.moved === 1 ? "dish" : "dishes"} moved to ${where(moveTo)}.` : "",
        r.kept.length ? `Kept, switched off, in ${where(r.keptIn ?? moveTo)} because past orders list ${r.kept.length === 1 ? "it" : "them"}: ${r.kept.join(", ")}.` : "",
      ].filter(Boolean);
      toast.success(`${category.name} deleted`, { description: lines.join(" ") || undefined });
      onClose();
    } catch (e) {
      toast.error("The category was not deleted", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const option = (value: "delete" | "move", title: string, help: string) => (
    <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors duration-150", mode === value ? "border-primary bg-primary-soft" : "bg-surface hover:border-text-muted/40")}>
      <input type="radio" name="dishes" className="mt-1 accent-[var(--color-primary)]" checked={mode === value} onChange={() => setMode(value)} />
      <span><span className="block font-medium">{title}</span><span className="block text-xs text-text-muted">{help}</span></span>
    </label>
  );

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Delete ${category.name}?`}
      description="This cannot be undone."
      footer={<><Button variant="ghost" onClick={onClose}>Keep it</Button><Button variant="danger" loading={busy} disabled={needsTarget && !moveTo} onClick={remove}>{mode === "delete" && dishes.length ? `Delete category and ${dishes.length - used.length === dishes.length ? "" : "unused "}dishes` : "Delete category"}</Button></>}
    >
      <div className="space-y-3 text-sm">
        {dishes.length > 0 ? (
          <>
            <p className="font-medium">It has {dishes.length} {dishes.length === 1 ? "dish" : "dishes"}: <span className="font-normal text-text-muted">{dishes.slice(0, 6).map((d) => d.name).join(", ")}{dishes.length > 6 ? ` and ${dishes.length - 6} more` : ""}</span></p>
            <div className="grid gap-2">
              {option("delete", "Delete the dishes too", "They are removed from the menu, with their recipes.")}
              {option("move", "Move the dishes to another category", "Keep the dishes and put them somewhere else.")}
            </div>
            {mode === "delete" && used.length > 0 && <p className="rounded-lg bg-warning/10 p-3 text-xs text-warning">{used.map((d) => d.name).join(", ")} {used.length === 1 ? "is" : "are"} on past quotations or orders, so {used.length === 1 ? "it" : "they"} cannot be deleted. {used.length === 1 ? "It is" : "They are"} switched off (hidden from new menus) and kept in the category below.</p>}
            {needsTarget && (
              <Field label={mode === "move" ? "Move them to" : "Keep the used dishes in"}>
                <Select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                  <option value="">Choose a category</option>
                  {others.map(({ c, depth }) => <option key={c.id} value={c.id}>{"\u00a0\u00a0\u00a0".repeat(depth)}{depth ? "› " : ""}{c.name}</option>)}
                </Select>
              </Field>
            )}
          </>
        ) : (
          <p className="text-text-muted">It has no dishes of its own.</p>
        )}
        {children.length > 0 && <p className="text-text-muted">Its {children.length} sub-{children.length === 1 ? "category" : "categories"} ({children.map((c) => c.name).join(", ")}) will move up into {parent ? parent.name : "the main categories"}, with their dishes.</p>}
        {inPackages.length > 0 && <p className="rounded-lg bg-warning/10 p-3 text-xs text-warning">{inPackages.map((p) => p.name).join(", ")} {inPackages.length === 1 ? "lets" : "let"} the client choose from this category. That choice will be removed from {inPackages.length === 1 ? "the package" : "those packages"}.</p>}
      </div>
    </Modal>
  );
}

/** The menu's categories as a tree: their order everywhere, names, icons, sub-categories, adding and deleting. */
export function CategoriesEditor({ canEdit }: { canEdit: boolean }) {
  const categories = useStore((s) => s.categories);
  const items = useStore((s) => s.items);
  const subReady = useStore((s) => s.subcategoriesReady);
  const reorderCategories = useStore((s) => s.reorderCategories);
  const foodTypes = useFoodTypes();
  const [editing, setEditing] = React.useState<Editing | null>(null);
  const [deleting, setDeleting] = React.useState<MenuCategory | null>(null);
  const tree = treeOrder(categories);

  /** Swaps a category with its neighbour at the same level; everything inside each moves with it. */
  const move = (c: MenuCategory, by: -1 | 1) => {
    const level = tree.filter((x) => (x.c.parentId ?? "") === (c.parentId ?? "")).map((x) => x.c.id);
    const other = level[level.indexOf(c.id) + by];
    if (!other) return;
    const ids = categories.map((x) => x.id);
    const a = ids.indexOf(c.id), b = ids.indexOf(other);
    [ids[a], ids[b]] = [ids[b], ids[a]];
    reorderCategories(treeOrder(ids.map((id) => categories.find((x) => x.id === id)!)).map((x) => x.c.id));
  };

  /** Dragging: a category drops onto another at the same level and takes its place; everything inside moves with it. */
  const [drag, setDrag] = React.useState<MenuCategory | null>(null);
  const [over, setOver] = React.useState("");
  const sameLevel = (a: MenuCategory, b: MenuCategory) => (a.parentId ?? "") === (b.parentId ?? "");
  const place = (c: MenuCategory, target: MenuCategory) => {
    if (c.id === target.id || !sameLevel(c, target)) return;
    const ids = categories.map((x) => x.id).filter((id) => id !== c.id);
    const down = tree.findIndex((x) => x.c.id === c.id) < tree.findIndex((x) => x.c.id === target.id);
    ids.splice(ids.indexOf(target.id) + (down ? 1 : 0), 0, c.id);
    reorderCategories(treeOrder(ids.map((id) => categories.find((x) => x.id === id)!)).map((x) => x.c.id));
  };
  /** Every level in alphabetical order, sub-categories too. */
  const sortAZ = () => reorderCategories(treeOrder([...categories].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))).map((x) => x.c.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-text-muted">Drag a row, or use the arrows, to change the order. The order here is the order on the menu screen, in packages and on every menu card and quotation. {subReady ? "Put sub-categories inside a category, like Main course › Sabji › Paneer sabji." : "Run the 0015 database update to add sub-categories."}</p>
        {canEdit && <div className="flex flex-wrap gap-2"><Button onClick={sortAZ}><ArrowDownAZ strokeWidth={1.75} />Sort A to Z</Button><Button variant="primary" onClick={() => setEditing({})}><Plus strokeWidth={2} />Add category</Button></div>}
      </div>
      <Card className="divide-y overflow-hidden">
        {tree.map(({ c, depth }) => {
          const Icon = categoryIcon(c.icon);
          const own = items.filter((x) => x.categoryId === c.id).length;
          const all = items.filter((x) => isWithin(x.categoryId, c.id)).length;
          const subs = branch(categories, c.id).length - 1;
          const types = depth === 0 ? foodTypes.filter((t) => t.categoryIds.includes(c.id)).map((t) => t.name) : [];
          const level = tree.filter((x) => (x.c.parentId ?? "") === (c.parentId ?? ""));
          const at = level.findIndex((x) => x.c.id === c.id);
          return (
            <div
              key={c.id}
              draggable={canEdit}
              onDragStart={(e) => { setDrag(c); e.dataTransfer.effectAllowed = "move"; }}
              onDragOver={(e) => { if (drag && drag.id !== c.id && sameLevel(drag, c)) { e.preventDefault(); setOver(c.id); } }}
              onDragLeave={() => setOver((o) => (o === c.id ? "" : o))}
              onDrop={(e) => { e.preventDefault(); if (drag) place(drag, c); setDrag(null); setOver(""); }}
              onDragEnd={() => { setDrag(null); setOver(""); }}
              className={cn("flex items-center gap-3 py-2.5 pr-3 md:pr-4", depth > 0 && "bg-surface-muted/40", canEdit && "cursor-grab active:cursor-grabbing", drag?.id === c.id && "opacity-50", over === c.id && "bg-primary-soft ring-2 ring-inset ring-primary")}
              style={{ paddingLeft: 12 + depth * 28 }}
            >
              {canEdit && (
                <span className="flex shrink-0 items-center">
                <GripVertical className="size-4 text-text-muted" strokeWidth={1.75} aria-hidden />
                <span className="flex shrink-0 flex-col">
                  <button type="button" disabled={at === 0} onClick={() => move(c, -1)} aria-label={`Move ${c.name} up`} className="grid size-6 place-items-center rounded text-text-muted hover:bg-surface-muted hover:text-text disabled:opacity-30"><ArrowUp className="size-4" strokeWidth={1.75} /></button>
                  <button type="button" disabled={at === level.length - 1} onClick={() => move(c, 1)} aria-label={`Move ${c.name} down`} className="grid size-6 place-items-center rounded text-text-muted hover:bg-surface-muted hover:text-text disabled:opacity-30"><ArrowDown className="size-4" strokeWidth={1.75} /></button>
                </span>
                </span>
              )}
              {depth > 0 && <CornerDownRight className="size-4 shrink-0 text-text-muted" strokeWidth={1.75} />}
              <span className={cn("grid shrink-0 place-items-center rounded-xl bg-primary-soft text-primary", depth ? "size-8" : "size-10")}><Icon className={depth ? "size-4" : "size-5"} strokeWidth={1.75} /></span>
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate", depth ? "text-sm font-medium" : "font-medium")}>{c.name}</span>
                <span className="tnum block truncate text-xs text-text-muted">
                  {subs > 0 ? `${all} ${all === 1 ? "dish" : "dishes"} (${own} here) · ${subs} sub-${subs === 1 ? "category" : "categories"}` : `${own} ${own === 1 ? "dish" : "dishes"}`}
                  {depth === 0 && (types.length ? ` · ${types.length === foodTypes.length ? "every food type" : types.join(", ")}` : " · no food type")}
                </span>
              </span>
              {canEdit && (
                <span className="flex shrink-0 items-center gap-1">
                  {subReady && <Button variant="ghost" className="max-sm:hidden" onClick={() => setEditing({ parentId: c.id })}><Plus strokeWidth={1.75} />Sub-category</Button>}
                  {subReady && <Button variant="ghost" size="icon" className="sm:hidden" aria-label={`Add a sub-category to ${c.name}`} onClick={() => setEditing({ parentId: c.id })}><Plus strokeWidth={1.75} /></Button>}
                  <Button variant="ghost" size="icon" aria-label={`Edit ${c.name}`} onClick={() => setEditing({ category: c })}><PencilLine strokeWidth={1.75} /></Button>
                  <Button variant="ghost" size="icon" aria-label={`Delete ${c.name}`} onClick={() => setDeleting(c)}><Trash2 strokeWidth={1.75} /></Button>
                </span>
              )}
            </div>
          );
        })}
        {categories.length === 0 && <p className="p-8 text-center text-sm text-text-muted">No categories yet. Add the first one, such as Welcome drinks or Starters.</p>}
      </Card>
      {editing && <CategoryModal editing={editing} onClose={() => setEditing(null)} />}
      {deleting && <DeleteModal category={deleting} onClose={() => setDeleting(null)} />}
    </div>
  );
}
