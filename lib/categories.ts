import type { MenuCategory } from "./types";

// Menu categories form a tree: Main course > Sabji > Paneer sabji. The list is kept in tree order (each
// category followed by everything under it), and sort_order follows that order. Screens group dishes by
// top-level category and treat a dish in a sub-category as belonging to every category above it.

/** The account's categories by id; kept in step with the store, so pricing can see the tree. */
let byId = new Map<string, MenuCategory>();
export function setCategoryTree(list: MenuCategory[]) {
  byId = new Map(list.map((c) => [c.id, c]));
}

/** The parent id, ignoring a parent that no longer exists. */
const parentOf = (id: string) => {
  const p = byId.get(id)?.parentId;
  return p && byId.has(p) ? p : undefined;
};

/** The category and every one above it, nearest first. */
export function lineage(id: string) {
  const out: string[] = [];
  for (let at: string | undefined = id; at && !out.includes(at); at = parentOf(at)) out.push(at);
  return out;
}

/** True when dishes in this category have no price of their own: it, or a category above it, is ticked as main course. */
export const pricedAtBooking = (categoryId: string) => lineage(categoryId).some((id) => byId.get(id)?.atBooking);

/** True when a dish's category is this one or sits anywhere under it. */
export const isWithin = (categoryId: string, ancestorId: string) => lineage(categoryId).includes(ancestorId);

/** The top-level category a category sits under (itself when it is top-level). */
export const rootOf = (id: string) => lineage(id).at(-1) ?? id;

/** Top-level categories, in order. */
export const roots = (list: MenuCategory[]) => list.filter((c) => !c.parentId || !list.some((p) => p.id === c.parentId));

/** Every category with its depth (0 for top-level), each followed by its sub-categories, keeping list order. */
export function treeOrder(list: MenuCategory[]) {
  const out: { c: MenuCategory; depth: number }[] = [];
  const walk = (parent: string | undefined, depth: number) => {
    for (const c of list.filter((x) => (parent ? x.parentId === parent : !x.parentId || !list.some((p) => p.id === x.parentId)))) {
      if (out.some((o) => o.c.id === c.id)) continue;
      out.push({ c, depth });
      walk(c.id, depth + 1);
    }
  };
  walk(undefined, 0);
  return out;
}

/** Names from below the top-level category down to this one: "Sabji › Paneer sabji". Empty for a top-level one. */
export function subPath(id: string) {
  return lineage(id).slice(0, -1).reverse().map((x) => byId.get(x)?.name ?? "").join(" › ");
}

/** "Main course › Sabji › Paneer sabji", for pickers. */
export const fullPath = (id: string) => lineage(id).reverse().map((x) => byId.get(x)?.name ?? "").join(" › ");

/** A category and everything under it. */
export const branch = (list: MenuCategory[], id: string) => list.filter((c) => isWithin(c.id, id));
