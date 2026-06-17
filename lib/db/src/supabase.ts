import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _supabaseClient: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

function getConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL environment variable must be set.");
  }

  return { supabaseUrl, supabaseAnonKey, supabaseServiceKey };
}

/**
 * Get the public Supabase client (anon key) — used for client-side operations.
 * Lazily initialized so tests and non-Supabase setups don't fail on import.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!_supabaseClient) {
    const { supabaseUrl, supabaseAnonKey } = getConfig();
    _supabaseClient = createClient(supabaseUrl, supabaseAnonKey ?? "");
  }
  return _supabaseClient;
}

/**
 * Get the admin Supabase client (service_role key) — bypasses RLS for server-side operations.
 * Lazily initialized.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const { supabaseUrl, supabaseServiceKey } = getConfig();
    _supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey ?? "");
  }
  return _supabaseAdmin;
}

// Re-export for backwards compatibility
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabaseClient() as any)[prop];
  },
});

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabaseAdmin() as any)[prop];
  },
});