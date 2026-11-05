import { baseUnit, convert, normUnit } from "./recipe-import";
import type { Ingredient, RecipeLine } from "./supply-types";
import type { MenuItem } from "./types";

// The Recipes page keeps every uploaded recipe (recipe_book, 0026), whether or not its dish is on the menu and
// whether or not its raw materials are in the inventory. Lines keep the sheet's own name, quantity and unit, and
// are matched to the inventory when shown, so a raw material added later is picked up at once.

export interface BookLine {
  name: string;
  qty: number;
  unit: string;
  /** Set when the raw material was included under another name */
  ingredientId?: string;
}

export interface BookRecipe {
  id: string;
  name: string;
  /** The menu dish this is the recipe of */
  itemId?: string;
  recipeBase: number;
  bufferPct: number;
  lines: BookLine[];
  updatedAt: string;
}

export const nameKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export type LineState =
  | { line: BookLine; state: "ok"; ingredient: Ingredient; qty: number; amount: number }
  | { line: BookLine; state: "missing" }
  | { line: BookLine; state: "unit"; ingredient: Ingredient };

/** Each line against the inventory: matched and priced, not included, or in a unit that does not convert. */
export function resolveLines(lines: BookLine[], ingredients: Ingredient[]): LineState[] {
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const byName = new Map(ingredients.map((i) => [nameKey(i.name), i]));
  return lines.map((line) => {
    const ingredient = (line.ingredientId && byId.get(line.ingredientId)) || byName.get(nameKey(line.name));
    if (!ingredient) return { line, state: "missing" };
    const qty = line.unit ? convert(line.qty, line.unit, ingredient.unit) : line.qty;
    if (qty === null) return { line, state: "unit", ingredient };
    return { line, state: "ok", ingredient, qty, amount: qty * ingredient.lastRate };
  });
}

export function summarise(recipe: Pick<BookRecipe, "lines" | "recipeBase">, ingredients: Ingredient[]) {
  const states = resolveLines(recipe.lines, ingredients);
  const ok = states.filter((s) => s.state === "ok");
  const missing = states.filter((s) => s.state === "missing").length;
  const unit = states.filter((s) => s.state === "unit").length;
  const unpriced = ok.filter((s) => !(s.ingredient.lastRate > 0)).length;
  const total = ok.reduce((s, x) => s + x.amount, 0);
  const complete = !missing && !unit && states.length > 0;
  return { states, missing, unit, unpriced, total, complete, perPlate: total / (recipe.recipeBase || 100) };
}

/** A complete recipe as a dish's recipe lines; the same raw material twice adds up. */
export function dishLines(states: LineState[]) {
  const sum = new Map<string, number>();
  for (const s of states) if (s.state === "ok") sum.set(s.ingredient.id, Math.round(((sum.get(s.ingredient.id) ?? 0) + s.qty) * 1e6) / 1e6);
  return [...sum].map(([ingredientId, qty]) => ({ ingredientId, qty }));
}

/** A dish's recipe written straight on it (from before the Recipes page, or the dish's own editor). */
export function fromDish(item: MenuItem, recipes: RecipeLine[], ingredients: Ingredient[]): BookRecipe {
  const name = new Map(ingredients.map((i) => [i.id, i]));
  return {
    id: `dish:${item.id}`,
    name: item.name,
    itemId: item.id,
    recipeBase: item.recipeBase || 100,
    bufferPct: item.bufferPct ?? 5,
    lines: recipes.filter((r) => r.itemId === item.id).map((r) => ({ name: name.get(r.ingredientId)?.name ?? "Removed raw material", qty: r.qty, unit: name.get(r.ingredientId)?.unit ?? "", ingredientId: r.ingredientId })),
    updatedAt: "",
  };
}

/** The unit a new raw material is kept in, from the unit the recipe uses (grams go to kg). */
export const keptIn = (unit: string) => (unit ? baseUnit(unit).unit : "kg");

/** "500 g", "1.5 kg", "1 pcs" */
export const qtyText = (qty: number, unit: string) => `${Number(qty.toFixed(3))} ${normUnit(unit) || unit}`.trim();
