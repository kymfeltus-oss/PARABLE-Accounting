/**
 * PARABLE — EFTPS deposit / depositor schedule helpers
 *
 * IRS: Monthly vs semi-weekly deposit rule uses total employment tax liability
 * in the *lookback period* (often four consecutive calendar quarters) vs
 * a $50,000 threshold. This module keeps pure math; Supabase fetches & sums
 * live in `src/lib/eftpsReconciliation.ts`.
 *
 * @module depositLogic
 */

/** Form 941 context: aggregate employment taxes above this → next period semi-weekly. */
export const FEDERAL_DEPOSIT_LOOKBACK_THRESHOLD = 50_000;

/**
 * @param {number} lookbackLiabilityTotal
 * @returns { 'monthly' | 'semi-weekly' }
 */
export function getDepositSchedule(lookbackLiabilityTotal) {
  const n = Number(lookbackLiabilityTotal) || 0;
  if (n <= FEDERAL_DEPOSIT_LOOKBACK_THRESHOLD) return "monthly";
  return "semi-weekly";
}

/**
 * @param {number} lookbackLiabilityTotal
 * @returns {{ isMonthly: boolean, isSemiWeekly: boolean, schedule: 'monthly' | 'semi-weekly' }}
 */
export function getDepositorFlags(lookbackLiabilityTotal) {
  const schedule = getDepositSchedule(lookbackLiabilityTotal);
  return {
    isMonthly: schedule === "monthly",
    isSemiWeekly: schedule === "semi-weekly",
    schedule,
  };
}

/**
 * UI status for whether modeled liability is covered by detected EFTPS payments
 * in the same quarter (not a substitute for Treasury/bank actuals).
 *
 * @param {number} totalLiability
 * @param {number} paymentsDetected
 * @param {{ lookbackLiability?: number, thresholdUsd?: number } | undefined} [opts]
 *   lookbackLiability: used for monthly vs semi-weekly flag; if omitted, falls
 *   back to `totalLiability` (simplified, single-period proxy).
 * @returns {{
 *   isMonthly: boolean,
 *   isSemiWeekly: boolean,
 *   schedule: 'monthly' | 'semi-weekly',
 *   remainingBalance: number,
 *   isFullyPaid: boolean,
 *   status: 'SYNCED' | 'PENDING_DEPOSIT',
 *   color: string
 * }}
 */
export function getDepositStatus(totalLiability, paymentsDetected, opts) {
  const t = round2(Number(totalLiability) || 0);
  const p = round2(Math.max(0, Number(paymentsDetected) || 0));
  const rawLb = opts?.lookbackLiability;
  const lookback = round2(
    typeof rawLb === "number" && Number.isFinite(rawLb) ? rawLb : t
  );
  const { isMonthly, isSemiWeekly, schedule } = getDepositorFlags(lookback);
  const remainingBalance = round2(t - p);
  const isFullyPaid = remainingBalance <= 0;

  return {
    isMonthly,
    isSemiWeekly,
    schedule,
    remainingBalance,
    isFullyPaid,
    status: isFullyPaid ? "SYNCED" : "PENDING_DEPOSIT",
    color: isFullyPaid ? "var(--brand-glow)" : "#ef4444",
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
