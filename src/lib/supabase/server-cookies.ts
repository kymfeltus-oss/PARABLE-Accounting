import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getParableSupabaseClientOptions } from "@sovereign/supabaseClient.js";
import type { SupabaseClient } from "@supabase/supabase-js";

const base = getParableSupabaseClientOptions();

/**
 * Supabase client for Server Actions / Route Handlers: uses cookies for auth session.
 */
export async function createServerSupabase(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required");
  }
  const store = await cookies();
  return createServerClient(url, key, {
    ...base,
    auth: { persistSession: true, autoRefreshToken: true, ...(base.auth ?? {}) },
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[],
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            store.set(name, value, options as Parameters<typeof store.set>[2]);
          });
        } catch {
          // set from Server Component — session refresh may be handled by middleware
        }
      },
    },
  }) as unknown as SupabaseClient;
}
