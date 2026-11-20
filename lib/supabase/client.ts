import type { SupabaseClient } from "@supabase/supabase-js";
import { createLocalBrowserClient } from "@/lib/local/browser-client";

let client: SupabaseClient | undefined;

/** One browser client for the whole app; all data stays on this server. */
export function supabase() {
  client ??= createLocalBrowserClient() as unknown as SupabaseClient;
  return client;
}
