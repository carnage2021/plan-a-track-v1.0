"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "./supabase/client";

// Writes run one after another, in the order the user made them, so a new client is always
// saved before the enquiry or quotation that points at it. Shared by both stores.
let chain: Promise<unknown> = Promise.resolve();
let onFailure: () => void = () => {};

/** Called when an optimistic save fails, to go back to what the database has. */
export function setReload(reload: () => void) {
  onFailure = reload;
}

export function write<T>(job: (sb: SupabaseClient) => Promise<T>): Promise<T> {
  const next = chain.then(() => job(supabase()));
  chain = next.catch(() => undefined);
  return next;
}

/** For optimistic changes: if the save fails, say so and reload. */
export function background(job: (sb: SupabaseClient) => Promise<unknown>) {
  write(job).catch((e: unknown) => {
    toast.error("That change could not be saved", { description: e instanceof Error ? e.message : undefined });
    onFailure();
  });
}
