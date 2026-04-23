import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApRow } from "./monthEndCloseStatus";

/**
 * Heuristic: pending AP vendor names are matched to contractor payees (display_name contains / equates case-insensitively).
 * Returns a compliance line for the hub card (amber risk vs neutral success).
 */
export type ApW9Compliance = {
  label: "All W-9s on file" | "W-9 review needed" | "Roster not linked" | "No open AP to verify";
  detail: string;
  isBreached: boolean;
  missingVendorCount: number;
};

function norm(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
}

function matches(vendor: string, display: string) {
  const a = norm(vendor);
  const b = norm(display);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

export async function evaluateApW9Compliance(
  supabase: SupabaseClient,
  tenantId: string,
  topPending: ApRow[],
): Promise<ApW9Compliance> {
  if (topPending.length === 0) {
    return { label: "No open AP to verify", detail: "No pending bills in queue.", isBreached: false, missingVendorCount: 0 };
  }
  const { data, error } = await supabase
    .schema("parable_ledger")
    .from("contractor_payees")
    .select("id, display_name, w9_on_file")
    .eq("tenant_id", tenantId);

  if (error) {
    const m = (error.message || "").toLowerCase();
    if (m.includes("does not exist") || m.includes("contractor")) {
      return {
        label: "Roster not linked",
        detail: "Run contractor_payees migration or 1099 dashboard to enable W-9 cross-checks.",
        isBreached: true,
        missingVendorCount: 0,
      };
    }
    return {
      label: "W-9 review needed",
      detail: error.message,
      isBreached: true,
      missingVendorCount: topPending.length,
    };
  }
  const rows = (data ?? []) as { id: string; display_name: string; w9_on_file: boolean }[];
  if (rows.length === 0) {
    return {
      label: "Roster not linked",
      detail: "Add contractor payees to compare vendor names to W-9 file status.",
      isBreached: true,
      missingVendorCount: topPending.length,
    };
  }
  let missing = 0;
  for (const p of topPending) {
    const c = rows.find((r) => matches(p.vendor_name, r.display_name));
    if (!c || !c.w9_on_file) missing += 1;
  }
  if (missing === 0) {
    return {
      label: "All W-9s on file",
      detail: `Matched ${topPending.length} top pending vendor name(s) to the contractor roster with W-9s filed.`,
      isBreached: false,
      missingVendorCount: 0,
    };
  }
  return {
    label: "W-9 review needed",
    detail: `${missing} of ${topPending.length} top pending vendor(s) are missing a W-9 on file in the roster (name match is heuristic).`,
    isBreached: true,
    missingVendorCount: missing,
  };
}
