// PARABLE: Instant guest / musician honorarium — real-time gate check before post + transfer stub
// Integrate Stripe/ACH: replace `initiateTransfer` in deps.

import { NEC_TRACKING_THRESHOLD_USD } from "./contractorTracker.js";

/**
 * @typedef {{ ytdSpend: number, w9OnFile: boolean, displayName?: string }} ContractorSlice
 * @typedef {{ getContractorData: (id: string) => Promise<ContractorSlice & { paymentInfo?: unknown }>, recordTransaction: (p: object) => Promise<unknown>, initiateTransfer?: (paymentInfo: unknown, amount: number) => Promise<{ id: string }> }} HonorariumServices
 */

/**
 * Green Room policy: block only if **already** at/above threshold with no W-9.
 * If this payment **crosses** the threshold, allow it but flag W-9 nudge + hold next payout (see MobilePayoutCore).
 * @param {number} ytd
 * @param {number} amount
 * @param {boolean} w9OnFile
 * @param {number} [threshold]
 */
export function evaluateHonorariumGates(ytd, amount, w9OnFile, threshold) {
  const t = threshold != null ? threshold : NEC_TRACKING_THRESHOLD_USD;
  const a = Math.max(0, Number(amount) || 0);
  const y = Math.max(0, Number(ytd) || 0);
  const next = y + a;
  if (w9OnFile) {
    return { allow: true, status: "OK", nextTotal: next, reason: null, crossingThreshold: false, holdNext: false };
  }
  if (y >= t) {
    return {
      allow: false,
      status: "BLOCKED",
      nextTotal: next,
      reason: "Already at or over the $2,000 watch without a W-9; clear before another honorarium in product policy.",
      cfo: "W-9 + vault, then remove payout hold.",
    };
  }
  if (next >= t) {
    return {
      allow: true,
      status: "CROSSING",
      nextTotal: next,
      reason: "This payment crosses the internal 1099-NEC watch — queue W-9 and hold the next instant payout until filed.",
      crossingThreshold: true,
      holdNext: true,
    };
  }
  return { allow: true, status: "OK", nextTotal: next, reason: null, crossingThreshold: false, holdNext: false };
}

/**
 * @param {string} contractorId
 * @param {number} amount
 * @param {HonorariumServices} deps
 */
export async function processInstantPayout(contractorId, amount, deps) {
  const a = Math.abs(Number(amount) || 0);
  if (a <= 0) {
    return { status: "INVALID", reason: "Amount must be positive" };
  }
  const contractor = await deps.getContractorData(contractorId);
  const ytd = Math.max(0, Number(contractor.ytdSpend) || 0);
  const w9 = contractor.w9OnFile === true;
  const ev = evaluateHonorariumGates(ytd, a, w9, NEC_TRACKING_THRESHOLD_USD);
  if (!ev.allow) {
    return {
      status: "BLOCKED",
      reason: ev.reason,
      action: "Request W-9 via the vault; watchdog blocks until cleared.",
    };
  }
  /** @type {boolean} */ const needsW9Followup = ev.crossingThreshold === true;
  let transferId = "no_transfer";
  if (typeof deps.initiateTransfer === "function" && contractor.paymentInfo != null) {
    const tr = await deps.initiateTransfer(contractor.paymentInfo, a);
    transferId = tr && tr.id ? tr.id : transferId;
  }
  await deps.recordTransaction({
    contractorPayeeId: contractorId,
    amount: a,
    accountCode: 7100,
    needsW9Followup,
  });
  return { status: "SUCCESS", transferId, nextYtd: ytd + a, needsW9Followup: !!needsW9Followup };
}

export { NEC_TRACKING_THRESHOLD_USD };

export default {
  evaluateHonorariumGates,
  processInstantPayout,
  NEC_TRACKING_THRESHOLD_USD,
};
