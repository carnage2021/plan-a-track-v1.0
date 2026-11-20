/* eslint-disable @typescript-eslint/no-explicit-any -- compatibility layer mirrors the dynamic Supabase query API */
import type { QueryRequest, QueryResult } from "./protocol";

type Executor = (request: QueryRequest) => Promise<QueryResult<any>>;

export class LocalQuery implements PromiseLike<QueryResult<any>> {
  private request: QueryRequest;

  constructor(private readonly executeRequest: Executor, table: string) {
    this.request = { action: "select", table, columns: "*", filters: [], orders: [] };
  }

  select(columns = "*", options?: { count?: "exact"; head?: boolean }) {
    if (this.request.action !== "insert" && this.request.action !== "update" && this.request.action !== "upsert" && this.request.action !== "delete") this.request.action = "select";
    else this.request.returning = true;
    this.request.columns = columns;
    this.request.count = options?.count;
    this.request.head = options?.head;
    return this;
  }

  insert(values: unknown) { this.request.action = "insert"; this.request.values = values; return this; }
  update(values: unknown) { this.request.action = "update"; this.request.values = values; return this; }
  upsert(values: unknown) { this.request.action = "upsert"; this.request.values = values; return this; }
  delete() { this.request.action = "delete"; return this; }

  eq(column: string, value: unknown) { return this.filter(column, "eq", value); }
  neq(column: string, value: unknown) { return this.filter(column, "neq", value); }
  in(column: string, value: unknown[]) { return this.filter(column, "in", value); }
  gte(column: string, value: unknown) { return this.filter(column, "gte", value); }
  lte(column: string, value: unknown) { return this.filter(column, "lte", value); }
  gt(column: string, value: unknown) { return this.filter(column, "gt", value); }
  lt(column: string, value: unknown) { return this.filter(column, "lt", value); }
  is(column: string, value: unknown) { return this.filter(column, "is", value); }
  not(column: string, operator: string, value: unknown) { return this.filter(column, operator === "is" ? "not_is" : "neq", value); }
  match(values: Record<string, unknown>) { for (const [column, value] of Object.entries(values)) this.eq(column, value); return this; }

  order(column: string, options?: { ascending?: boolean }) {
    this.request.orders!.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  limit(limit: number) { this.request.limit = limit; return this; }
  range(from: number, to: number) { this.request.offset = from; this.request.limit = Math.max(0, to - from + 1); return this; }
  single() { this.request.one = "single"; return this; }
  maybeSingle() { this.request.one = "maybeSingle"; return this; }

  then<TResult1 = QueryResult<any>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<any>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.executeRequest(this.request).then(onfulfilled, onrejected);
  }

  private filter(column: string, op: "eq" | "neq" | "in" | "gte" | "lte" | "gt" | "lt" | "is" | "not_is", value: unknown) {
    this.request.filters!.push({ column, op, value });
    return this;
  }
}

export class LocalRpc implements PromiseLike<QueryResult<any>> {
  constructor(private readonly executeRequest: Executor, private readonly name: string, private readonly args: Record<string, unknown>) {}
  then<TResult1 = QueryResult<any>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<any>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.executeRequest({ action: "rpc", rpc: this.name, args: this.args }).then(onfulfilled, onrejected);
  }
}
