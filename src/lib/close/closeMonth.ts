import type { SupabaseClient } from "@supabase/supabase-js";
import { PARABLE_DEFAULT_DB_SCHEMA } from "@sovereign/supabaseClient.js";

export type GateAuditRow = {
  id: string;
  gate_number: number;
  approved_by_id: string | null;
  approver_display: string | null;
  approval_timestamp: string;
};

/**
 * Append-only sign-off in parable_ledger.gate_audit_log
 */
export async function insertGateAudit(
  supabase: SupabaseClient,
  p: { tenantId: string; gateNumber: 1 | 2 | 3 | 4; userId: string | null; displayName: string }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .schema(PARABLE_DEFAULT_DB_SCHEMA)
    .from("gate_audit_log")
    .insert({
      tenant_id: p.tenantId,
      gate_number: p.gateNumber,
      approved_by_id: p.userId,
      approver_display: p.displayName,
      approval_timestamp: new Date().toISOString(),
    });
  return { error: error ? error.message : null };
}

export async function loadGateAuditHistory(
  supabase: SupabaseClient,
  tenantId: string
): Promise<GateAuditRow[]> {
  const { data, error } = await supabase
    .schema(PARABLE_DEFAULT_DB_SCHEMA)
    .from("gate_audit_log")
    .select("id, gate_number, approved_by_id, approver_display, approval_timestamp")
    .eq("tenant_id", tenantId)
    .order("approval_timestamp", { ascending: false })
    .limit(40);
  if (error) return [];
  return (data ?? []) as GateAuditRow[];
}

export function formatGateClearedMessage(row: GateAuditRow): string {
  const t = new Date(row.approval_timestamp);
  const d = t.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const time = t.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const who = row.approver_display?.trim() || "User";
  return `Gate [${row.gate_number}] cleared by ${who} on ${d} at ${time}.`;
}
