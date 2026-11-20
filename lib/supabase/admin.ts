import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createLocalAdminClient } from "@/lib/local/server-client";

/** Local administrative client. It is only used in server route handlers. */
export function adminClient() {
  return createLocalAdminClient() as unknown as SupabaseClient;
}
