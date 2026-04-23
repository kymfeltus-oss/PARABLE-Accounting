// PARABLE: Ledger — Autonomous close engine (rules, confidence, compliance pause, pack stub)
// Not a substitute for human review of material items or legal/tax sign-off.

/** Minimum confidence to auto-post without review (0–1). */
export const AUTO_RECONCILE_THRESHOLD = 1.0;
/** Below this, route to human review. */
export const HUMAN_REVIEW_FLOOR = 0.95;

/**
 * Heuristic map: substrings in bank / card memo → default COA (integer codes from UCOA).
 * Extend per tenant in DB later; this is the on-device ruleset.
 */
export const DEFAULT_BANK_TO_COA_RULES = [
  { re: /twitch|youtube|stream\s*labs|patreon|tithe\.?ly|subsplash/i, accountCode: 4020, label: "Digital / streaming" },
  { re: /electric|duke energy|pge|power|utility gas|water\s*sewer|city of.*utilities/i, accountCode: 6050, label: "Utilities" },
  { re: /honorarium|speakers?|guest/i, accountCode: 7100, label: "Guest / honoraria" },
  { re: /mortgage|jpmc\s*mort|wells fargo home/i, accountCode: 6010, label: "Mortgage interest" },
  { re: /amazon|staples|officemax|office supply/i, accountCode: 8100, label: "Office" },
  { re: /missions|bapti(st)?|gospel|field partner/i, accountCode: 7010, label: "Missions" },
];

/**
 * @param {string} description
 * @param {Array<{ account_code: number, account_name?: string }>} coaList
 * @param {Array<typeof DEFAULT_BANK_TO_COA_RULES[0]>} [customRules]
 * @returns {{ accountCode: number | null, confidence: number, label: string, needsHumanReview: boolean, reason: string }}
 */
export function matchBankDescriptionToCoa(description, coaList, customRules) {
  const text = String(description ?? "").trim();
  if (!text) {
    return {
      accountCode: null,
      confidence: 0,
      label: "",
      needsHumanReview: true,
      reason: "Empty description",
    };
  }
  const rules = (customRules?.length ? customRules : DEFAULT_BANK_TO_COA_RULES);

  let best = { accountCode: null, confidence: 0, label: "Unmatched" };
  for (const r of rules) {
    const re = r.re instanceof RegExp ? r.re : new RegExp(r.re, "i");
    if (re.test(text)) {
      const exists = (coaList || []).some((a) => Number(a.account_code) === Number(r.accountCode));
      const conf = exists ? 1.0 : 0.6;
      if (conf > best.confidence) {
        best = { accountCode: r.accountCode, confidence: conf, label: r.label || "" };
      }
    }
  }

  const needsHumanReview = best.confidence < HUMAN_REVIEW_FLOOR;
  return {
    accountCode: best.accountCode,
    confidence: best.confidence,
    label: best.label,
    needsHumanReview,
    reason: needsHumanReview
      ? "Sub-0.95 confidence, missing COA line, or no rule match"
      : "Rule + COA present (1.0) — auto-reconcile safe",
  };
}

/**
 * @param {Array<{ id?: string, amount: number, description: string }>} bankLines
 * @param {Array<{ account_code: number }>} coaList
 */
export function autoBookBankLines(bankLines, coaList) {
  const out = [];
  let cleared = 0;
  let review = 0;
  for (const line of bankLines || []) {
    const m = matchBankDescriptionToCoa(line.description, coaList);
    if (m.accountCode && m.confidence >= HUMAN_REVIEW_FLOOR && !m.needsHumanReview) {
      cleared += 1;
    } else if (m.accountCode) {
      review += 1;
    }
    out.push({ line, match: m });
  }
  const hasLowConfidence = out.some((o) => o.match.confidence < HUMAN_REVIEW_FLOOR);
  return {
    lines: out,
    reviewCount: review,
    cleared,
    status: hasLowConfidence && out.length ? "REVIEW" : "CLEARED",
  };
}

/**
 * @param {object} scanResult
 * @param {number} scanResult.openViolationCount
 * @param {number} scanResult.criticalCount
 * @returns {{ shouldPause: boolean, reason: string | null }}
 */
export function shouldPauseForComplianceScan(scanResult) {
  const n = Number(scanResult?.openViolationCount ?? 0) || 0;
  const c = Number(scanResult?.criticalCount ?? 0) || 0;
  if (c > 0) {
    return { shouldPause: true, reason: "Open CRITICAL / campaign-intervention class flags during autonomous close" };
  }
  if (n > 0) {
    return { shouldPause: true, reason: "Open compliance line items" };
  }
  return { shouldPause: false, reason: null };
}

/**
 * Simplified: all bank lines 100% matched in pairs (stub for production reconciliation engine).
 * @param {{ perfectMatches: number, fuzzyMatches: number } | undefined} recState
 */
export function evaluateReconciliationState(recState) {
  const s = recState || { perfectMatches: 0, fuzzyMatches: 0 };
  if (s.fuzzyMatches > 0) {
    return { status: "REVIEW", message: `${s.fuzzyMatches} row(s) under 95% match — human review` };
  }
  return { status: "CLEARED" };
}

/**
 * Restricted / stewardship: stub checks (wire to fund balances later).
 * @param {{ noDeficitLeak: boolean, releaseMatchesExpense: boolean } | undefined} s
 */
export function verifyStewardshipIntegrity(s) {
  const x = s || { noDeficitLeak: true, releaseMatchesExpense: true };
  if (!x.noDeficitLeak || !x.releaseMatchesExpense) {
    return { status: "BLOCKED", code: "RESTRICTED", message: "Restricted-fund or donor-intent check failed" };
  }
  return { status: "CLEARED" };
}

/**
 * Board PDF + vault hand-off (stub: returns paths for app to implement with storage).
 * @param {string} tenantId
 * @param {string} yearMonth
 */
export function buildBoardPackageDescriptor(tenantId, yearMonth) {
  return {
    status: "PENDING_VAULT",
    suggestedVaultKey: `sovereign-vault/${tenantId}/close/${yearMonth}/board-packet.pdf`,
    generatedAt: new Date().toISOString(),
    note: "Server job should render PDF, upload to private bucket, then attach to compliance vault record.",
  };
}

export default {
  matchBankDescriptionToCoa,
  autoBookBankLines,
  shouldPauseForComplianceScan,
  evaluateReconciliationState,
  verifyStewardshipIntegrity,
  buildBoardPackageDescriptor,
  HUMAN_REVIEW_FLOOR,
  AUTO_RECONCILE_THRESHOLD,
  DEFAULT_BANK_TO_COA_RULES,
};
