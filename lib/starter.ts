import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { categoryRow, clientRow, enquiryRow, insertOrder, insertQuotation, itemRow, run, savePackageRows } from "./db";
import { categories, clients, createSeed, items, packages } from "./seed";
import type { EventFunction } from "./types";
import { financialYear } from "./utils";

/**
 * Fills a new caterer's account: the starter menu and packages always, and optionally sample
 * clients, enquiries, quotations and orders so every screen can be reviewed with real-looking data.
 */
export async function seedTenant(sb: SupabaseClient, tenantId: string, ownerId: string, withSamples: boolean) {
  const ids = new Map<string, string>();
  const id = (old: string) => ids.get(old) ?? ids.set(old, randomUUID()).get(old)!;

  await run(sb.from("menu_categories").insert(categories.map((c, i) => ({ ...categoryRow({ ...c, id: id(c.id) }, i), tenant_id: tenantId }))), "Starter categories");
  await run(sb.from("menu_items").insert(items.map((i) => ({ ...itemRow({ ...i, id: id(i.id), categoryId: id(i.categoryId) }), tenant_id: tenantId }))), "Starter menu");
  for (const p of packages) {
    await savePackageRows(sb, { ...p, id: id(p.id), fixedItemIds: p.fixedItemIds.map(id), rules: p.rules.map((r) => ({ ...r, categoryId: id(r.categoryId) })) }, tenantId);
  }
  if (!withSamples) return;

  const now = new Date();
  const seed = createSeed(now);
  // A function row belongs to one quotation or one order, so each parent gets its own copies.
  const fns = (list: EventFunction[]) => list.map((f) => ({ ...f, id: randomUUID(), packageId: f.packageId ? id(f.packageId) : undefined, itemIds: f.itemIds.map(id) }));
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
