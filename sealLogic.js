// PARABLE: Ledger — Sovereign Seal (smart badge) verification
// Institutional checks for public "Platinum" tier; not a legal attestation.
// Year defaults to current calendar year unless overridden (e.g. fiscal).
//
// Platform posture: governance + compliance (AI guardrails, housing shield, board vault, donor trust).

/**
 * @param {object} entry
 * @returns {boolean}
 */
function isEntryResolved(entry) {
  if (entry == null) return true;
  if (entry.resolved === true) return true;
  if (String(entry.status ?? "").toLowerCase() === "resolved") return true;
  if (String(entry.status ?? "").toLowerCase() === "acknowledged" && entry.treatAsClear) return true;
  return false;
}

/**
 * @param {object} entry
 * @returns {boolean}
 */
function isCriticalOpen(entry) {
  if (isEntryResolved(entry)) return false;
  const r = String(entry.risk_level ?? entry.severity ?? entry.risk ?? "").toUpperCase();
  if (r === "CRITICAL") return true;
  if (String(entry.violation_code ?? "").startsWith("POLIT")) return true;
  if (String(entry.violation_code ?? "").startsWith("INURE-01")) return true;
  return false;
}

/**
 * @typedef {object} AuditContext
 * @property {boolean} [hasHousingResolution] — board / housing package on file for the year
 * @property {number} [ubiTotal] — annual unrelated business income (gross) modeled in-app
 * @property {boolean} [has990T] — org attests 990-T filed or not required
 */

/**
 * Public verification slug (path segment only; host is your app origin).
 * @param {string} tenantSlug
 */
export function buildPublicVerificationPath(tenantSlug) {
  const s = String(tenantSlug ?? "").replace(/^\/+/, "").replace(/\/+/g, "");
  return s ? `verify/${s}` : "verify";
}

/**
 * @param {Array<object>} complianceLog — e.g. compliance_violation_alerts rows: { status, risk_level, violation_code, ... }
 * @param {AuditContext} auditContext
 * @param {object} [opts]
 * @param {string} [opts.tenantId]
 * @param {string} [opts.tenantSlug]
 * @param {number} [opts.year] — year for copy/display
 */
export function getComplianceStatus(complianceLog, auditContext, opts) {
  const o = opts ?? {};
  const year = o.year ?? new Date().getFullYear();
  const list = Array.isArray(complianceLog) ? complianceLog : [];

  const activeViolations = list.filter((v) => !isEntryResolved(v));
  const criticalOpen = list.some((v) => isCriticalOpen(v));

  const hasHousing = Boolean(auditContext?.hasHousingResolution);
  const ubi = Number(auditContext?.ubiTotal ?? 0) || 0;
  const has990T = Boolean(auditContext?.has990T);
  const isUbiReportingSync = ubi < 1000 || has990T;

  const isVerified = activeViolations.length === 0 && hasHousing && isUbiReportingSync;

  /** @type {string[]} */
  const reasons = [];
  if (activeViolations.length > 0) {
    reasons.push(`${activeViolations.length} open compliance item(s) in the institutional log`);
  }
  if (criticalOpen) {
    reasons.push("Critical policy flag(s) require resolution before the Sovereign Seal can show as active");
  }
  if (!hasHousing) {
    reasons.push(`Housing / board resolution package for ${year} is not yet active on file`);
  }
  if (!isUbiReportingSync) {
    reasons.push("Unrelated business income is above the routine filing discussion threshold without a recorded 990-T attestation");
  }

  let tier = "platinum";
  if (!isVerified) {
    tier = criticalOpen ? "suspended" : "pending";
  }

  const tenantSlug = o.tenantSlug ?? "tenant";
  const publicSlug = buildPublicVerificationPath(tenantSlug);

  return {
    isVerified,
    tier,
    year,
    lastVerified: new Date().toISOString(),
    publicSlug,
    publicUrlPath: `/${publicSlug}`,
    reasons,
    hasCriticalOpen: criticalOpen,
    activeViolationCount: activeViolations.length,
  };
}

export default { getComplianceStatus, buildPublicVerificationPath };
