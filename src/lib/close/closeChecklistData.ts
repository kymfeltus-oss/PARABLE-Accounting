import type { SupabaseClient } from "@supabase/supabase-js";
import { computeCloseAttestationSha256 } from "./attestationHash";
import { PARABLE_DEFAULT_DB_SCHEMA } from "@sovereign/supabaseClient.js";

export type CloseChecklistRow = {
  task_name: string;
  verifier_name: string | null;
  /** `staff_onboarding.id` of the attesting person (view_staff_directory) */
  verifier_staff_id: string | null;
  /** Same as `verifier_staff_id` when FK points at staff (not auth.users) */
  completed_by_id: string | null;
  completed_at: string;
  gate_number: number;
  /** SHA-256 hex of `tenant_id|reporting_period|task_name` */
  attestation_sha256: string | null;
};

export type StaffRow = { id: string; staff_name: string };

/**
 * Map task_name -> row
 */
export async function loadCloseChecklistForPeriod(
  supabase: SupabaseClient,
  tenantId: string,
  reportingPeriod: string
): Promise<Map<string, CloseChecklistRow>> {
  const { data, error } = await supabase
    .schema(PARABLE_DEFAULT_DB_SCHEMA)
    .from("close_checklists")
    .select("task_name, verifier_name, verifier_staff_id, completed_by_id, completed_at, gate_number, attestation_sha256")
    .eq("tenant_id", tenantId)
    .eq("reporting_period", reportingPeriod);

  const m = new Map<string, CloseChecklistRow>();
  if (error || !data) return m;
  for (const r of data as CloseChecklistRow[]) {
    m.set(r.task_name, { ...r, attestation_sha256: r.attestation_sha256 ?? null });
  }
  return m;
}

export type StaffDirectoryLoad = { staff: StaffRow[]; error: string | null };

/**
 * Full-time staff list for verifier dropdowns (seeds from `staff_onboarding` via `view_staff_directory`).
 */
export async function loadStaffDirectory(supabase: SupabaseClient, tenantId: string): Promise<StaffDirectoryLoad> {
  const { data, error } = await supabase
    .schema(PARABLE_DEFAULT_DB_SCHEMA)
    .from("view_staff_directory")
    .select("id, staff_name")
    .eq("tenant_id", tenantId)
    .order("staff_name", { ascending: true });

  if (error) {
    return { staff: [], error: error.message };
  }
  return { staff: (data ?? []) as StaffRow[], error: null };
}

/**
 * Idempotent attestation: server time via trigger; `completed_by_id` = `staff_onboarding.id` (institutional signatory).
 */
export async function saveCloseChecklistItem(
  supabase: SupabaseClient,
  p: {
    tenantId: string;
    reportingPeriod: string;
    gateNumber: number;
    taskName: string;
    verifierName: string;
    /** `staff_onboarding.id` (same as directory row) */
    verifierStaffId: string;
  }
): Promise<{ error: string | null }> {
  const attestation_sha256 = (await computeCloseAttestationSha256(p.tenantId, p.reportingPeriod, p.taskName)) || null;
  const { error } = await supabase
    .schema(PARABLE_DEFAULT_DB_SCHEMA)
    .from("close_checklists")
    .upsert(
      {
        tenant_id: p.tenantId,
        reporting_period: p.reportingPeriod,
        gate_number: p.gateNumber,
        task_name: p.taskName,
        verifier_name: p.verifierName,
        verifier_staff_id: p.verifierStaffId,
        completed_by_id: p.verifierStaffId,
        attestation_sha256,
      },
      { onConflict: "tenant_id,reporting_period,task_name" }
    );

  return { error: error ? error.message : null };
}
