import AuditMarqueeClient from "@/components/AuditMarqueeClient";
import { FOUNDRY_TENANT_ID } from "@/lib/accounting/foundry";
import { getSupabaseServerAnon } from "@/lib/supabase/server-anon";
import type { AccountingAlertRow } from "@/types/accounting";

export type { AccountingAlertRow } from "@/types/accounting";

function isAbnormal(alert: AccountingAlertRow): boolean {
  const s = String(alert.health_status ?? "")
    .toLowerCase()
    .trim();
  if (!s) return false;
  if (s === "ok" || s === "healthy" || s === "normal" || s === "nominal" || s === "balanced") {
    return false;
  }
  return true;
}

/**
 * Renders a strip when `parable_ledger.view_accounting_alerts` (PostgREST: `view_accounting_alerts`) reports
 * abnormal (non-healthy) balance or integrity rows for the Foundry tenant. Returns null when the view is
 * empty, errors, or only healthy entries apply.
 */
export default async function AccountingAudit() {
  const supabase = getSupabaseServerAnon();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("view_accounting_alerts")
    .select("*")
    .eq("tenant_id", FOUNDRY_TENANT_ID);

  if (error) return null;
  if (!data?.length) return null;

  const rows = (data as AccountingAlertRow[]).filter(isAbnormal);
  if (!rows.length) return null;

  return <AuditMarqueeClient alerts={rows} />;
}
