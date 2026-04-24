import type { SupabaseClient } from "@supabase/supabase-js";

/** General unrestricted fund (`GEN`) for a tenant; used for tithes + many imports. */
export async function getGeneralFundId(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .schema("parable_ledger")
    .from("ministry_funds")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("fund_code", "GEN")
    .maybeSingle();
  if (error || !data?.id) {
    return null;
  }
  return data.id as string;
}
