import AuditMarqueeClient from "@/components/AuditMarqueeClient";
import { FOUNDRY_TENANT_ID } from "@/lib/accounting/foundry";
import { getSupabaseServerAnon } from "@/lib/supabase/server-anon";
import type { AccountingAlertRow } from "@/types/accounting";

export type { AccountingAlertRow } from "@/types/accounting";

function isAbnormal(alert: AccountingAlertRow): boolean {
  const s = String(alert.health_status ?? "").toLowerCase().trim();
  if (!s) return false;
  if (s === "ok" || s === "healthy" || s === "normal" || s === "nominal" || s === "balanced") {
    return false;
  }
  return true;
}

/**
 * Fetches `parable_ledger.view_accounting_alerts` and renders a destructive
 * (red) marquee when abnormal / non-healthy rows exist.
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
