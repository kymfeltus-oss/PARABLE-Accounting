/**
 * PARABLE — 1099-NEC "contractor watchdog" (audit trail + threshold hints)
 *
 * **2026+ (OBBBA)**: 1099-NEC reporting threshold for many payments is $2,000 (not $600).
 * This module’s `NEC_TRACKING_THRESHOLD_USD` matches that product narrative. Confirm
 * your facts with a CPA; attorneys and some payee types are exceptions. Not legal advice.
 *
 * @module contractorTracker
 */

/** Internal monitoring threshold (USD) — "Contractor Watchdog" scenario */
export const NEC_TRACKING_THRESHOLD_USD = 2000;

/** "Approach" window under threshold (amber warning) */
export const APPROACH_WINDOW_USD = 500;

/**
 * Aggregate of all payment rows (one vendor or many — legacy single-bucket)
 * @param {Array<{ amount: number }>} payments
 */
export const monitorContractorSpend = (payments) => {
  const list = Array.isArray(payments) ? payments : [];
  const totalSpent = list.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remaining = round2(NEC_TRACKING_THRESHOLD_USD - totalSpent);

  return {
    totalSpent: round2(totalSpent),
    needs1099: totalSpent >= NEC_TRACKING_THRESHOLD_USD,
    status: totalSpent >= NEC_TRACKING_THRESHOLD_USD ? "CRITICAL: Filing required (watchdog)" : "Safe: under watchdog threshold",
    warning:
      remaining > 0 && remaining < APPROACH_WINDOW_USD
        ? `Approaching internal limit: $${round2(remaining).toFixed(0)} under $${NEC_TRACKING_THRESHOLD_USD}`
        : null,
  };
};

/**
 * Entity types: corporations are often *not* subject to 1099-NEC from payers, but
 * there are exceptions (e.g. legal/medical, facts-specific). "Corporation filter"
 * is a simplistic UX hint only.
 */
export const PAYEE_TYPES = /** @type {const} */ ({
  SOLE_PROPRIETOR: "sole_proprietor",
  SINGLE_LLC: "single_member_llc",
  MULTI_LLC: "multi_member_llc",
  PARTNERSHIP: "partnership",
  C_CORP: "c_corporation",
  S_CORP: "s_corporation",
  UNKNOWN: "unclassified",
});

/**
 * Simplistic: treat standard C / S as "likely off 1099-NEC hook" in product UI; attorney/pro paths override below.
 * @param {string} payeeType
 * @returns {boolean}
 */
export const isCorporateLikelyExemptFromNecPayerObligation = (payeeType) => {
  const t = String(payeeType || "").toLowerCase();
  return t === "c_corporation" || t === "s_corporation" || t === "c_corp" || t === "s_corp";
};

/**
 * @param {string} serviceCategory
 */
export const isAttorneyOrProCategory = (serviceCategory) => {
  const c = String(serviceCategory || "").toLowerCase();
  return c === "legal" || c === "attorney" || c === "legal_professional";
};

/**
 * Full per-vendor assessment for dashboard (colors, batch hints).
 * @param {{
 *   ytdUsd: number;
 *   w9OnFile: boolean;
 *   payeeType: string;
 *   serviceCategory?: string;
 * }} p
 * @returns {{
 *   ytd: number;
 *   progress: number;
 *   overThreshold: boolean;
 *   corporateExempt: boolean;
 *   filingLikely: boolean;
 *   batchEligibility: boolean;
 *   w9Compliant: boolean;
 *   uiTone: 'safe' | 'approach' | 'amber' | 'red' | 'exempt';
 *   copy: { headline: string; sub?: string | null };
 * }}
 */
export const assessVendorNec = (p) => {
  const ytd = round2(Math.max(0, Number(p.ytdUsd) || 0));
  const w9 = p.w9OnFile === true;
  const payeeType = p.payeeType || PAYEE_TYPES.UNKNOWN;
  const legalLane = isAttorneyOrProCategory(p.serviceCategory);
  const corporate = isCorporateLikelyExemptFromNecPayerObligation(payeeType);
  /** Simplistic: corporation often no NEC from church; except legal lane still shows risk. */
  const corporateExempt = corporate && !legalLane;

  const over = ytd >= NEC_TRACKING_THRESHOLD_USD;
  const progress = Math.min(100, (ytd / NEC_TRACKING_THRESHOLD_USD) * 100);

  let uiTone = "safe";
  if (corporateExempt && ytd > 0) uiTone = "exempt";
  else if (!w9 && ytd > 0) {
    if (ytd >= NEC_TRACKING_THRESHOLD_USD) uiTone = "red";
    else if (NEC_TRACKING_THRESHOLD_USD - ytd < APPROACH_WINDOW_USD) uiTone = "approach";
    else uiTone = "amber";
  } else if (w9 && ytd > 0) {
    uiTone = ytd >= NEC_TRACKING_THRESHOLD_USD ? (corporateExempt ? "exempt" : "safe") : "safe";
  }

  const filingLikely = !corporateExempt && over; // "needs attention" in UI
  const w9Compliant = w9 || ytd < 0.01;

  const batchEligibility = over && w9 && !corporateExempt;

  let headline = "Tracking";
  if (corporateExempt && ytd > 0) {
    headline = "Entity filter: C/S corp (likely no 1099-NEC from you — confirm facts)";
  } else if (!w9 && ytd > 0) {
    if (ytd >= NEC_TRACKING_THRESHOLD_USD) headline = "Compliance risk: W-9 missing at threshold";
    else if (NEC_TRACKING_THRESHOLD_USD - ytd < APPROACH_WINDOW_USD) headline = "Approaching limit — add W-9";
    else headline = "W-9 missing; payment(s) on file";
  } else if (w9 && ytd > 0) {
    headline = "W-9 on file";
  }

  const copy = {
    headline,
    sub: legalLane ? "Legal/pro: facts may require information returns — CPA review" : null,
  };

  return {
    ytd,
    progress,
    overThreshold: over,
    corporateExempt,
    filingLikely,
    batchEligibility,
    w9Compliant: w9 || ytd < 0.01,
    uiTone,
    copy,
  };
};

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

export { round2 as roundContractorMoney };
