import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

/*
 * Clears a business's records so it can start fresh: clients, enquiries, quotations, orders, payments, invoices,
 * the menu, stock, vendors, staff and the rest. The account itself stays: the business settings, the team and
 * their logins, branches, stores, event types, message templates and document numbering.
 * Only the owner may call it, and only ever for their own business (every delete is filtered by tenant_id).
 */

const tables = [
  "label_scans", "stock_labels", "imports", "messages",
  "onsite_issues", "onsite", "trips", "vehicles", "kitchen_items",
  "salary_slips", "worker_payments", "tasks", "worker_leaves", "workers",
  "challan_lines", "challans", "assets",
  "outsource_lines", "outsource_orders", "vendor_payments", "vendor_bills", "po_lines", "purchase_orders", "vendor_rates",
  "stock_movements", "recipe_lines",
  "credit_notes", "invoices", "payment_milestones", "payments", "order_changes", "extra_charges", "function_items", "event_functions",
  "orders", "quotations", "enquiries", "clients",
  "expenses", "petty_cash",
  "package_rules", "packages", "menu_items", "menu_categories", "ingredients", "vendors",
];

export async function POST(request: Request) {
  const sb = adminClient();
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const { data } = token ? await sb.auth.getUser(token) : { data: { user: null } };
  const profile = data.user ? (await sb.from("profiles").select("tenant_id, role").eq("id", data.user.id).maybeSingle()).data : null;
  if (profile?.role !== "owner") return NextResponse.json({ error: "Only the owner can delete the business's data." }, { status: 403 });
  const tenantId = profile.tenant_id as string;

  // Children go before parents; anything still held by a link is tried again on the next pass.
  let pending = [...tables];
  const cleared: string[] = [], notSetUp: string[] = [];
  let failed: { table: string; error: string }[] = [];
  for (let pass = 0; pass < 5 && pending.length; pass++) {
    const next: string[] = [];
    failed = [];
    for (const t of pending) {
      const { error } = await sb.from(t).delete().eq("tenant_id", tenantId);
      if (!error) cleared.push(t);
      else if (error.code === "42P01" || error.code === "PGRST205") notSetUp.push(t);
      else { next.push(t); failed.push({ table: t, error: error.message }); }
    }
    pending = next;
  }
  // Recorded in the activity log, so the team can see when and by whom the data was cleared.
  await sb.from("activity_log").insert({ tenant_id: tenantId, table_name: "account", action: "delete", summary: "Deleted all business data", actor: data.user!.id }).then(() => undefined, () => undefined);
  if (failed.length) return NextResponse.json({ error: `Some records could not be deleted: ${failed.map((f) => f.table).join(", ")}`, cleared, failed }, { status: 500 });
  return NextResponse.json({ cleared, notSetUp });
}
