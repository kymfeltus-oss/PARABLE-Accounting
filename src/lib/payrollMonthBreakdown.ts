import type { SupabaseClient } from "@supabase/supabase-js";
import { isMinisterialForFica, isSalaryRow, parsePayrollMetadata } from "../../taxLogic.js";

function monthUtcRangeIso(year: number, month1to12: number) {
  const start = new Date(Date.UTC(year, month1to12 - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month1to12, 0, 23, 59, 59, 999));
  return { start: start.toISOString(), end: end.toISOString() };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Current calendar month (UTC) ministerial vs non-minister (secular) wage totals from ledger.
 */
export async function getPayrollMonthMinisterialSecular(
  supabase: SupabaseClient,
  tenantId: string,
  ref: Date = new Date(),
): Promise<{ ministerial: number; secular: number; monthLabel: string; year: number; month: number }> {
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth() + 1;
  const { start, end } = monthUtcRangeIso(y, m);

  const { data, error } = await supabase
    .schema("parable_ledger")
    .from("transactions")
    .select("id, amount, irs_category, metadata, created_at, tx_type")
    .eq("tenant_id", tenantId)
    .eq("tx_type", "expense")
    .gte("created_at", start)
    .lte("created_at", end)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  let ministerial = 0;
  let secular = 0;
  for (const row of data ?? []) {
    const meta = row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {};
    if (!isSalaryRow(meta, row.irs_category)) continue;
    const amountAbs = round2(Math.abs(Number(row.amount)));
    const { gross } = parsePayrollMetadata(meta, amountAbs);
    if (isMinisterialForFica(meta)) ministerial = round2(ministerial + gross);
    else secular = round2(secular + gross);
  }

  return {
    ministerial,
    secular,
    year: y,
    month: m,
    monthLabel: new Date(Date.UTC(y, m - 1, 1)).toLocaleString(undefined, { month: "long", year: "numeric" }),
  };
}
