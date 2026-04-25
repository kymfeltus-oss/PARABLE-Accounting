import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getParableSupabaseClientOptions } from "@sovereign/supabaseClient.js";

/**
 * Anon client for server components (read with RLS). No session persistence.
 */
export function getSupabaseServerAnon(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    ...getParableSupabaseClientOptions(),
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as SupabaseClient;
}
