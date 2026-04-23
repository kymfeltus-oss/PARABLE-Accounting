import type { SupabaseClient } from "@supabase/supabase-js";
import { getPayrollMonthMinisterialSecular } from "./payrollMonthBreakdown";

function monthUtcDateBounds(year: number, month1to12: number) {
  const d0 = new Date(Date.UTC(year, month1to12 - 1, 1));
  const d1 = new Date(Date.UTC(year, month1to12, 0));
  return {
    start: d0.toISOString().slice(0, 10),
    end: d1.toISOString().slice(0, 10),
  };
}

export type HubPayrollSource = "erp_payroll" | "ledger_expense";

/**
 * Sums `erp_payroll` for the current UTC month (ministerial_housing vs secular_wage).
 * If the table is empty for that month, falls back to expense-transaction heuristics.
 */
export async function getHubPayrollMonth(
  supabase: SupabaseClient,
  tenantId: string,
  ref: Date = new Date(),
): Promise<{
  ministerial: number;
  secular: number;
  monthLabel: string;
  year: number;
  month: number;
  source: HubPayrollSource;
}> {
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth() + 1;
  const { start, end } = monthUtcDateBounds(y, m);
  const monthLabel = new Date(Date.UTC(y, m - 1, 1)).toLocaleString(undefined, { month: "long", year: "numeric" });

  const { data, error } = await supabase
    .schema("parable_ledger")
    .from("erp_payroll")
    .select("wage_type, amount, pay_date")
    .eq("tenant_id", tenantId)
    .gte("pay_date", start)
    .lte("pay_date", end);

  if (error) {
    const fb = await getPayrollMonthMinisterialSecular(supabase, tenantId, ref);
    return { ...fb, source: "ledger_expense" };
  }

  let ministerial = 0;
  let secular = 0;
  for (const row of data ?? []) {
    const a = Math.abs(Number((row as { amount: string }).amount) || 0);
    if ((row as { wage_type: string }).wage_type === "ministerial_housing") ministerial += a;
    if ((row as { wage_type: string }).wage_type === "secular_wage") secular += a;
  }
  if ((data?.length ?? 0) > 0) {
    return {
      ministerial: Math.round((ministerial + Number.EPSILON) * 100) / 100,
      secular: Math.round((secular + Number.EPSILON) * 100) / 100,
      year: y,
      month: m,
      monthLabel,
      source: "erp_payroll",
    };
  }

  const fb = await getPayrollMonthMinisterialSecular(supabase, tenantId, ref);
  return { ...fb, source: "ledger_expense" };
}
