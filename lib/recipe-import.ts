import type { Ingredient, RecipeLine, Section } from "./supply-types";
import type { MenuItem } from "./types";

// Recipes from a spreadsheet: one row per raw material of a dish (Dish, Raw material, Quantity, Unit, For guests,
// Wastage %). Each dish in the sheet gets the sheet's recipe in full, replacing what it had. Raw materials not in
// the inventory yet are listed so they can be added in one go; units are converted where they can be.

export const recipeColumns = [
  { label: "Dish", required: true, example: "Paneer Tikka" },
  { label: "Raw material", required: true, example: "Paneer" },
  { label: "Quantity", required: true, example: "12" },
  { label: "Unit", required: false, example: "kg" },
  { label: "For guests", required: false, example: "100" },
  { label: "Wastage %", required: false, example: "5" },
] as const;

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const num = (v: string) => Number(String(v).replace(/[₹,\s]/g, ""));

/** The same unit however it is written: "Kgs", "kilo" and "kg" are all kg. */
const aliases: Record<string, string> = {
  kg: "kg", kgs: "kg", kilo: "kg", kilos: "kg", kilogram: "kg", kilograms: "kg",
  g: "g", gm: "g", gms: "g", gram: "g", grams: "g", gr: "g",
  l: "l", lt: "l", ltr: "l", ltrs: "l", litre: "l", litres: "l", liter: "l", liters: "l",
  ml: "ml", millilitre: "ml", milliliter: "ml",
  pcs: "pcs", pc: "pcs", piece: "pcs", pieces: "pcs", nos: "pcs", no: "pcs", nag: "pcs",
  dozen: "dozen", dz: "dozen", doz: "dozen",
  packet: "packet", packets: "packet", pkt: "packet", pack: "packet",
  bunch: "bunch", bunches: "bunch", judi: "bunch",
};
export const normUnit = (u: string) => aliases[key(u)] ?? key(u);

/** How many of `to` make one `from`, for the units that convert; null when they do not. */
const factors: Record<string, Record<string, number>> = {
  kg: { g: 1000 }, g: { kg: 0.001 },
  l: { ml: 1000 }, ml: { l: 0.001 },
  dozen: { pcs: 12 }, pcs: { dozen: 1 / 12 },
};
export function convert(qty: number, from: string, to: string) {
  const a = normUnit(from), b = normUnit(to);
  if (a === b) return qty;
  const f = factors[a]?.[b];
  return f ? Math.round(qty * f * 1000) / 1000 : null;
}

/** A first guess at the store section for a new raw material; it can be changed before adding. */
export function guessSection(name: string): Section {
  const n = name.toLowerCase();
  if (/paneer|milk|doodh|curd|dahi|ghee|butter|cream|malai|cheese|khoya|mawa|chaas/.test(n)) return "dairy";
  if (/cashew|kaju|almond|badam|pista|raisin|kishmish|walnut|akhrot|saffron|kesar|dates|khajur|anjeer/.test(n)) return "dry_fruits";
  if (/onion|tomato|potato|capsicum|chilli|chili|coriander|dhaniya|ginger|garlic|cabbage|cauliflower|peas|carrot|beans|spinach|palak|methi|lemon|cucumber|brinjal|ringan|bhindi|okra|mint|pudina|gourd|dudhi|beetroot|corn|mushroom|leaves|papdi|valor|yam|kand|suran|ratalu|sweet potato|shakkariya|tuver lilva|lilva|drumstick|saragva|tindora|parwal|turai|karela|kakdi|kobi|flower|vatana|gajar|bateta|dungri|tameta|marcha|lasan|aadu|kothmir/.test(n)) return "vegetables";
  return "grocery";
}

export interface RecipeRow {
  row: number;
  dish: string;
  raw: string;
  qty: string;
  unit: string;
  errors: string[];
  /** Waiting for a raw material that is not in the inventory yet */
  waiting?: boolean;
}

export interface DishPlan {
  item: MenuItem;
  recipeBase: number;
  bufferPct: number;
  /** Raw material id to quantity, in the raw material's own unit */
  lines: Map<string, number>;
  /** Already has a recipe, which the sheet replaces */
  replaces: boolean;
  /** Some of its raw materials are not in the inventory yet */
  blocked: boolean;
}

export interface Missing { name: string; unit: string; section: Section; dishes: string[] }

/** Checks every row of a recipe sheet against the menu and the inventory. */
export function analyse(grid: string[][], items: MenuItem[], ingredients: Ingredient[], recipes: RecipeLine[]) {
  const [head = [], ...body] = grid;
  const index = new Map(head.map((h, i) => [key(h), i]));
  const cell = (row: string[], label: string) => (row[index.get(key(label)) ?? -1] ?? "").trim();
  const unknown = head.filter((h) => h.trim() && !recipeColumns.some((c) => key(c.label) === key(h)));
  const missingColumns = recipeColumns.filter((c) => c.required && !index.has(key(c.label))).map((c) => c.label);

  const itemByName = new Map(items.map((i) => [key(i.name), i]));
  const ingByName = new Map(ingredients.map((i) => [key(i.name), i]));
  const plans = new Map<string, DishPlan>();
  const missing = new Map<string, Missing>();
  const rows: RecipeRow[] = [];

  body.forEach((r, i) => {
    const row: RecipeRow = { row: i + 2, dish: cell(r, "Dish"), raw: cell(r, "Raw material"), qty: cell(r, "Quantity"), unit: cell(r, "Unit"), errors: [] };
    rows.push(row);
    const item = itemByName.get(key(row.dish));
    const qty = num(row.qty);
    if (!row.dish) row.errors.push("Dish is missing");
    else if (!item) row.errors.push(`No dish called "${row.dish}" on your menu`);
    if (!row.raw) row.errors.push("Raw material is missing");
    if (!row.qty) row.errors.push("Quantity is missing");
    else if (!Number.isFinite(qty) || qty <= 0) row.errors.push("Quantity must be a number above 0");
    const baseText = cell(r, "For guests"), wasteText = cell(r, "Wastage %");
    if (baseText && !(num(baseText) > 0)) row.errors.push("For guests must be a number above 0");
    if (wasteText && !(num(wasteText) >= 0)) row.errors.push("Wastage % must be a number");
    if (!item || row.errors.length) return;

    const plan = plans.get(item.id) ?? { item, recipeBase: item.recipeBase || 100, bufferPct: item.bufferPct ?? 5, lines: new Map(), replaces: recipes.some((x) => x.itemId === item.id), blocked: false };
    // The first row of a dish that gives For guests or Wastage % sets it for the whole dish.
    if (baseText && !plans.has(item.id)) plan.recipeBase = num(baseText);
    if (wasteText && !plans.has(item.id)) plan.bufferPct = num(wasteText);
    plans.set(item.id, plan);

    const ing = ingByName.get(key(row.raw));
    if (!ing) {
      // Not in the inventory yet: listed once, with the unit the sheet uses.
      const m = missing.get(key(row.raw)) ?? { name: row.raw, unit: row.unit ? normUnit(row.unit) : "kg", section: guessSection(row.raw), dishes: [] };
      if (!m.dishes.includes(item.name)) m.dishes.push(item.name);
      missing.set(key(row.raw), m);
      row.waiting = true;
      plan.blocked = true;
      return;
    }
    const inUnit = row.unit ? convert(qty, row.unit, ing.unit) : qty;
    if (inUnit === null) {
      row.errors.push(`${ing.name} is kept in ${ing.unit}; ${row.unit} cannot be changed into ${ing.unit}`);
      plan.blocked = true;
      return;
    }
    // The same raw material twice in one dish adds up.
    plan.lines.set(ing.id, Math.round(((plan.lines.get(ing.id) ?? 0) + inUnit) * 1000) / 1000);
  });

  // A dish with a row in error is held back whole, so no recipe is saved half right.
  for (const row of rows) if (row.errors.length) { const p = [...plans.values()].find((x) => key(x.item.name) === key(row.dish)); if (p) p.blocked = true; }
  const ready = [...plans.values()].filter((p) => !p.blocked && p.lines.size);
  return { rows, plans: [...plans.values()], ready, missing: [...missing.values()], unknown, missingColumns };
}

/** What a dish's recipe was before an upload, so the upload can be undone. */
export interface RecipeSnapshot { itemId: string; recipeBase: number; bufferPct: number; cost: number; lines: { ingredientId: string; qty: number }[] }
