/**
 * PARABLE: single Supabase PostgREST schema (parable_ledger).
 * Expose `parable_ledger` in Dashboard → Settings → API → “Exposed schemas” before using.
 * The browser + server helpers in `src/lib/supabase/*` re-use this config. If .from("tenants") fails, confirm this option and Dashboard “Exposed schemas.”
 * @type { "parable_ledger" }
 */
export const PARABLE_DEFAULT_DB_SCHEMA = "parable_ledger";

/**
 * Default `parable_ledger.tenants.slug` (institutional handle) when `NEXT_PUBLIC_TENANT_SLUG` is unset.
 * Aligns with `fix_tenant_slug.sql` / your Supabase row (e.g. "parable-master", PARABLE Master Entity).
 * @type { "parable-master" }
 */
export const PARABLE_DEFAULT_TENANT_SLUG = "parable-master";

/**
 * @returns { import("@supabase/supabase-js").ClientOptions }
 */
export function getParableSupabaseClientOptions() {
  return {
    auth: { persistSession: true, autoRefreshToken: true },
    /** Default PostgREST schema — must be listed in Supabase “Exposed schemas”. */
    db: { schema: PARABLE_DEFAULT_DB_SCHEMA },
  };
}

/**
 * @returns { Omit<import("@supabase/supabase-js").ClientOptions, "db"> & { db: { schema: "parable_ledger" } } }
 */
export function getParableServiceSupabaseOptions() {
  return {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: PARABLE_DEFAULT_DB_SCHEMA },
  };
}
