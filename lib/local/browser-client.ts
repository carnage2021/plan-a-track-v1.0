/* eslint-disable @typescript-eslint/no-explicit-any -- runtime compatibility with the existing Supabase client calls */
"use client";

import { LocalQuery, LocalRpc } from "./query";
import type { QueryRequest, QueryResult } from "./protocol";

const STORAGE_KEY = "plan-a-track-session";
type Session = { access_token: string; expires_at: number; user: { id: string; email?: string; user_metadata?: Record<string, unknown> } };

function readSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Session | null;
    if (!value?.access_token || value.expires_at * 1000 <= Date.now()) return null;
    return value;
  } catch { return null; }
}

function writeSession(value: Session | null) {
  if (typeof window === "undefined") return;
  if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  else localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("plan-a-track-auth", { detail: value }));
}

async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const session = readSession();
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
  const response = await fetch(path, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body as T;
}

async function execute(request: QueryRequest): Promise<QueryResult<any>> {
  try { return await api<QueryResult<any>>("/api/local/query", { method: "POST", body: JSON.stringify(request) }); }
  catch (error) { return { data: null, error: { message: error instanceof Error ? error.message : "Database request failed." } }; }
}

export function createLocalBrowserClient() {
  return {
    from: (table: string) => new LocalQuery(execute, table),
    rpc: (name: string, args: Record<string, unknown> = {}) => new LocalRpc(execute, name, args),
    auth: {
      getSession: async () => ({ data: { session: readSession() }, error: null }),
      signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
        try {
          const session = await api<Session>("/api/local/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
          writeSession(session);
          return { data: { session, user: session.user }, error: null };
        } catch (error) { return { data: { session: null, user: null }, error: { message: error instanceof Error ? error.message : "Sign in failed." } }; }
      },
      signOut: async () => { writeSession(null); return { error: null }; },
      onAuthStateChange: (callback: (event: string, session: Session | null) => void) => {
        const listener = (event: Event) => callback((event as CustomEvent<Session | null>).detail ? "SIGNED_IN" : "SIGNED_OUT", (event as CustomEvent<Session | null>).detail);
        window.addEventListener("plan-a-track-auth", listener);
        queueMicrotask(() => callback("INITIAL_SESSION", readSession()));
        return { data: { subscription: { unsubscribe: () => window.removeEventListener("plan-a-track-auth", listener) } } };
      },
    },
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, file: File, options?: { contentType?: string }) => {
          try {
            const form = new FormData();
            form.set("file", file);
            form.set("bucket", bucket);
            form.set("path", path);
            if (options?.contentType) form.set("contentType", options.contentType);
            const data = await api<{ path: string }>("/api/local/storage/upload", { method: "POST", body: form });
            return { data, error: null };
          } catch (error) { return { data: null, error: { message: error instanceof Error ? error.message : "Upload failed." } }; }
        },
      }),
    },
  };
}
