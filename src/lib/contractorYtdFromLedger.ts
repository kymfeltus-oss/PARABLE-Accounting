import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Sums YTD (calendar year) expense `amount` per `metadata.contractor_payee_id`.
 */
export async function computeContractorYtdByPayee(
  supabase: SupabaseClient,
  tenantId: string,
  year: number = new Date().getFullYear(),
): Promise<Record<string, number>> {
  const yStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)).toISOString();
  const yEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)).toISOString();

  const { data, error } = await supabase
    .schema("parable_ledger")
    .from("transactions")
    .select("id, amount, metadata")
    .eq("tenant_id", tenantId)
    .eq("tx_type", "expense")
    .gte("created_at", yStart)
    .lte("created_at", yEnd);

  if (error) throw new Error(`contractor ytd: ${error.message}`);

  const by: Record<string, number> = {};
  for (const row of data ?? []) {
    const m = row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {};
    const pid = m.contractor_payee_id != null ? String(m.contractor_payee_id) : null;
    if (!pid) continue;
    by[pid] = (by[pid] ?? 0) + Math.abs(Number(row.amount) || 0);
  }
  for (const k of Object.keys(by)) {
    by[k] = Math.round(by[k] * 100) / 100;
  }
  return by;
}
