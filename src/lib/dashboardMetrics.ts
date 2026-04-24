import type { SupabaseClient } from "@supabase/supabase-js";
import { getHubPayrollMonth } from "./payrollFromErpTable";

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Org-level tithes & offerings: `donation` and `revenue` lines (Stripe tithes, transfers, etc.).
 */
export async function sumOrgTitheOfferings(
  supabase: SupabaseClient,
  tenantId: string,
  startIso: string,
  endIso: string
): Promise<{ total: number; lineCount: number; error: string | null }> {
  const { data, error } = await supabase
    .schema("parable_ledger")
    .from("transactions")
    .select("amount, created_at, tx_type")
    .eq("tenant_id", tenantId)
    .in("tx_type", ["donation", "revenue"])
    .gte("created_at", startIso)
    .lte("created_at", endIso);

  if (error) {
    return { total: 0, lineCount: 0, error: error.message };
  }
  let t = 0;
  for (const row of data ?? []) {
    t += Math.abs(Number((row as { amount: string | number }).amount) || 0);
  }
  return { total: round2(t), lineCount: data?.length ?? 0, error: null };
}

export type ErpPayrollBreakdown = {
  ministerial: number;
  secular: number;
  lineCount: number;
  source: "erp_payroll" | "ledger_expense" | "mixed";
  error: string | null;
};

/**
 * Sums `erp_payroll` between pay_date [start, end] (inclusive, YYYY-MM-DD).
 * If no rows, falls back to a single "current month" read via `getHubPayrollMonth` (only for short ranges).
 */
export async function sumErpPayrollRange(
  supabase: SupabaseClient,
  tenantId: string,
  startYmd: string,
  endYmd: string,
  now = new Date()
): Promise<ErpPayrollBreakdown> {
  const { data, error } = await supabase
    .schema("parable_ledger")
    .from("erp_payroll")
    .select("wage_type, amount, pay_date")
    .eq("tenant_id", tenantId)
    .gte("pay_date", startYmd)
    .lte("pay_date", endYmd);

  if (error) {
    return { ministerial: 0, secular: 0, lineCount: 0, source: "ledger_expense", error: error.message };
  }
  let ministerial = 0;
  let secular = 0;
  for (const row of data ?? []) {
    const a = Math.abs(Number((row as { amount: string | number }).amount) || 0);
    if ((row as { wage_type: string }).wage_type === "ministerial_housing") ministerial = round2(ministerial + a);
    if ((row as { wage_type: string }).wage_type === "secular_wage") secular = round2(secular + a);
  }
  if ((data?.length ?? 0) > 0) {
    return { ministerial, secular, lineCount: data?.length ?? 0, source: "erp_payroll", error: null };
  }
  const ymd = now.toISOString().slice(0, 7);
  const sameWindow =
    startYmd.slice(0, 7) === endYmd.slice(0, 7) && endYmd.slice(0, 7) === ymd;
  if (sameWindow) {
    const hub = await getHubPayrollMonth(supabase, tenantId, now);
    return {
      ministerial: hub.ministerial,
      secular: hub.secular,
      lineCount: 0,
      source: hub.source,
      error: null,
    };
  }
  return { ministerial: 0, secular: 0, lineCount: 0, source: "erp_payroll", error: null };
}

export type AlertRowBrief = {
  id: string;
  violation_type: string;
  violation_code: string;
  status: string;
  risk_level: string;
  created_at: string;
  description: string;
};

/**
 * Open / non-resolved internal controls automation alerts.
 */
export async function fetchOpenComplianceAlerts(
  supabase: SupabaseClient,
  tenantId: string,
  limit = 8
): Promise<{ rows: AlertRowBrief[]; openCount: number; error: string | null }> {
  const { count, error: cErr } = await supabase
    .schema("parable_ledger")
    .from("compliance_violation_alerts")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .neq("status", "resolved");

  if (cErr) {
    return { rows: [], openCount: 0, error: cErr.message };
  }

  const { data, error } = await supabase
    .schema("parable_ledger")
    .from("compliance_violation_alerts")
    .select("id, violation_type, violation_code, status, risk_level, created_at, description")
    .eq("tenant_id", tenantId)
    .neq("status", "resolved")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { rows: [], openCount: 0, error: error.message };
  }
  return { rows: (data ?? []) as AlertRowBrief[], openCount: count ?? 0, error: null };
}

export function formatUsd(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
