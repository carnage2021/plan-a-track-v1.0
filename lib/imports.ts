"use client";

import * as React from "react";
import { subPath } from "./categories";
import { defaultFoodTypes } from "./services";
import { itemRow, clientRow, packageRow, schema } from "./db";
import { useStaff } from "./staff";
import { useStore } from "./store";
import { assetRow, ingredientRow, vendorRow } from "./supply-db";
import { useSupply } from "./supply-store";
import { uid } from "./utils";
import { baseUnit } from "./recipe-import";

// Phase 7 (plan A3): every master list can come from an Excel or CSV file, checked row by row before
// anything is saved. Each import remembers what it created so the last one can be undone.

export type ListKey = "menu" | "packages" | "vendors" | "workers" | "clients" | "ingredients" | "cutlery" | "events";
type Cell = string | number | boolean | Date | null | undefined;
export interface Column { label: string; required?: boolean; example: string; kind?: "number" | "date"; options?: Record<string, string> }
/* eslint-disable @typescript-eslint/no-explicit-any -- rows go straight to PostgREST */
type Row = Record<string, any>;
/** Rows to insert, by table, in the order they must go in. */
export type Plan = { table: string; rows: Row[] }[];

export interface ListSpec {
  key: ListKey;
  label: string;
  columns: Column[];
  /** What makes a row a duplicate of one already saved */
  existing: () => Set<string>;
  identity: (r: Record<string, string>) => string;
  build: (records: Record<string, string>[]) => Plan;
  /** Checks a row against what is already in the account (categories, food types), beyond its own columns */
  check?: (r: Record<string, string>) => string[];
  rows: () => Record<string, string | number>[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const num = (v: string) => Number(String(v).replace(/[₹,\s]/g, "")) || 0;

const diet = { veg: "veg", vegetarian: "veg", jain: "jain", nonveg: "nonveg", nonvegetarian: "nonveg" };
const vendorTypes = { rawmaterial: "raw_material", grocery: "raw_material", foodagency: "food_agency", thirdpartyfood: "food_agency", agency: "food_agency", rental: "rental", transport: "transport", labour: "labour", labourcontractor: "labour", decor: "decor", hospitality: "hospitality", pro: "hospitality" };
const workerTypes = { salaried: "salaried", staff: "salaried", monthly: "salaried", daily: "daily", dailywage: "daily", contractor: "contractor" };
const sections = { grocery: "grocery", vegetables: "vegetables", vegetable: "vegetables", dairy: "dairy", dryfruits: "dry_fruits", other: "other" };
const pricing = { plate: "plate", perplate: "plate", counter: "counter", percounter: "counter", flat: "flat" };
const units = { plate: "plate", kg: "kg", piece: "piece", glass: "glass" };

/** Turns a cell into text the same way whether it came from Excel or CSV; dates become YYYY-MM-DD. */
export function cellText(v: Cell) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

/** While an upload is saving, closing or reloading the tab asks first, so a file is never saved half way. */
export function useLeaveGuard(active: boolean) {
  React.useEffect(() => {
    if (!active) return;
    const stop = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", stop);
    return () => window.removeEventListener("beforeunload", stop);
  }, [active]);
}

/** What became of one sheet of an uploaded workbook. */
export interface SheetNote { name: string; rows: number; skipped?: string; note?: string }
/** Every usable sheet of a file as one table: the header, its rows, where each row came from, and a note per sheet. */
export interface Table { head: string[]; rows: string[][]; where: string[]; sheets: SheetNote[] }

/**
 * Reads an .xlsx or .csv into one table. Every sheet of a workbook is read, not just the first: a sheet counts when
 * one of its first rows has the template's column names (a title above them is fine). A sheet with rows but no
 * column names is read with the columns of the sheet before it. `fillDown` fills a blank cell of that column from the
 * row above (merged cells read as blank), or, at the top of a sheet, from the sheet's own name.
 */
export async function readTable(file: File, labels: readonly string[], fillDown?: string): Promise<Table> {
  let books: { name: string; grid: string[][] }[];
  if (/\.xlsx$/i.test(file.name)) {
    const { default: readXlsxFile } = await import("read-excel-file/browser");
    books = (await readXlsxFile(file)).map((s) => ({ name: s.sheet, grid: (s.data as unknown[][]).map((row) => row.map((c) => cellText(c as Cell))) }));
  } else books = [{ name: file.name, grid: parseCsv(await file.text()) }];

  const wanted = new Set(labels.map(norm));
  const found = new Set<string>();
  const unknown: string[] = [];
  const rows: string[][] = [], where: string[] = [], sheets: SheetNote[] = [];
  let last: { name: string; head: string[] } | null = null;
  const many = books.length > 1;

  for (const { name, grid } of books) {
    const filled = grid.map((row, i) => ({ row, n: i + 1 })).filter((x) => x.row.some((c) => c.trim()));
    if (!filled.length) { if (many) sheets.push({ name, rows: 0, skipped: "empty" }); continue; }
    // The header is the row among the first ten that names the most template columns.
    let best = -1, score = 0;
    filled.slice(0, 10).forEach((x, i) => { const s = x.row.filter((c) => wanted.has(norm(c))).length; if (s > score) { score = s; best = i; } });
    let head: string[], body = filled, note: string | undefined;
    if (score >= Math.min(2, labels.length)) { head = filled[best].row; body = filled.slice(best + 1); last = { name, head }; }
    else if (last && Math.max(...filled.map((x) => x.row.length)) <= last.head.length + 1 && filled.filter((x) => x.row.filter((c) => c.trim()).length >= Math.min(3, labels.length)).length >= filled.length / 2) { head = last.head; note = `no column names, read with the columns of "${last.name}"`; }
    else { sheets.push({ name, rows: filled.length, skipped: `no row with the column names (${labels.slice(0, 3).join(", ")} …)` }); continue; }

    const at = new Map<string, number>();
    head.forEach((h, i) => { const k = norm(h); if (!k) return; if (wanted.has(k)) { if (!at.has(k)) at.set(k, i); found.add(k); } else if (!unknown.includes(h.trim())) unknown.push(h.trim()); });
    const fill = fillDown ? norm(fillDown) : "";
    // At the top of a sheet the sheet's own name stands in, unless it is a default like "Sheet1".
    let carry = fill && !/^sheet\s*\d*$/i.test(name.trim()) ? name.trim() : "";
    if (fill && !at.has(fill) && carry) found.add(fill);
    for (const { row, n } of body) {
      const out = labels.map((l) => (row[at.get(norm(l)) ?? -1] ?? "").trim());
      if (fill) { const i = labels.findIndex((l) => norm(l) === fill); if (out[i]) carry = out[i]; else out[i] = carry; }
      rows.push(out);
      where.push(many ? `${name} · row ${n}` : `Row ${n}`);
    }
    sheets.push({ name, rows: body.length, note });
  }
  return { head: [...labels.filter((l) => found.has(norm(l))), ...unknown], rows, where, sheets };
}

/** One line on which sheets of a workbook were read and which were not, for the screen after an upload. */
export function sheetSummary(sheets: SheetNote[]) {
  if (sheets.length < 2) return "";
  const used = sheets.filter((s) => !s.skipped);
  const skipped = sheets.filter((s) => s.skipped && s.skipped !== "empty");
  return [`Read ${used.length} of ${sheets.length} sheets (${used.map((s) => `${s.name}: ${s.rows}`).join(", ")})`, ...skipped.map((s) => `Not read: "${s.name}", ${s.skipped}`), ...used.filter((s) => s.note).map((s) => `"${s.name}": ${s.note}`)].join(". ");
}

/** Checks one record against its columns: required values, numbers, dates and the allowed choices. */
export function validate(spec: ListSpec, r: Record<string, string>) {
  const errors: string[] = [];
  for (const c of spec.columns) {
    const v = r[c.label] ?? "";
    if (c.required && !v) errors.push(`${c.label} is missing`);
    else if (v && c.kind === "number" && Number.isNaN(Number(v.replace(/[₹,\s]/g, "")))) errors.push(`${c.label} must be a number`);
    else if (v && c.kind === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) errors.push(`${c.label} must be a date like 1990-05-21`);
    else if (v && c.options && !(norm(v) in c.options)) errors.push(`${c.label} "${v}" is not one of: ${[...new Set(Object.values(c.options))].join(", ")}`);
  }
  if (spec.check) errors.push(...spec.check(r));
  return errors;
}
const pick = (c: Column | undefined, v: string, fallback: string) => (v && c?.options ? (c.options[norm(v)] ?? fallback) : fallback);
const col = (spec: { columns: Column[] }, label: string) => spec.columns.find((c) => c.label === label);

export const lists: ListSpec[] = [
  {
    key: "menu",
    label: "Menu items",
    columns: [
      { label: "Name", required: true, example: "Paneer Tikka" },
      { label: "Local name", example: "પનીર ટિક્કા" },
      { label: "Category", required: true, example: "Main course" },
      { label: "Sub-category", example: "Sabji > Paneer sabji" },
      { label: "Diet", example: "Veg", options: diet },
      { label: "Cuisine", example: "Punjabi" },
      { label: "Unit", example: "plate", options: units },
      { label: "Priced", example: "plate", options: pricing },
      { label: "Cost", kind: "number", example: "45" },
      { label: "Price", kind: "number", example: "120" },
      { label: "Description", example: "Chargrilled cottage cheese with mint chutney" },
      { label: "Photo link", example: "https://example.com/paneer.jpg" },
    ],
    existing: () => new Set(useStore.getState().items.map((i) => norm(i.name))),
    identity: (r) => norm(r.Name),
    build(records) {
      const s = useStore.getState();
      // Categories by parent and name, so "Main course" and "Sabji > Paneer sabji" find the right ones,
      // and any that do not exist yet are made, each inside the one before it.
      const known = s.categories.map((c) => ({ id: c.id, name: c.name, parent: c.parentId && s.categories.some((p) => p.id === c.parentId) ? c.parentId : "" }));
      const newCats: Row[] = [];
      const find = (parent: string, name: string) => {
        const hit = known.find((c) => c.parent === parent && norm(c.name) === norm(name));
        if (hit) return hit.id;
        const id = uid();
        known.push({ id, name: name.trim(), parent });
        newCats.push({ id, name: name.trim(), icon: s.categories.find((c) => c.id === parent)?.icon ?? "Utensils", sort_order: s.categories.length + newCats.length, ...(schema.subcategories ? { parent_id: parent || null } : {}) });
        return id;
      };
      const items = records.map((r) => {
        let categoryId = find("", r.Category);
        // Without sub-categories in the database, a sub-category path is ignored and the dish sits in its category.
        if (schema.subcategories) for (const part of (r["Sub-category"] ?? "").split(/[>›/]/).map((x) => x.trim()).filter(Boolean)) categoryId = find(categoryId, part);
        return itemRow({
          id: uid(), name: r.Name, nameLocal: r["Local name"] ?? "", categoryId, diet: pick(col(this, "Diet"), r.Diet, "veg") as "veg", cuisine: r.Cuisine ?? "", spice: 1,
          unit: pick(col(this, "Unit"), r.Unit, "plate") as "plate", pricingType: pick(col(this, "Priced"), r.Priced, "plate") as "plate", cost: num(r.Cost), price: num(r.Price),
          photo: r["Photo link"] || undefined, description: r.Description ?? "", active: true, outsourced: false, seasonal: false, bestseller: false, recipeBase: 100, bufferPct: 5, agencyRate: 0,
        });
      });
      return [{ table: "menu_categories", rows: newCats }, { table: "menu_items", rows: items }];
    },
    rows: () => {
      const s = useStore.getState();
      // The category is the top-level one; anything below it goes in Sub-category as "Sabji > Paneer sabji".
      const top = (id: string) => { let c = s.categories.find((x) => x.id === id); for (let n = 0; c?.parentId && n < 20; n++) c = s.categories.find((x) => x.id === c!.parentId) ?? c; return c?.name ?? ""; };
      return s.items.map((i) => ({ Name: i.name, "Local name": i.nameLocal, Category: top(i.categoryId), "Sub-category": subPath(i.categoryId).replace(/ › /g, " > "), Diet: i.diet, Cuisine: i.cuisine, Unit: i.unit, Priced: i.pricingType, Cost: i.cost, Price: i.price, Description: i.description, "Photo link": i.photo ?? "" }));
    },
  },
  {
    key: "packages",
    label: "Packages",
    columns: [
      { label: "Name", required: true, example: "Gold" },
      { label: "Price per plate", required: true, kind: "number", example: "650" },
      { label: "Minimum guests", kind: "number", example: "150" },
      { label: "Food type", example: "Gala Dinner" },
      { label: "Choices", example: "Welcome drinks 1; Starters 3; Main course 4; Breads 2; Rice 1; Sweets 2" },
      { label: "Special additions", example: "Paan counter; Farsan 2" },
      { label: "Description", example: "Our most booked wedding menu" },
    ],
    existing: () => new Set(useStore.getState().packages.filter((p) => !p.archived).map((p) => norm(p.name))),
    identity: (r) => norm(r.Name),
    check(r) {
      const errors: string[] = [];
      for (const part of splitList(r.Choices)) {
        const c = parseCount(part);
        if (!c.count) errors.push(`Choices "${part}" needs a number, like Starters 2`);
        else if (!findCategory(c.name)) errors.push(`Choices: no category called "${c.name}"`);
      }
      if (r["Food type"] && !findFoodType(r["Food type"])) errors.push(`Food type "${r["Food type"]}" is not one of: ${foodTypes().map((t) => t.name).join(", ")}`);
      return errors;
    },
    build(records) {
      const packages: Row[] = [];
      const rules: Row[] = [];
      for (const r of records) {
        const id = uid();
        const choices = new Map<string, number>();
        for (const part of splitList(r.Choices)) {
          const c = parseCount(part);
          const categoryId = findCategory(c.name);
          if (categoryId && c.count) choices.set(categoryId, c.count);
        }
        packages.push(packageRow({
          id, name: r.Name, tier: "custom", pricePerPlate: num(r["Price per plate"]), minPax: num(r["Minimum guests"]), fixedItemIds: [], rules: [], description: r.Description ?? "",
          foodTypeId: r["Food type"] ? findFoodType(r["Food type"]) : undefined,
          additions: splitList(r["Special additions"]).map((part) => { const c = parseCount(part); return { id: uid(), name: c.name, count: c.count }; }),
        }));
        for (const [categoryId, choose] of choices) rules.push({ package_id: id, category_id: categoryId, choose });
      }
      return [{ table: "packages", rows: packages }, { table: "package_rules", rows: rules }];
    },
    rows: () => {
      const s = useStore.getState();
      const types = foodTypes();
      return s.packages.filter((p) => !p.archived).map((p) => ({
        Name: p.name, "Price per plate": p.pricePerPlate, "Minimum guests": p.minPax,
        "Food type": types.find((t) => t.id === p.foodTypeId)?.name ?? "",
        Choices: p.rules.map((r) => `${categoryLabel(r.categoryId)} ${r.choose}`).join("; "),
        "Special additions": (p.additions ?? []).map((a) => (a.count ? `${a.name} ${a.count}` : a.name)).join("; "),
        Description: p.description,
      }));
    },
  },
  {
    key: "vendors",
    label: "Vendors and suppliers",
    columns: [
      { label: "Name", required: true, example: "Shree Grocery Mart" },
      { label: "Type", example: "Raw material", options: vendorTypes },
      { label: "Phone", example: "9825012345" },
      { label: "GSTIN", example: "24ABCDE1234F1Z5" },
      { label: "Payment terms", example: "15 days credit" },
      { label: "Notes", example: "Delivers before 8 am" },
    ],
    existing: () => new Set(useSupply.getState().vendors.map((v) => norm(v.name))),
    identity: (r) => norm(r.Name),
    build(records) {
      return [{ table: "vendors", rows: records.map((r) => vendorRow({ id: uid(), name: r.Name, type: pick(col(this, "Type"), r.Type, "raw_material") as "raw_material", phone: r.Phone ?? "", gstin: (r.GSTIN ?? "").toUpperCase(), terms: r["Payment terms"] ?? "", rating: 0, notes: r.Notes ?? "" })) }];
    },
    rows: () => useSupply.getState().vendors.map((v) => ({ Name: v.name, Type: v.type, Phone: v.phone, GSTIN: v.gstin, "Payment terms": v.terms, Notes: v.notes })),
  },
  {
    key: "workers",
    label: "Workers",
    columns: [
      { label: "Name", required: true, example: "Ramesh Patel" },
      { label: "Phone", example: "9898012345" },
      { label: "Role", example: "Cook" },
      { label: "Type", example: "Daily wage", options: workerTypes },
      { label: "Rate per day", kind: "number", example: "800" },
      { label: "Rate per event", kind: "number", example: "1200" },
      { label: "Monthly salary", kind: "number", example: "0" },
      { label: "ID proof", example: "Aadhaar XXXX 1234" },
      { label: "UPI", example: "ramesh@upi" },
    ],
    existing: () => new Set(useStaff.getState().workers.map((w) => norm(w.name))),
    identity: (r) => norm(r.Name),
    build(records) {
      return [{ table: "workers", rows: records.map((r) => ({ id: uid(), name: r.Name, phone: r.Phone ?? "", role: r.Role || "Helper", worker_type: pick(col(this, "Type"), r.Type, "daily"), rate_day: num(r["Rate per day"]), rate_event: num(r["Rate per event"]), monthly_salary: num(r["Monthly salary"]), id_proof: r["ID proof"] ?? "", upi: r.UPI ?? "" })) }];
    },
    rows: () => useStaff.getState().workers.map((w) => ({ Name: w.name, Phone: w.phone, Role: w.role, Type: w.type, "Rate per day": w.rateDay, "Rate per event": w.rateEvent, "Monthly salary": w.monthlySalary, "ID proof": w.idProof, UPI: w.upi })),
  },
  {
    key: "clients",
    label: "Clients",
    columns: [
      { label: "Name", required: true, example: "Anjali Mehta" },
      { label: "Phone", required: true, example: "9825070011" },
      { label: "Email", example: "anjali@example.com" },
      { label: "Address", example: "Bodakdev, Ahmedabad" },
      { label: "GSTIN", example: "" },
      { label: "Birthday", kind: "date", example: "1990-05-21" },
      { label: "Anniversary", kind: "date", example: "2015-12-04" },
    ],
    existing: () => new Set(useStore.getState().clients.map((c) => c.phone.replace(/\D/g, "").slice(-10))),
    identity: (r) => (r.Phone ?? "").replace(/\D/g, "").slice(-10),
    build(records) {
      return [{ table: "clients", rows: records.map((r) => clientRow({ id: uid(), name: r.Name, phone: (r.Phone ?? "").replace(/\D/g, "").slice(-10), email: r.Email || undefined, address: r.Address || undefined, gstin: r.GSTIN ? r.GSTIN.toUpperCase() : undefined, type: r.GSTIN ? "corporate" : "retail", tags: [], language: "en", birthday: r.Birthday || undefined, anniversary: r.Anniversary || undefined })) }];
    },
    rows: () => useStore.getState().clients.map((c) => ({ Name: c.name, Phone: c.phone, Email: c.email ?? "", Address: c.address ?? "", GSTIN: c.gstin ?? "", Birthday: c.birthday ?? "", Anniversary: c.anniversary ?? "" })),
  },
  {
    key: "ingredients",
    label: "Ingredients",
    columns: [
      { label: "Name", required: true, example: "Basmati rice" },
      { label: "Unit", example: "kg" },
      { label: "Section", example: "Grocery", options: sections },
      { label: "Current stock", kind: "number", example: "60" },
      { label: "Reorder level", kind: "number", example: "20" },
      { label: "Last rate", kind: "number", example: "110" },
    ],
    existing: () => new Set(useSupply.getState().ingredients.map((i) => norm(i.name))),
    identity: (r) => norm(r.Name),
    build(records) {
      const store = useSupply.getState().stores[0];
      const newStore = store ? [] : [{ id: uid(), name: "Main store" }];
      const storeId = store?.id ?? newStore[0].id;
      const ingredients: Row[] = records.map((r) => {
        // Grams and ml come in as kg and litres: 500 in g is 0.5 kg, and a rate per gram becomes a rate per kg.
        const b = baseUnit(r.Unit || "kg");
        r = { ...r, "Current stock": String(num(r["Current stock"]) * b.factor), "Reorder level": String(num(r["Reorder level"]) * b.factor), "Last rate": String(num(r["Last rate"]) / b.factor) };
        return { ...ingredientRow({ id: uid(), name: r.Name, unit: b.unit, section: pick(col(this, "Section"), r.Section, "grocery") as "grocery", reorderLevel: num(r["Reorder level"]), lastRate: num(r["Last rate"]), location: "" }), _stock: num(r["Current stock"]) };
      });
      const opening = ingredients.filter((i) => i._stock > 0).map((i) => ({ id: uid(), ingredient_id: i.id, store_id: storeId, movement: "opening", qty: i._stock, rate: i.last_rate, note: "Opening stock from import" }));
      return [{ table: "stores", rows: newStore }, { table: "ingredients", rows: ingredients.map((i) => Object.fromEntries(Object.entries(i).filter(([k]) => k !== "_stock"))) }, { table: "stock_movements", rows: opening }];
    },
    rows: () => {
      const { ingredients, movements } = useSupply.getState();
      const stock = new Map<string, number>();
      for (const m of movements) stock.set(m.ingredientId, (stock.get(m.ingredientId) ?? 0) + m.qty);
      return ingredients.map((i) => ({ Name: i.name, Unit: i.unit, Section: i.section, "Current stock": Math.round((stock.get(i.id) ?? 0) * 1000) / 1000, "Reorder level": i.reorderLevel, "Last rate": i.lastRate }));
    },
  },
  {
    key: "cutlery",
    label: "Cutlery and equipment",
    columns: [
      { label: "Item", required: true, example: "Dinner plate, steel" },
      { label: "Category", example: "Crockery" },
      { label: "Total quantity", required: true, kind: "number", example: "500" },
      { label: "Replacement cost", kind: "number", example: "85" },
      { label: "Rent per piece", kind: "number", example: "4" },
      { label: "Storage location", example: "Godown rack 3" },
    ],
    existing: () => new Set(useSupply.getState().assets.map((a) => norm(a.name))),
    identity: (r) => norm(r.Item),
    build(records) {
      return [{ table: "assets", rows: records.map((r) => assetRow({ id: uid(), name: r.Item, category: r.Category || "Crockery", totalQty: num(r["Total quantity"]), replacementCost: num(r["Replacement cost"]), rentRate: num(r["Rent per piece"]), location: r["Storage location"] ?? "", ruleBasis: "manual", ruleValue: 0 })) }];
    },
    rows: () => useSupply.getState().assets.map((a) => ({ Item: a.name, Category: a.category, "Total quantity": a.totalQty, "Replacement cost": a.replacementCost, "Rent per piece": a.rentRate ?? 0, "Storage location": a.location })),
  },
  {
    key: "events",
    label: "Event types",
    columns: [{ label: "Event type", required: true, example: "Wedding" }],
    // An account still on the standard list has none of its own, so every row comes in.
    existing: () => new Set(useStore.getState().eventTypes.map((e) => norm(e.name))),
    identity: (r) => norm(r["Event type"]),
    build(records) {
      const start = useStore.getState().eventTypes.length;
      return [{ table: "event_types", rows: records.map((r, i) => ({ id: uid(), name: r["Event type"].trim(), sort_order: start + i })) }];
    },
    rows: () => useStore.getState().eventTypes.map((e) => ({ "Event type": e.name })),
  },
];

/** "Starters 4; Main course 5" or one per line, as a list. */
function splitList(v?: string) {
  return (v ?? "").split(/[;\n]/).map((x) => x.trim()).filter(Boolean);
}

/** "Starters 4" into the name and the number; "Paan counter" has no number (0). */
function parseCount(part: string) {
  const m = part.match(/^(.*?)[\s:×x-]*(\d+)$/);
  return m ? { name: m[1].trim(), count: Number(m[2]) } : { name: part.trim(), count: 0 };
}

/** A category by name, or by path for a sub-category: "Main course > Sabji > Paneer sabji". */
function findCategory(name: string) {
  const cats = useStore.getState().categories;
  const parts = name.split(/[>›]/).map((x) => x.trim()).filter(Boolean);
  if (parts.length > 1) {
    let parent: string | undefined;
    for (const p of parts) {
      const hit = cats.find((c) => (c.parentId ?? undefined) === parent && norm(c.name) === norm(p));
      if (!hit) return undefined;
      parent = hit.id;
    }
    return parent;
  }
  // A plain name: a main category first, then any sub-category with that name.
  const same = cats.filter((c) => norm(c.name) === norm(name));
  return (same.find((c) => !c.parentId) ?? same[0])?.id;
}

/** How a category is written back in an export: its name, or its path when it is a sub-category. */
function categoryLabel(id: string) {
  const cats = useStore.getState().categories;
  const names: string[] = [];
  for (let c = cats.find((x) => x.id === id), n = 0; c && n < 20; c = cats.find((x) => x.id === c!.parentId), n++) names.unshift(c.name);
  return names.join(" > ");
}

const foodTypes = () => {
  const s = useStore.getState();
  return s.tenant.foodTypes?.length ? s.tenant.foodTypes : defaultFoodTypes(s.categories);
};
const findFoodType = (name: string) => foodTypes().find((t) => norm(t.name) === norm(name))?.id;

/** CSV text, quoted for Excel; a leading byte-order mark keeps Gujarati and Hindi readable. */
export function toCsv(headers: string[], rows: (string | number)[][]) {
  const cell = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return "﻿" + [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

/** A small CSV reader: quoted fields, embedded commas and new lines, and both line endings. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

export function download(name: string, text: string) {
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" })), download: name });
  a.click();
  URL.revokeObjectURL(a.href);
}
