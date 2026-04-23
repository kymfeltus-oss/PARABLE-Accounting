import type { SupabaseClient } from "@supabase/supabase-js";
import { hashPayloadJsonStable } from "@/lib/sovereignCloseHash";

export type SovereignGateId = "GATE_INPUT" | "GATE_SHIELD" | "GATE_RECONCILE" | "GATE_RESTRICTED" | "GATE_SEAL" | "SYSTEM" | "COMPLETE";

/**
 * Log an append-only event when a gate is satisfied and the user advances, or the month is sealed.
 * `gate_to` in DB: next gate, or "COMPLETE" when the month is vault-locked.
 */
export async function recordSovereignCloseEvent(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    userId: string | null;
    monthStart: string; // 'YYYY-MM-01'
    from: string;
    to: string | null;
    payload: Record<string, unknown>;
    clientLabel?: string;
  }
): Promise<{ id: string | null; error: string | null }> {
  const h = await hashPayloadJsonStable(params.payload);
  const { data, error } = await supabase
    .schema("parable_ledger")
    .from("sovereign_close_events")
    .insert({
      tenant_id: params.tenantId,
      month_start: params.monthStart,
      gate_from: params.from,
      gate_to: params.to,
      user_id: params.userId,
      payload_hash: h,
      payload_json: params.payload,
      client_label: params.clientLabel ?? "SovereignCloseWizard",
    })
    .select("id")
    .maybeSingle();
  if (error) {
    return { id: null, error: error.message };
  }
  return { id: (data as { id: string } | null)?.id ?? null, error: null };
}
