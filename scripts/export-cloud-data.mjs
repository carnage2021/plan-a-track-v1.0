import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";

const out = process.argv[2];
if (!out) throw new Error("Usage: node scripts/export-cloud-data.mjs <output-directory>");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Cloud export credentials are missing.");
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const tables = [
  "activity_log","admin_audit","announcements","assets","branches","challan_lines","challans","changelog","clients","credit_notes","enquiries","estimates","event_functions","event_types","expenses","extra_charges","function_items","imports","ingredients","invoices","kitchen_items","label_scans","menu_categories","menu_items","message_templates","messages","number_series","onsite","onsite_issues","order_changes","orders","outsource_lines","outsource_orders","package_rules","packages","payment_milestones","payments","petty_cash","plans","platform_admins","po_lines","profiles","purchase_orders","quotations","recipe_book","recipe_lines","salary_slips","sample_photos","stock_labels","stock_movements","stores","subscription_invoices","support_tickets","tasks","team_invites","tenants","trips","vehicles","vendor_bills","vendor_items","vendor_payments","vendor_rates","vendors","worker_leaves","worker_payments","workers",
];
const cloudMedia = `${url}/storage/v1/object/public/media/`;
const localize = (value) => {
  if (typeof value === "string") return value.startsWith(cloudMedia) ? value.slice(cloudMedia.length) : value;
  if (Array.isArray(value)) return value.map(localize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, localize(v)]));
  return value;
};

await mkdir(path.join(out, "tables"), { recursive: true });
const summary = {};
for (const table of tables) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.from(table).select("*").range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data.map(localize));
    if (data.length < 1000) break;
  }
  summary[table] = rows.length;
  await writeFile(path.join(out, "tables", `${table}.json`), JSON.stringify(rows));
}

const users = [];
for (let page = 1; ; page++) {
  const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw new Error(`auth users: ${error.message}`);
  for (const user of data.users) users.push({
    id: user.id,
    email: user.email ?? "",
    raw_user_meta_data: user.user_metadata ?? {},
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at,
    temporary_password: randomBytes(12).toString("base64url"),
  });
  if (data.users.length < 1000) break;
}
await writeFile(path.join(out, "users.json"), JSON.stringify(users));

async function files(folder = "") {
  const found = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.storage.from("media").list(folder, { limit: 1000, offset });
    if (error) throw new Error(`storage ${folder}: ${error.message}`);
    for (const entry of data) {
      const name = folder ? `${folder}/${entry.name}` : entry.name;
      if (entry.id) found.push(name);
      else found.push(...await files(name));
    }
    if (data.length < 1000) break;
  }
  return found;
}

const storage = await files();
for (const name of storage) {
  const { data, error } = await client.storage.from("media").download(name);
  if (error) throw new Error(`download ${name}: ${error.message}`);
  const target = path.join(out, "storage", "media", ...name.split("/"));
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await data.arrayBuffer()));
}
await writeFile(path.join(out, "summary.json"), JSON.stringify({ tables: summary, users: users.length, files: storage.length }, null, 2));
console.log(JSON.stringify({ tables: Object.keys(summary).length, rows: Object.values(summary).reduce((a, b) => a + b, 0), users: users.length, files: storage.length }));
