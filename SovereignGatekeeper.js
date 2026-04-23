// PARABLE: Ledger — Sovereign month-end close (Sovereign Close) gatekeeper
// Five gates: Input → Shield (AI) → Reconciliation → Restricted funds → Final seal
// This module is pure; persistence and hashing live in the app + DB.
// Vision: governance platform — book + AI, housing shield, board vault, donor trust via the seal, not "just accounting."

/**
 * @typedef {'GATE_INPUT'|'GATE_SHIELD'|'GATE_RECONCILE'|'GATE_RESTRICTED'|'GATE_SEAL'} SovereignGate
 */

/** @type {SovereignGate[]} */
export const SOVEREIGN_GATES = ["GATE_INPUT", "GATE_SHIELD", "GATE_RECONCILE", "GATE_RESTRICTED", "GATE_SEAL"];

/**
 * @param {SovereignGate} g
 * @returns {number}
 */
export function getGateIndex(g) {
  return SOVEREIGN_GATES.indexOf(g);
}

/**
 * @param {SovereignGate} current
 * @returns {SovereignGate | null} null = already at or past terminal, or invalid
 */
export function getNextGateId(current) {
  const i = getGateIndex(current);
  if (i < 0 || i >= SOVEREIGN_GATES.length - 1) return null;
  return SOVEREIGN_GATES[i + 1];
}

/**
 * Rich gate payload (partial allowed). Names align with UI / Supabase fetches.
 * @typedef {object} GateData
 * @property {number} [pendingAuditCount] - Audit Guard: rows missing receipt or W-9 (high spend)
 * @property {boolean} [givingCategorized] - tithes/streams/venue giving bucketed
 * @property {boolean} [apBillsEntered] - AP has bills for the month
 * @property {number} [unresolvedViolations] - any open compliance rows
 * @property {number} [unresolvedCriticalViolations] - CRITICAL or POLIT* not resolved
 * @property {number} [level2ViolationCount] - e.g. HIGH (optional breach email tier)
 * @property {boolean} [boardOverrideAcknowledged] - if true, may pass Shield with documented board sign-off
 * @property {boolean} [monthSoftLocked] - no new GL after Gate 2 engaged (optional)
 * @property {boolean} [bankReconciled]
 * @property {boolean} [apReconciled]
 * @property {boolean} [arReconciled]
 * @property {number} [contractorsOver2kUnverified] - 1099 watch: YTD to payee &gt; $2k, no W-9
 * @property {number} [interventionQueuePending] - human intervention inbox (AI review &gt; 0 blocks Gate 2)
 * @property {boolean} [restrictedDeficit] - do not use restricted to plug ops hole
 * @property {boolean} [donorIntentMatch] - restricted releases line up with program expense
 * @property {boolean} [adminCertified] - bookkeeper
 * @property {boolean} [secondSignerDone] - treasurer or pastor
 * @property {boolean} [vaultGeneralLiabilityOk] - false if INSURANCE / GENERAL_LIABILITY in vault is expired
 */

/**
 * Evaluate a single gate (current step must be satisfied to leave it).
 * @param {SovereignGate} gate
 * @param {GateData} d
 * @returns {{ ok: boolean, code?: string, message?: string }}
 */
export function evaluateCurrentGate(gate, d) {
  const g = d ?? {};
  switch (gate) {
    case "GATE_INPUT": {
      const aud = g.pendingAuditCount ?? 0;
      if (aud > 0) {
        return {
          ok: false,
          code: "INPUT_AUDIT",
          message: "Audit Guard: one or more items are pending (receipt, W-9, or other documentation).",
        };
      }
      if (g.givingCategorized === false) {
        return { ok: false, code: "INPUT_GIVING", message: "Categorize tithes, streams, and in-person giving for the period." };
      }
      if (g.apBillsEntered === false) {
        return { ok: false, code: "INPUT_AP", message: "Enter or import AP bills (maintenance, guest honoraria, operations) for the pre-close month." };
      }
      return { ok: true };
    }
    case "GATE_SHIELD": {
      const n = g.unresolvedViolations ?? 0;
      if (g.boardOverrideAcknowledged) {
        return { ok: true };
      }
      if (n > 0) {
        const crit = g.unresolvedCriticalViolations ?? 0;
        const extra = crit > 0 ? " (includes critical or campaign-intervention class flags.)" : "";
        return {
          ok: false,
          code: "SHIELD_OPEN",
          message: `Internal Controls / Pub 1828 heuristics: ${n} open item(s).${extra} Resolve, or obtain board-signed override for a documented exception path.`,
        };
      }
      return { ok: true };
    }
    case "GATE_RECONCILE": {
      const intv = g.interventionQueuePending ?? 0;
      if (intv > 0) {
        return {
          ok: false,
          code: "REC_INTERVENTION",
          message: `Clear the human intervention queue (${intv} item(s) need confirmation) before bank reconciliation is considered complete.`,
        };
      }
      if (!g.bankReconciled) {
        return { ok: false, code: "REC_BANK", message: "Reconcile bank and card statements to the ledger." };
      }
      if (!g.apReconciled || !g.arReconciled) {
        return { ok: false, code: "REC_SUB", message: "Reconcile AP and AR (pledges / unpaid bills) for the month." };
      }
      const c = g.contractorsOver2kUnverified ?? 0;
      if (c > 0) {
        return {
          ok: false,
          code: "REC_1099",
          message: `Contractor 1099 watch: ${c} high-spend line(s) without active W-9 / watchlist coverage.`,
        };
      }
      return { ok: true };
    }
    case "GATE_RESTRICTED": {
      if (g.restrictedDeficit) {
        return { ok: false, code: "REST_USE", message: "Restricted fund integrity: do not use designated cash to cover unrestricted deficits." };
      }
      if (g.donorIntentMatch === false) {
        return { ok: false, code: "REST_INTENT", message: "Donor intent: releases from restriction must match actual program or capital spend." };
      }
      return { ok: true };
    }
    case "GATE_SEAL": {
      if (g.vaultGeneralLiabilityOk === false) {
        return {
          ok: false,
          code: "SEAL_VAULT_GL",
          message:
            "Sovereign Vault: General Liability policy on file is expired. Upload a current certificate or update the expiration date in the vault before sealing.",
        };
      }
      if (!g.adminCertified) {
        return { ok: false, code: "SEAL_ADMIN", message: "Lead bookkeeper or admin must certify the close pack." };
      }
      if (!g.secondSignerDone) {
        return { ok: false, code: "SEAL_2", message: "Second sign-off (treasurer or lead pastor) required to vault-lock the month." };
      }
      return { ok: true };
    }
    default:
      return { ok: false, code: "UNKNOWN_GATE", message: "Unknown gate." };
  }
}

/**
 * @param {SovereignGate} currentGate
 * @param {GateData} gateData
 * @returns {{ status: 'BLOCKED'|'ADVANCE'|'COMPLETE', next?: SovereignGate, message?: string, code?: string, exitGate?: SovereignGate }}
 */
export function advanceToNextGate(currentGate, gateData) {
  const v = evaluateCurrentGate(currentGate, gateData);
  if (!v.ok) {
    return { status: "BLOCKED", message: v.message, code: v.code, exitGate: currentGate };
  }
  if (currentGate === "GATE_SEAL") {
    return { status: "COMPLETE", message: "Month sealed; CFO pack can be watermarked and archived.", exitGate: "GATE_SEAL" };
  }
  const next = getNextGateId(currentGate);
  if (next) {
    return { status: "ADVANCE", next, exitGate: currentGate };
  }
  return { status: "COMPLETE" };
}

/**
 * Whether Gate 1 (Shield) can release Gate 2 (reconciliation) — for UI locks.
 * @param {GateData} gateData
 */
export function isShieldPassingForReconciliation(gateData) {
  return evaluateCurrentGate("GATE_SHIELD", gateData).ok;
}

export default {
  SOVEREIGN_GATES,
  getNextGateId,
  getGateIndex,
  evaluateCurrentGate,
  advanceToNextGate,
  isShieldPassingForReconciliation,
};
