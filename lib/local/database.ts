/* eslint-disable @typescript-eslint/no-explicit-any -- SQL rows are dynamic by table */
import "server-only";
import { Pool, types, type PoolClient } from "pg";
import type { QueryFilter, QueryRequest, QueryResult } from "./protocol";

types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(1700, (value) => Number(value));

const connectionString = process.env.DATABASE_URL;
const adminConnectionString = process.env.DATABASE_ADMIN_URL ?? connectionString;
if (!connectionString) throw new Error("DATABASE_URL is required.");

export const appPool = new Pool({ connectionString, max: 6, idleTimeoutMillis: 30_000 });
export const adminPool = new Pool({ connectionString: adminConnectionString, max: 3, idleTimeoutMillis: 30_000 });

const identifiers = /^[a-z_][a-z0-9_]*$/;
const ident = (value: string) => {
  if (!identifiers.test(value)) throw new Error(`Invalid database identifier: ${value}`);
  return `"${value}"`;
};

const tableMeta = new Map<string, Map<string, string>>();
const primaryKeys = new Map<string, string[]>();

async function columnsFor(client: PoolClient, table: string) {
  if (tableMeta.has(table)) return tableMeta.get(table)!;
  const result = await client.query<{ column_name: string; data_type: string }>(
    "select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = $1",
    [table],
  );
  if (!result.rows.length) throw new Error(`Unknown table: ${table}`);
  const value = new Map(result.rows.map((row) => [row.column_name, row.data_type]));
  tableMeta.set(table, value);
  return value;
}

async function keysFor(client: PoolClient, table: string) {
  if (primaryKeys.has(table)) return primaryKeys.get(table)!;
  const result = await client.query<{ column_name: string }>(
    `select a.attname as column_name
       from pg_index i
       join pg_class c on c.oid = i.indrelid
       join pg_namespace n on n.oid = c.relnamespace
       join unnest(i.indkey) with ordinality as k(attnum, ord) on true
       join pg_attribute a on a.attrelid = c.oid and a.attnum = k.attnum
      where n.nspname = 'public' and c.relname = $1 and i.indisprimary
      order by k.ord`,
    [table],
  );
  const value = result.rows.map((row) => row.column_name);
  primaryKeys.set(table, value);
  return value;
}

function selected(columns = "*") {
  if (columns.trim() === "*") return "*";
  return columns.split(",").map((column) => ident(column.trim())).join(", ");
}

function where(filters: QueryFilter[] = [], params: unknown[] = []) {
  const clauses = filters.map((filter) => {
    const column = ident(filter.column);
    if (filter.op === "is" || filter.op === "not_is") {
      const not = filter.op === "not_is" ? " not" : "";
      if (filter.value === null) return `${column} is${not} null`;
      if (typeof filter.value === "boolean") return `${column} is${not} ${filter.value ? "true" : "false"}`;
    }
    if (filter.op === "in") {
      const values = Array.isArray(filter.value) ? filter.value : [];
      if (!values.length) return "false";
      const slots = values.map((value) => { params.push(value); return `$${params.length}`; });
      return `${column} in (${slots.join(", ")})`;
    }
    params.push(filter.value);
    const op = filter.op === "neq" ? "<>" : filter.op === "gte" ? ">=" : filter.op === "lte" ? "<=" : filter.op === "gt" ? ">" : filter.op === "lt" ? "<" : "=";
    return `${column} ${op} $${params.length}`;
  });
  return clauses.length ? ` where ${clauses.join(" and ")}` : "";
}

function oneResult(request: QueryRequest, rows: any[], count?: number | null): QueryResult<any> {
  if (request.one === "single") {
    if (rows.length !== 1) return { data: null, error: { message: `Expected one row, found ${rows.length}.`, code: "PGRST116" }, count };
    return { data: rows[0], error: null, count };
  }
  if (request.one === "maybeSingle") {
    if (rows.length > 1) return { data: null, error: { message: `Expected at most one row, found ${rows.length}.`, code: "PGRST116" }, count };
    return { data: rows[0] ?? null, error: null, count };
  }
  return { data: request.head ? null : rows, error: null, count };
}

async function normalizeRows(client: PoolClient, table: string, values: unknown) {
  const rows = (Array.isArray(values) ? values : [values]).filter((row): row is Record<string, unknown> => !!row && typeof row === "object");
  const meta = await columnsFor(client, table);
  return rows.map((row) => Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined).map(([column, value]) => {
    if (!meta.has(column)) throw new Error(`Unknown column ${table}.${column}`);
    return [column, (meta.get(column) === "json" || meta.get(column) === "jsonb") && value !== null ? JSON.stringify(value) : value];
  })));
}

async function runTable(client: PoolClient, request: QueryRequest): Promise<QueryResult<any>> {
  const tableName = request.table ?? "";
  await columnsFor(client, tableName);
  const table = `public.${ident(tableName)}`;
  const params: unknown[] = [];

  if (request.action === "select") {
    const clause = where(request.filters, params);
    let count: number | null | undefined;
    if (request.count === "exact") {
      const result = await client.query<{ count: number }>(`select count(*)::int as count from ${table}${clause}`, params);
      count = result.rows[0]?.count ?? 0;
      if (request.head) return { data: null, error: null, count };
    }
    const order = request.orders?.length ? ` order by ${request.orders.map((item) => `${ident(item.column)} ${item.ascending ? "asc" : "desc"}`).join(", ")}` : "";
    const limit = request.limit == null ? "" : ` limit ${Math.max(0, Math.floor(request.limit))}`;
    const offset = request.offset == null ? "" : ` offset ${Math.max(0, Math.floor(request.offset))}`;
    const result = await client.query(`select ${selected(request.columns)} from ${table}${clause}${order}${limit}${offset}`, params);
    return oneResult(request, result.rows, count);
  }

  if (request.action === "insert" || request.action === "upsert") {
    const rows = await normalizeRows(client, tableName, request.values);
    if (!rows.length) return { data: [], error: null };
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const valueSql = rows.map((row) => `(${columns.map((column) => { params.push(row[column] ?? null); return `$${params.length}`; }).join(", ")})`).join(", ");
    let conflict = "";
    if (request.action === "upsert") {
      const keys = await keysFor(client, tableName);
      if (!keys.length) throw new Error(`Cannot upsert ${tableName}: no primary key.`);
      const updates = columns.filter((column) => !keys.includes(column)).map((column) => `${ident(column)} = excluded.${ident(column)}`);
      conflict = ` on conflict (${keys.map(ident).join(", ")}) ${updates.length ? `do update set ${updates.join(", ")}` : "do nothing"}`;
    }
    const returning = request.returning || request.one ? ` returning ${selected(request.columns)}` : "";
    const result = await client.query(`insert into ${table} (${columns.map(ident).join(", ")}) values ${valueSql}${conflict}${returning}`, params);
    return oneResult(request, result.rows);
  }

  const clause = where(request.filters, params);
  if (!clause) throw new Error(`${request.action} on ${tableName} requires a filter.`);
  const returning = request.returning || request.one ? ` returning ${selected(request.columns)}` : "";
  if (request.action === "update") {
    const rows = await normalizeRows(client, tableName, request.values);
    const row = rows[0] ?? {};
    const assignments = Object.entries(row).map(([column, value]) => { params.push(value); return `${ident(column)} = $${params.length}`; });
    if (!assignments.length) return { data: null, error: null };
    const result = await client.query(`update ${table} set ${assignments.join(", ")}${clause}${returning}`, params);
    return oneResult(request, result.rows);
  }
  const result = await client.query(`delete from ${table}${clause}${returning}`, params);
  return oneResult(request, result.rows);
}

async function runRpc(client: PoolClient, request: QueryRequest): Promise<QueryResult<any>> {
  const name = request.rpc ?? "";
  if (!identifiers.test(name)) throw new Error("Invalid function name.");
  const params: unknown[] = [];
  const args = Object.entries(request.args ?? {}).map(([key, value]) => { params.push(value); return `${ident(key)} => $${params.length}`; });
  const result = await client.query<{ data: unknown }>(`select public.${ident(name)}(${args.join(", ")}) as data`, params);
  return { data: result.rows[0]?.data ?? null, error: null };
}

export async function executeQuery(request: QueryRequest, options: { admin?: boolean; userId?: string | null } = {}): Promise<QueryResult<any>> {
  const pool = options.admin ? adminPool : appPool;
  const client = await pool.connect();
  try {
    await client.query("begin");
    if (!options.admin) {
      await client.query(`set local role ${options.userId ? "authenticated" : "anon"}`);
      await client.query("select set_config('request.jwt.claim.sub', $1, true)", [options.userId ?? ""]);
    }
    const result = request.action === "rpc" ? await runRpc(client, request) : await runTable(client, request);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    const value = error as { message?: string; code?: string; detail?: string; hint?: string };
    return { data: null, error: { message: value.message ?? "Database request failed.", code: value.code, details: value.detail, hint: value.hint } };
  } finally { client.release(); }
}
