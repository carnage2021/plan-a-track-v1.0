import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { categoryRow, clientRow, enquiryRow, insertOrder, insertQuotation, itemRow, run, savePackageRows, schema } from "./db";
import { categories, clients, createSeed, items, packages } from "./seed";
import type { EventFunction } from "./types";
import { ok } from "./supply-db";
import { starterAssets, starterIngredients, starterRecipes, starterVendors } from "./supply-seed";
import { financialYear } from "./utils";
import { starterPhotos } from "./starter-photos";

/**
 * Fills a new caterer's account: the starter menu and packages always, and optionally sample
 * clients, enquiries, quotations and orders so every screen can be reviewed with real-looking data.
 */
export async function seedTenant(sb: SupabaseClient, tenantId: string, ownerId: string, withSamples: boolean) {
  const ids = new Map<string, string>();
  const id = (old: string) => ids.get(old) ?? ids.set(old, randomUUID()).get(old)!;

  await run(sb.from("menu_categories").insert(categories.map((c, i) => ({ ...categoryRow({ ...c, id: id(c.id) }, i), tenant_id: tenantId }))), "Starter categories");
  // Main course priced at booking needs 0022; before it is run the starter menu keeps its dish prices.
  const mainIds = categories.filter((c) => c.atBooking).map((c) => id(c.id));
  const mainReady = !(await sb.from("menu_categories").update({ priced_at_booking: true }).in("id", mainIds)).error;
  if (mainReady) schema.mainRate = true;
  await run(sb.from("menu_items").insert(items.map((i) => ({ ...itemRow({ ...i, id: id(i.id), categoryId: id(i.categoryId) }), tenant_id: tenantId }))), "Starter menu");
  for (const p of packages) {
    await savePackageRows(sb, { ...p, id: id(p.id), fixedItemIds: p.fixedItemIds.map(id), rules: p.rules.map((r) => ({ ...r, categoryId: id(r.categoryId) })) }, tenantId);
  }
  // Starter photos of uniforms, cutlery and decoration, so Step 3 has something to show; skipped before 0021.
  await sb.from("sample_photos").insert(starterPhotos.map((p, i) => ({ tenant_id: tenantId, kind: p.kind, name: p.name, photo_url: p.photoUrl, note: p.note, sort_order: i })));
  if (!withSamples) return;

  const now = new Date();
  const seed = createSeed(now);
  // A function row belongs to one quotation or one order, so each parent gets its own copies.
  // Sample events built dish by dish get a main course rate equal to their main dishes' old prices, so totals stay as they were.
  const mainCats = new Set(categories.filter((c) => c.atBooking).map((c) => c.id));
  const mainRateOf = (f: EventFunction) => (mainReady && !f.packageId ? items.filter((i) => f.itemIds.includes(i.id) && i.pricingType === "plate" && mainCats.has(i.categoryId)).reduce((s, i) => s + i.price, 0) : 0);
  const fns = (list: EventFunction[]) => list.map((f) => ({ ...f, id: randomUUID(), packageId: f.packageId ? id(f.packageId) : undefined, itemIds: f.itemIds.map(id), mainRate: mainRateOf(f) || undefined }));
  const extras = <T extends { id: string }>(list: T[]) => list.map((e) => ({ ...e, id: randomUUID() }));

  await run(sb.from("clients").insert(clients.map((c) => ({ ...clientRow({ ...c, id: id(c.id) }), tenant_id: tenantId }))), "Sample clients");
  await run(
    sb.from("enquiries").insert(seed.enquiries.map((e) => ({ ...enquiryRow({ ...e, id: id(e.id), clientId: id(e.clientId), assignedTo: ownerId }), tenant_id: tenantId, created_at: e.createdAt }))),
    "Sample enquiries",
  );
  for (const q of seed.quotations) {
    await insertQuotation(sb, { ...q, id: id(q.id), groupId: id(q.groupId), clientId: id(q.clientId), enquiryId: q.enquiryId ? id(q.enquiryId) : undefined, functions: fns(q.functions), extras: extras(q.extras), createdBy: ownerId }, tenantId);
  }
  for (const o of seed.orders) {
    await insertOrder(
      sb,
      { ...o, id: id(o.id), clientId: id(o.clientId), quotationId: o.quotationId ? id(o.quotationId) : undefined, functions: fns(o.functions), extras: extras(o.extras), payments: extras(o.payments), changeLog: extras(o.changeLog), managerId: ownerId },
      tenantId,
      ownerId,
    );
  }
  const fy = financialYear(now);
  await run(
    sb.from("number_series").insert(
      Object.entries(seed.counters).map(([doc_type, last_number]) => ({ tenant_id: tenantId, doc_type, financial_year: fy, last_number })),
    ),
    "Document numbers",
  );
}

/**
 * Phase 3 starter data: ingredients with opening stock, recipes for the starter dishes (matched by
 * dish name, so it also works on an account whose menu was created earlier), vendors with rates,
 * agency mapping for outsourced dishes, and the usual crockery. Does nothing if ingredients exist.
 */
export async function seedSupply(sb: SupabaseClient, tenantId: string) {
  const existing = await sb.from("ingredients").select("id").eq("tenant_id", tenantId).limit(1);
  if (existing.error) throw new Error("The phase 3 tables are missing. Run supabase/migrations/0003_supply.sql first.");
  if (existing.data.length) return false;

  const menu = (await sb.from("menu_items").select("id,name").eq("tenant_id", tenantId)).data ?? [];
  const cats = (await sb.from("menu_categories").select("id,name").eq("tenant_id", tenantId)).data ?? [];
  const dishId = (seedId: string) => menu.find((m) => m.name === items.find((i) => i.id === seedId)?.name)?.id as string | undefined;
  const catId = (seedId?: string) => cats.find((c) => c.name === categories.find((x) => x.id === seedId)?.name)?.id as string | undefined;
  const ing = new Map(starterIngredients.map((row) => [row[0], { id: randomUUID(), row }]));

  const stores = (await sb.from("stores").select("id").eq("tenant_id", tenantId).order("created_at").limit(1)).data ?? [];
  const store = { id: (stores[0]?.id as string | undefined) ?? randomUUID(), tenant_id: tenantId, name: "Main kitchen" };
  if (!stores.length) await ok(sb.from("stores").insert(store), "Starter store");
  await ok(sb.from("ingredients").insert([...ing.values()].map(({ id, row: [, name, unit, section, rate, reorder] }) => ({ id, tenant_id: tenantId, name, unit, section, last_rate: rate, reorder_level: reorder }))), "Starter ingredients");
  await ok(
    sb.from("stock_movements").insert([...ing.values()].filter(({ row }) => row[6] > 0).map(({ id, row }) => ({ tenant_id: tenantId, ingredient_id: id, store_id: store.id, movement: "opening", qty: row[6], rate: row[4], note: "Opening stock" }))),
    "Opening stock",
  );

  const recipeRows: { tenant_id: string; item_id: string; ingredient_id: string; qty: number }[] = [];
  for (const [seedId, text] of Object.entries(starterRecipes)) {
    const item = dishId(seedId);
    if (!item) continue;
    let cost = 0;
    for (const part of text.split(" ")) {
      const [key, qty] = part.split(":");
      const found = ing.get(key);
      if (!found) continue;
      recipeRows.push({ tenant_id: tenantId, item_id: item, ingredient_id: found.id, qty: Number(qty) });
      cost += Number(qty) * found.row[4];
    }
    // Food cost per plate now comes from the recipe, not a typed-in number.
    await ok(sb.from("menu_items").update({ cost: Math.round(cost) / 100 }).eq("id", item), "Recipe cost");
  }
  await ok(sb.from("recipe_lines").insert(recipeRows), "Starter recipes");

  const rateRows: { tenant_id: string; vendor_id: string; ingredient_id: string; rate: number }[] = [];
  for (const v of starterVendors) {
    const id = randomUUID();
    await ok(sb.from("vendors").insert({ id, tenant_id: tenantId, name: v.name, vendor_type: v.type, phone: v.phone, payment_terms: v.terms, rating: v.rating }), "Starter vendors");
    const priced = new Set<string>();
    for (const s of v.supplies ?? [])
      for (const [key, { id: ingredientId, row }] of ing) {
        if (row[3] !== s.section || priced.has(key) || (s.only && !s.only.includes(key))) continue;
        priced.add(key);
        rateRows.push({ tenant_id: tenantId, vendor_id: id, ingredient_id: ingredientId, rate: Math.max(0.5, row[4] + s.adjust) });
      }
    for (const [seedId, rate] of Object.entries(v.dishes ?? {})) {
      const item = dishId(seedId);
      if (item) await ok(sb.from("menu_items").update({ agency_id: id, agency_rate: rate, cost: rate }).eq("id", item), "Agency mapping");
    }
  }
  await ok(sb.from("vendor_rates").insert(rateRows), "Vendor rates");
  await ok(
    sb.from("assets").insert(starterAssets.map(([name, category, total, cost, basis, value, cat]) => ({ tenant_id: tenantId, name, category, total_qty: total, replacement_cost: cost, rule_basis: basis, rule_value: value, rule_category_id: catId(cat) ?? null }))),
    "Starter crockery",
  );
  return true;
}
