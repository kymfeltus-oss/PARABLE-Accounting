import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getParableSupabaseClientOptions } from "@sovereign/supabaseClient.js";

let browserClient: SupabaseClient | null = null;

/**
 * Anon / browser — default PostgREST schema `parable_ledger` (see `C:\...\supabaseClient.js` + Dashboard “Exposed schemas”).
 */
export function getSupabaseBrowser(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!browserClient) {
    browserClient = createClient(url, key, getParableSupabaseClientOptions()) as unknown as SupabaseClient;
  }
  return browserClient;
}
