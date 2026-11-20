import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import bcrypt from "bcryptjs";

const source = process.argv[2];
if (!source) throw new Error("Usage: node scripts/import-local-data.mjs <export-directory>");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const client = await pool.connect();
const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
try {
  await client.query("begin");
  await client.query("set local session_replication_role = replica");
  const users = JSON.parse(await readFile(path.join(source, "users.json"), "utf8"));
  for (const user of users) {
    await client.query(
      "insert into auth.users(id,email,encrypted_password,raw_user_meta_data,email_confirmed_at,created_at,updated_at,last_sign_in_at) values($1,$2,$3,$4,now(),$5,now(),$6) on conflict(id) do update set email=excluded.email,encrypted_password=excluded.encrypted_password,raw_user_meta_data=excluded.raw_user_meta_data,last_sign_in_at=excluded.last_sign_in_at",
      [user.id, user.email, await bcrypt.hash(user.temporary_password, 12), JSON.stringify(user.raw_user_meta_data ?? {}), user.created_at, user.last_sign_in_at],
    );
  }
  const passwordReport = users.map(({ id, email, temporary_password }) => ({ id, email, temporary_password }));
  await writeFile(path.join(source, "user-passwords.json"), JSON.stringify(passwordReport, null, 2), { mode: 0o600 });

  const files = (await readdir(path.join(source, "tables"))).filter((name) => name.endsWith(".json")).sort();
  let total = 0;
  for (const file of files) {
    const table = file.slice(0, -5);
    const rows = JSON.parse(await readFile(path.join(source, "tables", file), "utf8"));
    if (!rows.length) continue;
    const metaResult = await client.query("select column_name,data_type from information_schema.columns where table_schema='public' and table_name=$1", [table]);
    const meta = new Map(metaResult.rows.map((row) => [row.column_name, row.data_type]));
    for (const row of rows) {
      const columns = Object.keys(row).filter((column) => meta.has(column));
      if (!columns.length) continue;
      const values = columns.map((column) => (meta.get(column) === "json" || meta.get(column) === "jsonb") && row[column] !== null ? JSON.stringify(row[column]) : row[column]);
      const slots = values.map((_, index) => `$${index + 1}`).join(",");
      await client.query(`insert into public.${quote(table)} (${columns.map(quote).join(",")}) overriding system value values (${slots}) on conflict do nothing`, values);
      total++;
    }
  }
  await client.query("commit");
  console.log(JSON.stringify({ users: users.length, rows: total }));
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
