import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Service-role client. Bypasses row-level security, so it is only ever used in route handlers. */
export function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
