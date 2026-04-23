import type { SupabaseClient } from "@supabase/supabase-js";
import { getQuarterlyTotals, toForm941LineMap } from "../../taxLogic.js";

export { getQuarterlyTotals, toForm941LineMap };

export type QuarterlyTotals = Awaited<ReturnType<typeof getQuarterlyTotals>>;

export async function markQuarterly941Generated(
  supabase: SupabaseClient,
  tenantId: string,
  taxYear: number,
  quarter: 1 | 2 | 3 | 4,
) {
  const now = new Date().toISOString();
  const { data: updated, error: upErr } = await supabase
    .schema("parable_ledger")
    .from("quarterly_tax_reports")
    .update({ is_generated: true, computed_at: now })
    .eq("tenant_id", tenantId)
    .eq("tax_year", taxYear)
    .eq("quarter", quarter)
    .select("id");
  if (upErr) throw new Error(upErr.message);
  if (updated?.length) return;
  await getQuarterlyTotals(supabase, tenantId, taxYear, quarter, { persist: true });
  const { error: retry } = await supabase
    .schema("parable_ledger")
    .from("quarterly_tax_reports")
    .update({ is_generated: true, computed_at: now })
    .eq("tenant_id", tenantId)
    .eq("tax_year", taxYear)
    .eq("quarter", quarter);
  if (retry) throw new Error(retry.message);
}
