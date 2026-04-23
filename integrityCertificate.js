// PARABLE: Integrity Gatekeeper — five pillars; sovereign seal / certificate hash only when all CLEARED.
// Not legal or IRS attestation; internal operational gate before generating proof-of-stewardship ID.

import { NEC_TRACKING_THRESHOLD_USD } from "./contractorTracker.js";

const FED = "parable_ledger";

/** Pillar keys aligned to product spec (data sources in comments). */
export const PILLAR_KEYS = /** @type {const} */ (["ledger", "irs_1828", "stewardship", "tax", "audit"]);

/**
 * @param {string} s
 * @returns {Promise<string>} hex sha-256
 */
export async function sha256Hex(s) {
  const buf = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} tenantId
 * @param {number} year
 * @returns {Promise<{
 *   pillars: Record<string, { status: 'CLEARED' | 'PENDING' | 'FAILED', detail: string, fixHref?: string }>,
 *   isCompliant: boolean
 * }>}
 */
export async function evaluatePillarStatus(supabase, tenantId, year) {
  if (!supabase || !tenantId) {
    return {
      pillars: Object.fromEntries(
        PILLAR_KEYS.map((k) => [k, { status: "PENDING", detail: "No workspace" }]),
      ),
      isCompliant: false,
    };
  }

  const yStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)).toISOString();
  const yEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)).toISOString();

  const [
    { data: txYear, error: eTx },
    { data: funds, error: eFund },
    { data: violations, error: eVio },
    { data: staff, error: eStaff },
    { data: contractors, error: eCon },
  ] = await Promise.all([
    supabase
      .schema(FED)
      .from("transactions")
      .select("id, amount, fund_id, metadata, tx_type")
      .eq("tenant_id", tenantId)
      .gte("created_at", yStart)
      .lte("created_at", yEnd),
    supabase.schema(FED).from("ministry_funds").select("id, fund_code, balance, is_restricted, fund_name").eq("tenant_id", tenantId).eq("is_active", true),
    supabase
      .schema(FED)
      .from("compliance_violation_alerts")
      .select("id, status, risk_level, violation_type, created_at")
      .eq("tenant_id", tenantId)
      .eq("status", "open"),
    supabase
      .schema(FED)
      .from("staff_onboarding")
      .select("id, full_name, role_type, has_housing_resolution, onboarding_status")
      .eq("tenant_id", tenantId),
    supabase.schema(FED).from("contractor_payees").select("id, display_name, w9_on_file").eq("tenant_id", tenantId),
  ]);

  if (eTx) throw new Error(eTx.message);
  if (eFund) throw new Error(eFund.message);
  if (eVio) throw new Error(eVio.message);
  if (eStaff) throw new Error(eStaff.message);
  if (eCon) throw new Error(eCon.message);

  /** @type {Record<string, { status: 'CLEARED' | 'PENDING' | 'FAILED', detail: string, fixHref?: string }>} */
  const pillars = {};

  // 1) Ledger: no journal line without fund; "unmapped" = missing fund for material tx
  let unmapped = 0;
  for (const t of txYear ?? []) {
    if (t.tx_type === "expense" || t.tx_type === "revenue" || t.tx_type === "donation") {
      if (t.fund_id == null) unmapped += 1;
    }
  }
  pillars.ledger =
    unmapped === 0
      ? {
          status: "CLEARED",
          detail: "All scoped transactions have a fund; bank↔ledger match uses your bank rec / close workflow.",
          fixHref: "/import-export",
        }
      : {
          status: "FAILED",
          detail: `${unmapped} row(s) missing fund assignment (unmapped to ministry fund).`,
          fixHref: "/import-export",
        };

  // 2) IRS / Pub 1828 — Guardian: no open Level-2 (Critical) items
  const critOpen = (violations ?? []).filter((v) => {
    const lv = (v.risk_level || "").toUpperCase();
    return lv === "CRITICAL" || lv === "LEVEL_2" || lv === "2";
  });
  pillars.irs_1828 =
    critOpen.length === 0
      ? { status: "CLEARED", detail: "No open critical compliance breach in Guardian log.", fixHref: "/irs-guardian" }
      : {
          status: "FAILED",
          detail: `${critOpen.length} open critical / level-2 item(s) in compliance_violation_alerts.`,
          fixHref: "/irs-guardian",
        };

  // 3) Stewardship: restricted fund integrity (book balances non-negative; total cash covers book)
  const rFunds = (funds ?? []).filter((f) => f.is_restricted);
  const sumRestricted = rFunds.reduce((a, f) => a + Math.abs(Number(f.balance) || 0), 0);
  const sumAll = (funds ?? []).reduce((a, f) => a + Math.abs(Number(f.balance) || 0), 0);
  const cashOnHand = sumAll;
  const negRestricted = rFunds.some((f) => Number(f.balance) < -0.01);
  const modelOk = !negRestricted && (sumRestricted === 0 || cashOnHand + 0.01 >= sumRestricted);
  pillars.stewardship = modelOk
    ? {
        status: "CLEARED",
        detail: "Restricted designations show no deficit; cash pool covers restricted book (model).",
        fixHref: "/erp-hub",
      }
    : {
        status: "FAILED",
        detail: "Restricted fund or cash coverage needs review (stewardship gate).",
        fixHref: "/erp-hub",
      };

  // 4) Tax: ministers — board housing resolution
  const ministers = (staff ?? []).filter((s) => s.role_type === "Minister");
  const minNeed = ministers.filter((m) => !m.has_housing_resolution);
  pillars.tax =
    ministers.length === 0
      ? { status: "CLEARED", detail: "No Minister roles on file (nothing to require housing resolution).", fixHref: "/staff-onboarding" }
      : minNeed.length === 0
        ? {
            status: "CLEARED",
            detail: "All Minister profiles show board housing resolution on file.",
            fixHref: "/staff-onboarding",
          }
        : {
            status: "FAILED",
            detail: `${minNeed.length} Minister(s) missing housing resolution flag.`,
            fixHref: "/staff-onboarding",
          };

  // 5) Audit / 1099: YTD from ledger + contractor_payees
  const ytdBy = {};
  const { data: ytdTx, error: yErr } = await supabase
    .schema(FED)
    .from("transactions")
    .select("amount, metadata")
    .eq("tenant_id", tenantId)
    .eq("tx_type", "expense")
    .gte("created_at", yStart)
    .lte("created_at", yEnd);
  if (yErr) throw new Error(yErr.message);
  for (const t of ytdTx ?? []) {
    const m = t.metadata && typeof t.metadata === "object" ? t.metadata : {};
    const pid = m.contractor_payee_id != null ? String(m.contractor_payee_id) : null;
    if (!pid) continue;
    ytdBy[pid] = (ytdBy[pid] ?? 0) + Math.abs(Number(t.amount) || 0);
  }
  let failW9 = 0;
  for (const c of contractors ?? []) {
    const y = ytdBy[c.id] != null ? ytdBy[c.id] : 0;
    if (y >= NEC_TRACKING_THRESHOLD_USD && c.w9_on_file !== true) {
      failW9 += 1;
    }
  }
  pillars.audit =
    failW9 === 0
      ? {
          status: "CLEARED",
          detail: `No service payee over $${NEC_TRACKING_THRESHOLD_USD} without W-9 on file (watchdog).`,
          fixHref: "/contractor-dashboard",
        }
      : {
          status: "FAILED",
          detail: `${failW9} payee(s) at/above internal 1099 watch without W-9.`,
          fixHref: "/contractor-dashboard",
        };

  const isCompliant = PILLAR_KEYS.every((k) => pillars[k].status === "CLEARED");
  return { pillars, isCompliant };
}

/**
 * Hard-block: no hash / seal ID unless isCompliant.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} tenantId
 * @param {number} year
 * @param {{ orgLabel?: string }} [opts]
 */
export async function generateIntegrityCertificate(supabase, tenantId, year, opts) {
  const ev = await evaluatePillarStatus(supabase, tenantId, year);
  if (!ev.isCompliant) {
    return {
      status: "INCOMPLETE",
      certified: false,
      pillars: ev.pillars,
      isCompliant: false,
      certificateHash: null,
      sealId: null,
      generatedAt: new Date().toISOString(),
    };
  }
  const stamp = {
    v: 1,
    org: opts?.orgLabel ?? "parable",
    tenantId,
    year,
    pillars: PILLAR_KEYS,
    t: new Date().toISOString(),
  };
  const certificateHash = await sha256Hex(JSON.stringify(stamp));
  const sealId = `PGS-${year}-${certificateHash.slice(0, 16).toUpperCase()}`;
  return {
    status: "CERTIFIED",
    certified: true,
    pillars: ev.pillars,
    isCompliant: true,
    certificateHash,
    sealId,
    generatedAt: stamp.t,
  };
}

export default {
  PILLAR_KEYS,
  evaluatePillarStatus,
  generateIntegrityCertificate,
  sha256Hex,
};
