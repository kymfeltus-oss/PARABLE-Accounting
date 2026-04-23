import type { SupabaseClient } from "@supabase/supabase-js";
import { isMinisterialFirstPayrollBlocked, isVaultRowHousingAllowanceResolution } from "./onboardingFromRoot.js";

export type StaffRow = {
  id: string;
  full_name: string;
  role_type: string;
  has_housing_resolution: boolean;
};

/**
 * For Financial Hub card: any minister in onboarding without a housing shield = payroll risk nudge.
 */
export async function loadHousingShieldForHub(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<{
  vaultHasHousingResolution: boolean;
  ministerRows: StaffRow[];
  blockedCount: number;
  ministerCount: number;
  skipped: boolean;
}> {
  const empty = {
    vaultHasHousingResolution: false,
    ministerRows: [] as StaffRow[],
    blockedCount: 0,
    ministerCount: 0,
    skipped: true,
  };
  const { data: sData, error: sErr } = await supabase
    .schema("parable_ledger")
    .from("staff_onboarding")
    .select("id, full_name, role_type, has_housing_resolution")
    .eq("tenant_id", tenantId);
  if (sErr) {
    if (sErr.message.toLowerCase().includes("does not exist") || sErr.message.includes("staff_onboarding")) {
      return empty;
    }
    return empty;
  }
  const staff = (sData ?? []) as StaffRow[];
  const { data: vData, error: vErr } = await supabase
    .schema("parable_ledger")
    .from("sovereign_vault")
    .select("id, category, subcategory, metadata, file_name")
    .eq("tenant_id", tenantId)
    .limit(200);
  if (vErr) {
    const ministerRows = staff.filter((r) => r.role_type === "Minister");
    return {
      vaultHasHousingResolution: false,
      ministerRows,
      ministerCount: ministerRows.length,
      blockedCount: ministerRows.filter((m) => isMinisterialFirstPayrollBlocked(m, false)).length,
      skipped: false,
    };
  }
  const vaultHousing = (vData ?? []).some((row) => isVaultRowHousingAllowanceResolution(row as never));
  const ministerRows = staff.filter((r) => r.role_type === "Minister");
  const blockedCount = ministerRows.filter((m) => isMinisterialFirstPayrollBlocked(m, vaultHousing)).length;
  return {
    vaultHasHousingResolution: vaultHousing,
    ministerRows,
    ministerCount: ministerRows.length,
    blockedCount,
    skipped: false,
  };
}
