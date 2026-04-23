// PARABLE: Ledger - AI threshold logic ("bouncer" for the Autonomous Engine)
// Filters whether the controller may book/reconcile without human sign-off.

/**
 * @typedef {{ maxAmount: number, confidence: number }} AutonomousThresholdSettings
 *   - maxAmount: max absolute dollars the AI may auto-apply; 0 = no dollar cap (unlimited for this rule)
 *   - confidence: 0-100, minimum match certainty required (AI certainty compared as 0-1)
 */

/**
 * @param {number} n
 * @returns {number} 0-1
 */
function toUnitConfidence(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 0;
  if (x > 1) return Math.min(1, x / 100);
  return Math.max(0, Math.min(1, x));
}

/**
 * @param {{ amount?: number }} transaction
 * @param {number} aiCertainty — 0-1 (or 0-100, normalized)
 * @param {AutonomousThresholdSettings} settings
 * @returns {{ action: 'AUTO_BOOK'|'REQUIRE_HUMAN_REVIEW', status: 'CLEARED'|'PENDING', reason?: string }}
 */
export const validateAutonomousAction = (transaction, aiCertainty, settings) => {
  const amt = Math.abs(Number(transaction?.amount ?? 0));
  const maxA = Math.max(0, Number(settings?.maxAmount ?? 0));
  const isUnderLimit = maxA <= 0 || amt <= maxA;

  const minConf = toUnitConfidence(settings?.confidence ?? 95);
  const cert = toUnitConfidence(aiCertainty);
  const isHighlyConfident = cert >= minConf;

  if (isUnderLimit && isHighlyConfident) {
    return { action: "AUTO_BOOK", status: "CLEARED" };
  }
  return {
    action: "REQUIRE_HUMAN_REVIEW",
    status: "PENDING",
    reason: !isUnderLimit ? "Exceeds Dollar Threshold" : "Low AI Confidence Score",
  };
};

/**
 * Categorize why an item is in the intervention list (for visuals)
 * @param {object} transaction
 * @param {number} aiCertainty
 * @param {AutonomousThresholdSettings} settings
 */
export const interventionFrictionFlags = (transaction, aiCertainty, settings) => {
  const amt = Math.abs(Number(transaction?.amount ?? 0));
  const maxA = Math.max(0, Number(settings?.maxAmount ?? 0));
  const overDollar = maxA > 0 && amt > maxA;
  const minConf = toUnitConfidence(settings?.confidence ?? 95);
  const cert = toUnitConfidence(aiCertainty);
  const lowConfidence = cert < minConf;
  return { overDollar, lowConfidence };
};

export default { validateAutonomousAction, interventionFrictionFlags };
