import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

// The database hands back at most 1,000 rows a request, whatever range is asked for, so a large menu, a long recipe
// list or a busy year of orders is read a page at a time. Each page is ordered by the table's own key as well, so
// rows with the same date or name cannot shift between pages.

const PAGE = 1000;

/** Tables keyed by two columns instead of an id. */
const keys: Record<string, string[]> = {
  function_items: ["function_id", "item_id"],
  package_rules: ["package_id", "category_id"],
  kitchen_items: ["function_id", "item_id"],
  recipe_lines: ["item_id", "ingredient_id"],
  vendor_rates: ["vendor_id", "ingredient_id"],
  onsite: ["function_id"],
};

type Row = Record<string, unknown>;

/** Every row of a table the signed-in person can see, in the given order. Same shape as a Supabase result. */
export async function selectAll<T = Row>(sb: SupabaseClient, table: string, order?: string, ascending = true, columns = "*"): Promise<{ data: T[] | null; error: PostgrestError | null }> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = sb.from(table).select(columns);
    if (order) q = q.order(order, { ascending });
    for (const k of keys[table] ?? ["id"]) q = q.order(k);
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) return { data: null, error };
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) return { data: out, error: null };
  }
}
