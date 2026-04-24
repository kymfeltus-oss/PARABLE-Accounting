import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getParableServiceSupabaseOptions } from "@sovereign/supabaseClient.js";

let _admin: SupabaseClient | null = null;

/** Service role — server / API / webhooks only. Do not import from client components. */
export function getServiceSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return null;
  }
  if (!_admin) {
    _admin = createClient(url, key, getParableServiceSupabaseOptions()) as unknown as SupabaseClient;
  }
  return _admin;
}
