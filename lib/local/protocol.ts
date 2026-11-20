export type FilterOp = "eq" | "neq" | "in" | "gte" | "lte" | "gt" | "lt" | "is" | "not_is";

export interface QueryFilter {
  column: string;
  op: FilterOp;
  value: unknown;
}

export interface QueryOrder {
  column: string;
  ascending: boolean;
}

export interface QueryRequest {
  action: "select" | "insert" | "update" | "upsert" | "delete" | "rpc";
  table?: string;
  values?: unknown;
  columns?: string;
  filters?: QueryFilter[];
  orders?: QueryOrder[];
  limit?: number;
  offset?: number;
  count?: "exact";
  head?: boolean;
  one?: "single" | "maybeSingle";
  returning?: boolean;
  rpc?: string;
  args?: Record<string, unknown>;
}

export interface LocalError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

export interface QueryResult<T = unknown> {
  data: T | null;
  error: LocalError | null;
  count?: number | null;
}
