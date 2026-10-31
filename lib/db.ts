import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Client,
  Enquiry,
  EventFunction,
  ExtraCharge,
  MenuCategory,
  MenuItem,
  MenuPackage,
  Order,
  Payment,
  Quotation,
  Role,
  TeamUser,
  Tenant,
  DocSettings,
  SamplePhoto,
} from "./types";
import { inBranch, setBranchContext, withBranch } from "./branch";
import { localDay } from "./utils";

// Maps between the app's objects (lib/types.ts) and the Postgres rows (supabase/migrations).
// Used by the browser store, where row-level security fills in tenant_id, and by the signup
// seed on the server, which passes tenantId explicitly because it runs with the service role.

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come back untyped from PostgREST */
type Row = Record<string, any>;
type SB = SupabaseClient;

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

/** Set when the phase 3 migration (0003_supply.sql) has been run, so its columns can be written;
 * services once 0012 has added food types, sessions and end times; packageExtras once 0013 has added
 * package additions and archiving; referrals once 0014 has added referral codes, raw material changes and
 * per-quotation dish prices; subcategories once 0015 has added parent categories; contacts once 0016 has
 * added the client's second phone and the coordinator. */
export const schema = { coordinator: false, supply: false, services: false, packageExtras: false, referrals: false, subcategories: false, contacts: false, charges: false, mainRate: false, subEvents: false };

export async function probeSupply(sb: SB) {
  schema.supply = !(await sb.from("ingredients").select("id").limit(1)).error;
  return schema.supply;
}

const tenanted = <T extends Row>(row: T, tenantId?: string) => (tenantId ? { ...row, tenant_id: tenantId } : row);
const day = (value: string | null | undefined) => (value ? String(value).slice(0, 10) : "");

/* ---------- row mappers ---------- */

export const defaultDocs: DocSettings = { theme: "classic", footer: "", showBank: true, showUpiQr: true };

export function tenantRow(t: Tenant): Row {
  return {
    name: t.name,
    tagline: t.tagline,
    city: t.city,
    phone: t.phone,
    email: t.email,
    address: t.address,
    logo_path: t.logo ?? null,
    brand_color: t.brandColor,
    gstin: t.gstin,
    bank_name: t.bankName,
    bank_account: t.bankAccount,
    ifsc: t.ifsc,
    upi_id: t.upiId,
    quote_prefix: t.quotePrefix,
    order_prefix: t.orderPrefix,
    invoice_prefix: t.invoicePrefix,
    terms: t.terms,
    gst_rate: t.gstRate,
    gst_inclusive: t.gstInclusive,
    discount_approval_pct: t.discountApprovalPct,
    daily_capacity_pax: t.dailyCapacityPax,
    pax_slabs: t.slabs,
    // Only sent once the 0008 columns exist, so older databases keep saving settings.
    ...(t.access ? { role_access: t.access } : {}),
    ...(schema.services && t.foodTypes ? { food_types: t.foodTypes } : {}),
    ...(schema.referrals && t.referral ? { referral_settings: t.referral } : {}),
    ...(schema.charges && t.staffRates ? { staff_rates: t.staffRates } : {}),
    ...(t.docs ? { doc_settings: t.docs, public_slug: t.publicSlug || null, public_menu: !!t.publicMenu, public_prices: !!t.publicPrices } : {}),
  };
}

function tenantFrom(r: Row): Tenant {
  return {
    name: r.name,
    tagline: r.tagline,
    city: r.city,
    phone: r.phone,
    email: r.email,
    address: r.address,
    logo: r.logo_path ?? undefined,
    brandColor: r.brand_color,
    gstin: r.gstin,
    bankName: r.bank_name,
    bankAccount: r.bank_account,
    ifsc: r.ifsc,
    upiId: r.upi_id,
    quotePrefix: r.quote_prefix,
    orderPrefix: r.order_prefix,
    invoicePrefix: r.invoice_prefix,
    terms: r.terms,
    gstRate: Number(r.gst_rate),
    gstInclusive: r.gst_inclusive,
    discountApprovalPct: Number(r.discount_approval_pct),
    dailyCapacityPax: r.daily_capacity_pax,
    slabs: Array.isArray(r.pax_slabs) && r.pax_slabs.length ? r.pax_slabs : [{ pct: 0 }],
    ...("plan_id" in r ? { subscription: { status: r.status, planId: r.plan_id ?? undefined, trialEndsAt: r.trial_ends_at ?? undefined, paidUntil: r.paid_until ?? undefined, cycle: r.billing_cycle, addons: r.addons ?? [], extraUsers: r.extra_users ?? 0 } } : {}),
    ...("role_access" in r ? { access: { roles: {}, poLimit: 0, payoutLimit: 0, ...r.role_access } } : {}),
    ...(r.food_types ? { foodTypes: r.food_types } : {}),
    ...(r.referral_settings ? { referral: r.referral_settings } : {}),
    ...(Array.isArray(r.staff_rates) ? { staffRates: r.staff_rates } : {}),
    ...("doc_settings" in r ? { docs: { ...defaultDocs, ...r.doc_settings }, publicSlug: r.public_slug ?? "", publicMenu: r.public_menu, publicPrices: r.public_prices } : {}),
  };
}

/** True once 0009 has added the birthday and anniversary columns; until then they are not sent. */
let clientDates = false;

export const clientRow = (c: Client): Row => ({
  id: c.id,
  name: c.name,
  phone: c.phone,
  email: c.email ?? null,
  address: c.address ?? null,
  gstin: c.gstin ?? null,
  client_type: c.type,
  tags: c.tags,
  language: c.language,
  ...(clientDates ? { birthday: c.birthday || null, anniversary: c.anniversary || null } : {}),
  ...(schema.contacts ? { alt_phone: c.altPhone || null } : {}),
});

export const categoryRow = (c: MenuCategory, sort: number): Row => ({ id: c.id, name: c.name, icon: c.icon, sort_order: sort, ...(schema.subcategories ? { parent_id: c.parentId ?? null } : {}), ...(schema.mainRate ? { priced_at_booking: !!c.atBooking } : {}) });

export const itemRow = (i: MenuItem): Row => ({
  id: i.id,
  category_id: i.categoryId,
  name: i.name,
  name_local: i.nameLocal,
  diet: i.diet,
  cuisine: i.cuisine,
  spice: i.spice,
  unit: i.unit,
  pricing_type: i.pricingType,
  cost: i.cost,
  price: i.price,
  photo_paths: i.photo ? [i.photo] : [],
  description: i.description,
  active: i.active,
  outsourced: i.outsourced,
  seasonal: i.seasonal,
  bestseller: i.bestseller,
  ...(schema.supply ? { recipe_base: i.recipeBase, buffer_pct: i.bufferPct, agency_id: i.agencyId ?? null, agency_rate: i.agencyRate } : {}),
});

export const packageRow = (p: MenuPackage): Row => ({
  id: p.id,
  name: p.name,
  tier: p.tier,
  price_per_plate: p.pricePerPlate,
  min_pax: p.minPax,
  description: p.description,
  fixed_item_ids: p.fixedItemIds,
  ...(schema.services ? { food_type_id: p.foodTypeId ?? null } : {}),
  ...(schema.packageExtras ? { additions: p.additions ?? [], archived: !!p.archived } : {}),
});

export const enquiryRow = (e: Enquiry): Row => ({
  id: e.id,
  client_id: e.clientId,
  event_type: e.eventType,
  event_date: e.date,
  venue: e.venue,
  pax: e.pax,
  budget_per_plate: e.budgetPerPlate,
  food_pref: e.foodPref,
  notes: e.notes,
  source: e.source,
  stage: e.stage,
  assigned_to: e.assignedTo || null,
  follow_up_at: e.followUpAt || null,
  lost_reason: e.lostReason ?? null,
  ...(schema.contacts ? { coordinator_id: e.coordinatorId || null } : {}),
  ...(schema.coordinator ? { coordinator: e.coordinator ?? null } : {}),
  ...(schema.services ? { event_end_date: e.endDate && e.endDate > e.date ? e.endDate : null, services: e.services ?? [] } : {}),
});

const quotationRow = (q: Quotation): Row => ({
  id: q.id,
  number: q.number,
  group_id: q.groupId,
  version: q.version,
  client_id: q.clientId,
  enquiry_id: q.enquiryId ?? null,
  event_type: q.eventType,
  discount_type: q.discount.type,
  discount_value: q.discount.value,
  gst_rate: q.gstRate,
  gst_inclusive: q.gstInclusive,
  status: q.status,
  valid_until: q.validUntil || null,
  notes: q.notes,
  created_by: q.createdBy || null,
  ...(schema.referrals ? { referral_code: q.referralCode || null, credit_used: q.creditUsed ?? 0 } : {}),
  ...(schema.contacts ? { coordinator_id: q.coordinatorId || null } : {}),
  ...(schema.coordinator ? { coordinator: q.coordinator ?? null } : {}),
});

const orderRow = (o: Order): Row => ({
  id: o.id,
  number: o.number,
  quotation_id: o.quotationId ?? null,
  client_id: o.clientId,
  event_type: o.eventType,
  discount_type: o.discount.type,
  discount_value: o.discount.value,
  gst_rate: o.gstRate,
  gst_inclusive: o.gstInclusive,
  status: o.status,
  instructions: o.instructions,
  manager_id: o.managerId || null,
  cancel_note: o.cancelNote ?? null,
  ...(schema.supply ? { commission_pct: o.commissionPct } : {}),
  ...(schema.referrals ? { referral_code: o.referralCode || null, credit_used: o.creditUsed ?? 0, referral_rewarded: !!o.referralRewarded, raw_overrides: o.rawOverrides ?? {} } : {}),
  ...(schema.contacts ? { coordinator_id: o.coordinatorId || null } : {}),
  ...(schema.coordinator ? { coordinator: o.coordinator ?? null } : {}),
});

export const paymentRow = (p: Payment, orderId: string, recordedBy?: string): Row => ({
  id: p.id,
  order_id: orderId,
  receipt_no: p.receiptNo,
  amount: p.amount,
  mode: p.mode,
  paid_on: p.date,
  note: p.note ?? null,
  recorded_by: recordedBy ?? null,
});

/* ---------- writes ---------- */

async function insertFunctions(sb: SB, parent: { quotation_id?: string; order_id?: string }, functions: EventFunction[], tenantId?: string) {
  if (!functions.length) return;
  check(
    await sb.from("event_functions").insert(
      functions.map((f, i) =>
        tenanted({ id: f.id, ...parent, name: f.name, event_date: f.date, serving_time: f.time || "19:00", venue: f.venue, pax: f.pax, package_id: f.packageId ?? null, sort_order: i, ...(schema.services ? { food_type_id: f.foodTypeId ?? null, session: f.session ?? null, end_time: f.endTime || null } : {}), ...(schema.charges ? { charges: f.charges ?? [] } : {}), ...(schema.mainRate ? { main_rate: f.mainRate ?? null } : {}) }, tenantId),
      ),
    ),
    "Saving functions",
  );
  const items = functions.flatMap((f) =>
    [...new Set(f.itemIds)].map((itemId, i) => tenanted({ function_id: f.id, item_id: itemId, note: f.itemNotes?.[itemId] ?? "", sort_order: i, ...(schema.referrals ? { price_override: f.itemPrices?.[itemId] ?? null } : {}) }, tenantId)),
  );
  if (items.length) check(await sb.from("function_items").insert(items), "Saving the menu");
}

async function insertExtras(sb: SB, parent: { quotation_id?: string; order_id?: string }, extras: ExtraCharge[], tenantId?: string) {
  if (!extras.length) return;
  check(await sb.from("extra_charges").insert(extras.map((e) => tenanted({ id: e.id, ...parent, label: e.label, amount: e.amount }, tenantId))), "Saving extra charges");
}

export async function insertQuotation(sb: SB, q: Quotation, tenantId?: string) {
  check(await sb.from("quotations").insert(tenanted(withBranch(quotationRow(q)), tenantId)), "Saving the quotation");
  await insertFunctions(sb, { quotation_id: q.id }, q.functions, tenantId);
  await insertExtras(sb, { quotation_id: q.id }, q.extras, tenantId);
}

export async function insertOrder(sb: SB, o: Order, tenantId?: string, userId?: string) {
  check(await sb.from("orders").insert(tenanted(withBranch(orderRow(o)), tenantId)), "Saving the order");
  await insertFunctions(sb, { order_id: o.id }, o.functions, tenantId);
  await insertExtras(sb, { order_id: o.id }, o.extras, tenantId);
  if (o.payments.length) check(await sb.from("payments").insert(o.payments.map((p) => tenanted(paymentRow(p, o.id, userId), tenantId))), "Saving payments");
  if (o.changeLog.length)
    check(
      await sb.from("order_changes").insert(o.changeLog.map((c) => tenanted({ id: c.id, order_id: o.id, description: c.text, price_impact: c.priceImpact, changed_by: userId ?? null, created_at: c.at }, tenantId))),
      "Saving the change log",
    );
}

export async function savePackageRows(sb: SB, p: MenuPackage, tenantId?: string) {
  check(await sb.from("packages").upsert(tenanted(packageRow(p), tenantId)), "Saving the package");
  check(await sb.from("package_rules").delete().eq("package_id", p.id), "Saving package rules");
  if (p.rules.length) check(await sb.from("package_rules").insert(p.rules.map((r) => tenanted({ package_id: p.id, category_id: r.categoryId, choose: r.choose }, tenantId))), "Saving package rules");
}

export async function run(query: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string) {
  check(await query, what);
}

/* ---------- read everything for the signed-in user's tenant ---------- */

export interface Loaded {
  tenantId: string;
  setupDone: boolean;
  tenant: Tenant;
  me: { id: string; role: Role };
  users: TeamUser[];
  clients: Client[];
  categories: MenuCategory[];
  items: MenuItem[];
  packages: MenuPackage[];
  enquiries: Enquiry[];
  quotations: Quotation[];
  orders: Order[];
  branches: { id: string; name: string; address: string }[];
  /** False until 0011 has added branch columns */
  branchesEnabled: boolean;
  /** False until 0012 has added food types, sessions and end times */
  servicesReady: boolean;
  /** False until 0013 has added package additions and archiving */
  packageExtrasReady: boolean;
  /** False until 0014 has added referrals, raw material changes and dish prices */
  referralsReady: boolean;
  chargesReady: boolean;
  /** False until 0015 has added sub-categories */
  subcategoriesReady: boolean;
  /** False until 0016 has added the client's second phone and the coordinator */
  contactsReady: boolean;
  /** The account's own event types, in order; empty means the standard list */
  eventTypes: { id: string; name: string; subEvents?: string[] }[];
  /** False until 0017 has added event types */
  eventTypesReady: boolean;
  /** False until 0023 has added sub-events to event types */
  subEventsReady: boolean;
  samplePhotos: SamplePhoto[];
  /** False until 0021 has added sample photos */
  samplePhotosReady: boolean;
  /** False until 0022 has added main course priced at booking */
  mainRateReady: boolean;
  /** The branch this person is tied to, if the owner assigned one */
  myBranch: string;
}

export async function loadAll(sb: SB, userId: string, preferredBranch = ""): Promise<Loaded | null> {
  await probeSupply(sb);
  const profile = (await sb.from("profiles").select("*").eq("id", userId).maybeSingle()).data as Row | null;
  if (!profile) return null;

  const all = (table: string, order?: string, ascending = true) => {
    const q = sb.from(table).select("*");
    return (order ? q.order(order, { ascending }) : q).range(0, 9999);
  };
  const [branchProbe, branchRows, extrasProbe] = await Promise.all([sb.from("orders").select("branch_id").limit(1), all("branches", "created_at"), sb.from("packages").select("additions").limit(1)]);
  schema.packageExtras = !extrasProbe.error;
  schema.subcategories = !(await sb.from("menu_categories").select("parent_id").limit(1)).error;
  schema.mainRate = !(await sb.from("menu_categories").select("priced_at_booking").limit(1)).error;
  // Asked of the database, not read off a loaded client, so an account with no clients yet still saves them.
  clientDates = !(await sb.from("clients").select("birthday").limit(1)).error;
  schema.contacts = !(await sb.from("enquiries").select("coordinator_id").limit(1)).error;
  schema.coordinator = !(await sb.from("enquiries").select("coordinator").limit(1)).error;
  const eventRows = await sb.from("event_types").select("*").order("sort_order").order("created_at");
  schema.subEvents = !eventRows.error && !(await sb.from("event_types").select("sub_events").limit(1)).error;
  const photoRows = await sb.from("sample_photos").select("id,kind,name,photo_url,note").order("kind").order("sort_order").order("created_at");
  const branchesEnabled = !branchProbe.error;
  const branchList = ((branchRows.data ?? []) as Row[]).map((b) => ({ id: b.id as string, name: b.name as string, address: b.address as string }));
  const myBranch = (profile.branch_id as string | null) ?? "";
  // Someone tied to a branch always sees that branch; everyone else sees the one they picked, if it still exists.
  setBranchContext(branchesEnabled, myBranch || (branchList.some((b) => b.id === preferredBranch) ? preferredBranch : ""));
  const [tenant, profiles, invites, clients, categories, items, packages, rules, enquiries, quotations, orders, functions, fnItems, extras, payments, changes] = await Promise.all([
    sb.from("tenants").select("*").eq("id", profile.tenant_id).single(),
    all("profiles", "created_at"),
    all("team_invites", "created_at"),
    all("clients", "created_at"),
    all("menu_categories", "sort_order"),
    all("menu_items", "created_at"),
    all("packages", "price_per_plate"),
    all("package_rules"),
    all("enquiries", "created_at", false),
    all("quotations", "created_at", false),
    all("orders", "created_at", false),
    all("event_functions", "sort_order"),
    all("function_items", "sort_order"),
    all("extra_charges"),
    all("payments", "created_at"),
    all("order_changes", "created_at", false),
  ]);
  const t = check(tenant, "Loading the account") as Row;
  schema.services = "food_types" in t;
  schema.referrals = "referral_settings" in t;
  schema.charges = "staff_rates" in t;
  const rowsOf = (res: { data: unknown; error: { message: string } | null }, what: string) => (check(res, what) ?? []) as Row[];
  const profileRows = rowsOf(profiles, "Loading the team");
  const nameOf = (id: string | null) => profileRows.find((p) => p.id === id)?.name ?? "";

  const itemsByFn = new Map<string, Row[]>();
  for (const r of rowsOf(fnItems, "Loading menus")) itemsByFn.set(r.function_id, [...(itemsByFn.get(r.function_id) ?? []), r]);
  const fnRows = rowsOf(functions, "Loading functions");
  const functionsOf = (key: "quotation_id" | "order_id", id: string): EventFunction[] =>
    fnRows
      .filter((f) => f[key] === id)
      .map((f) => {
        const picked = itemsByFn.get(f.id) ?? [];
        const notes = Object.fromEntries(picked.filter((p) => p.note).map((p) => [p.item_id, p.note]));
        const prices = Object.fromEntries(picked.filter((p) => p.price_override !== null && p.price_override !== undefined).map((p) => [p.item_id, Number(p.price_override)]));
        return { id: f.id, name: f.name, date: day(f.event_date), time: String(f.serving_time).slice(0, 5), endTime: f.end_time ? String(f.end_time).slice(0, 5) : undefined, session: f.session ?? undefined, foodTypeId: f.food_type_id ?? undefined, venue: f.venue, pax: f.pax, packageId: f.package_id ?? undefined, itemIds: picked.map((p) => p.item_id), itemNotes: Object.keys(notes).length ? notes : undefined, itemPrices: Object.keys(prices).length ? prices : undefined, charges: Array.isArray(f.charges) && f.charges.length ? f.charges : undefined, mainRate: f.main_rate === null || f.main_rate === undefined ? undefined : Number(f.main_rate) };
      });
  const extraRows = rowsOf(extras, "Loading extra charges");
  const extrasOf = (key: "quotation_id" | "order_id", id: string): ExtraCharge[] => extraRows.filter((e) => e[key] === id).map((e) => ({ id: e.id, label: e.label, amount: Number(e.amount) }));
  const paymentRows = rowsOf(payments, "Loading payments");
  const changeRows = rowsOf(changes, "Loading the change log");
  const ruleRows = rowsOf(rules, "Loading package rules");

  return {
    tenantId: t.id,
    setupDone: t.setup_done,
    tenant: tenantFrom(t),
    me: { id: profile.id, role: profile.role },
    users: [
      ...profileRows.map((p) => ({ id: p.id, name: p.name, phone: p.phone, role: p.role as Role })),
      ...rowsOf(invites, "Loading invites").filter((i) => !i.accepted_at).map((i) => ({ id: i.id, name: i.name, phone: i.phone, role: i.role as Role, invited: true })),
    ],
    clients: rowsOf(clients, "Loading clients").map((c) => {
      return { id: c.id, name: c.name, phone: c.phone, email: c.email ?? undefined, address: c.address ?? undefined, gstin: c.gstin ?? undefined, type: c.client_type, tags: c.tags ?? [], language: c.language, birthday: c.birthday ? String(c.birthday).slice(0, 10) : undefined, anniversary: c.anniversary ? String(c.anniversary).slice(0, 10) : undefined, referralCode: c.referral_code ?? undefined, referredBy: c.referred_by ?? undefined, credit: Number(c.credit ?? 0), altPhone: c.alt_phone ?? undefined };
    }),
    categories: rowsOf(categories, "Loading categories").map((c) => ({ id: c.id, name: c.name, icon: c.icon, parentId: c.parent_id ?? undefined, atBooking: c.priced_at_booking ? true : undefined })),
    items: rowsOf(items, "Loading the menu").map((i) => ({
      id: i.id,
      name: i.name,
      nameLocal: i.name_local,
      categoryId: i.category_id,
      diet: i.diet,
      cuisine: i.cuisine,
      spice: i.spice,
      unit: i.unit,
      pricingType: i.pricing_type,
      cost: Number(i.cost),
      price: Number(i.price),
      photo: i.photo_paths?.[0] ?? undefined,
      description: i.description,
      active: i.active,
      outsourced: i.outsourced,
      seasonal: i.seasonal,
      bestseller: i.bestseller,
      recipeBase: i.recipe_base ?? 100,
      bufferPct: Number(i.buffer_pct ?? 5),
      agencyId: i.agency_id ?? undefined,
      agencyRate: Number(i.agency_rate ?? 0),
    })),
    packages: rowsOf(packages, "Loading packages").map((p) => ({
      id: p.id,
      name: p.name,
      tier: p.tier,
      pricePerPlate: Number(p.price_per_plate),
      minPax: p.min_pax,
      description: p.description,
      fixedItemIds: p.fixed_item_ids ?? [],
      rules: ruleRows.filter((r) => r.package_id === p.id).map((r) => ({ categoryId: r.category_id, choose: r.choose })),
      foodTypeId: p.food_type_id ?? undefined,
      additions: Array.isArray(p.additions) ? p.additions : [],
      archived: !!p.archived,
    })),
    enquiries: rowsOf(enquiries, "Loading enquiries").filter(inBranch).map((e) => ({
      id: e.id,
      clientId: e.client_id,
      eventType: e.event_type,
      date: day(e.event_date),
      venue: e.venue,
      pax: e.pax,
      budgetPerPlate: Number(e.budget_per_plate),
      foodPref: e.food_pref,
      notes: e.notes,
      source: e.source,
      stage: e.stage,
      assignedTo: e.assigned_to ?? "",
      followUpAt: e.follow_up_at ? day(e.follow_up_at) : undefined,
      lostReason: e.lost_reason ?? undefined,
      createdAt: localDay(e.created_at),
      endDate: e.event_end_date ? day(e.event_end_date) : undefined,
      services: Array.isArray(e.services) && e.services.length ? e.services : undefined,
      coordinatorId: e.coordinator_id ?? undefined,
      coordinator: e.coordinator ?? undefined,
    })),
    quotations: rowsOf(quotations, "Loading quotations").filter(inBranch).map((q) => ({
      id: q.id,
      number: q.number,
      groupId: q.group_id,
      version: q.version,
      clientId: q.client_id,
      enquiryId: q.enquiry_id ?? undefined,
      eventType: q.event_type,
      functions: functionsOf("quotation_id", q.id),
      extras: extrasOf("quotation_id", q.id),
      discount: { type: q.discount_type, value: Number(q.discount_value) },
      gstRate: Number(q.gst_rate),
      gstInclusive: q.gst_inclusive,
      status: q.status,
      validUntil: day(q.valid_until),
      notes: q.notes,
      createdBy: q.created_by ?? "",
      createdAt: localDay(q.created_at),
      referralCode: q.referral_code ?? undefined,
      creditUsed: Number(q.credit_used ?? 0),
      coordinatorId: q.coordinator_id ?? undefined,
      coordinator: q.coordinator ?? undefined,
    })),
    orders: rowsOf(orders, "Loading orders").filter(inBranch).map((o) => ({
      id: o.id,
      number: o.number,
      quotationId: o.quotation_id ?? undefined,
      clientId: o.client_id,
      eventType: o.event_type,
      functions: functionsOf("order_id", o.id),
      extras: extrasOf("order_id", o.id),
      discount: { type: o.discount_type, value: Number(o.discount_value) },
      gstRate: Number(o.gst_rate),
      gstInclusive: o.gst_inclusive,
      status: o.status,
      payments: paymentRows.filter((p) => p.order_id === o.id).map((p) => ({ id: p.id, amount: Number(p.amount), mode: p.mode, date: day(p.paid_on), note: p.note ?? undefined, receiptNo: p.receipt_no })),
      changeLog: changeRows.filter((c) => c.order_id === o.id).map((c) => ({ id: c.id, at: day(c.created_at), by: nameOf(c.changed_by), text: c.description, priceImpact: Number(c.price_impact) })),
      instructions: o.instructions,
      managerId: o.manager_id ?? "",
      commissionPct: Number(o.commission_pct ?? 0),
      cancelNote: o.cancel_note ?? undefined,
      createdAt: localDay(o.created_at),
      referralCode: o.referral_code ?? undefined,
      creditUsed: Number(o.credit_used ?? 0),
      referralRewarded: !!o.referral_rewarded,
      rawOverrides: o.raw_overrides && Object.keys(o.raw_overrides).length ? o.raw_overrides : undefined,
      coordinatorId: o.coordinator_id ?? undefined,
      coordinator: o.coordinator ?? undefined,
    })),
    branches: branchList,
    branchesEnabled,
    myBranch,
    servicesReady: schema.services,
    packageExtrasReady: schema.packageExtras,
    referralsReady: schema.referrals,
    chargesReady: schema.charges,
    subcategoriesReady: schema.subcategories,
    contactsReady: schema.contacts,
    eventTypes: eventRows.error ? [] : ((eventRows.data ?? []) as Row[]).map((e) => ({ id: e.id as string, name: e.name as string, subEvents: Array.isArray(e.sub_events) && e.sub_events.length ? (e.sub_events as string[]) : undefined })),
    eventTypesReady: !eventRows.error,
    subEventsReady: schema.subEvents,
    samplePhotos: photoRows.error ? [] : ((photoRows.data ?? []) as Row[]).map((p) => ({ id: p.id as string, kind: p.kind as SamplePhoto["kind"], name: p.name as string, photoUrl: p.photo_url as string, note: (p.note as string) ?? "" })),
    samplePhotosReady: !photoRows.error,
    mainRateReady: schema.mainRate,
  };
}

/** Public URL for a stored photo or logo. Paths that are already URLs (starter photos) pass through. */
export function mediaUrl(path?: string) {
  if (!path) return undefined;
  if (/^(\/|https?:|data:|blob:)/.test(path)) return path;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${path}`;
}
