// PARABLE: Ledger — Virtual controller (orchestrates auto-close; e.g. cron on the 1st of month)
// Wires to autonomousEngineCore.js. Send treasurer alerts and vault PDFs from the host app.

import {
  autoBookBankLines,
  shouldPauseForComplianceScan,
  evaluateReconciliationState,
  verifyStewardshipIntegrity,
  buildBoardPackageDescriptor,
} from "./autonomousEngineCore.js";
import { sendComplianceAlert } from "./complianceAlertSystem.js";

/**
 * @param {string} _tenantId
 * @param {{ bankLines: Array<{ description: string, amount?: number }>, coa: Array<{ account_code: number }> }} [opts]
 */
export async function aiAutoBookTransactions(_tenantId, opts) {
  const o = opts ?? { bankLines: [], coa: [] };
  const r = autoBookBankLines(o.bankLines, o.coa);
  if (r.status === "REVIEW") {
    return { status: "REVIEW", detail: r, message: "Sub-0.95 match or review queue" };
  }
  return { status: "CLEARED", detail: r };
}

/**
 * @param {string} _tenantId
 * @param {{ openViolationCount?: number, criticalCount?: number }} [opts]
 */
export async function runGuardianAIScan(_tenantId, opts) {
  const c = opts ?? {};
  const p = shouldPauseForComplianceScan({
    openViolationCount: Number(c.openViolationCount ?? 0) || 0,
    criticalCount: Number(c.criticalCount ?? 0) || 0,
  });
  if (p.shouldPause) {
    return { status: "PAUSED", reason: p.reason, code: "COMPLIANCE" };
  }
  return { status: "CLEARED" };
}

/**
 * @param {string} _tenantId
 * @param {{ recState?: { perfectMatches: number, fuzzyMatches: number } }} [opts]
 */
export async function autoReconcileBank(_tenantId, opts) {
  const ev = evaluateReconciliationState(opts?.recState);
  if (ev.status === "REVIEW") {
    return { status: "REVIEW", message: ev.message };
  }
  return { status: "CLEARED" };
}

/**
 * @param {string} _tenantId
 * @param {{ noDeficitLeak?: boolean, releaseMatchesExpense?: boolean } | undefined} s
 */
export async function runStewardshipCheck(_tenantId, s) {
  return verifyStewardshipIntegrity(s);
}

/**
 * @param {string} tenantId
 * @param {string|number} month
 * @param {string|number} year
 * @param {object} [ctx]
 * @param {string} [ctx.treasurerEmail] — if compliance pauses, alert here
 * @param {{ bankLines: object[], coa: object[] }} [ctx.autoBook]
 * @param {{ openViolationCount: number, criticalCount: number }} [ctx.compliance]
 * @param {{ recState: { perfectMatches: number, fuzzyMatches: number } }} [ctx.reconcile]
 * @param {{ stewardship: { noDeficitLeak: boolean, releaseMatchesExpense: boolean } }} [ctx]
 * @param {function(object): void} [ctx.onStep] — live feed callback
 */
export async function initiateAutoClose(tenantId, month, year, ctx) {
  const c = ctx ?? {};
  const ym = `${String(year)}-${String(month).padStart(2, "0")}`;
  const log = typeof c.onStep === "function" ? c.onStep : () => {};

  const results = { gate_input: null, gate_shield: null, gate_reconcile: null, gate_restricted: null };

  const gi = await aiAutoBookTransactions(tenantId, c.autoBook);
  results.gate_input = gi;
  log({ gate: "GATE_INPUT", result: gi, at: new Date().toISOString() });

  const gs = await runGuardianAIScan(tenantId, c.compliance);
  results.gate_shield = gs;
  log({ gate: "GATE_SHIELD", result: gs, at: new Date().toISOString() });
  if (gs.status === "PAUSED" && c.treasurerEmail) {
    await sendComplianceAlert(
      {
        type: "Autonomous close — sequence paused (IRS / Pub 1828 heuristics)",
        code: "AUTO-PAUSE",
        risk: "CRITICAL",
        description: String(gs.reason ?? "Compliance check failed during Virtual Controller run."),
        correction: "Log into IRS Guardian, clear open flags, or record a board-authorized path before re-running the controller.",
        irsRef: "p1828-political",
      },
      c.treasurerEmail
    );
    return { status: "PAUSED", phase: "GATE_SHIELD", bottlenecks: results, data: results, vault: buildBoardPackageDescriptor(tenantId, ym) };
  }

  const gr = await autoReconcileBank(tenantId, c.reconcile);
  results.gate_reconcile = gr;
  log({ gate: "GATE_RECONCILE", result: gr, at: new Date().toISOString() });

  const grest = await runStewardshipCheck(tenantId, c.stewardship);
  results.gate_restricted = grest;
  log({ gate: "GATE_RESTRICTED", result: grest, at: new Date().toISOString() });

  const handoff = buildBoardPackageDescriptor(tenantId, ym);
  const board_package = handoff;
  log({ gate: "VAULT", result: { status: "PREPARED", handoff } });

  if (grest?.status === "BLOCKED") {
    return { status: "ACTION_REQUIRED", bottlenecks: results, data: { ...results, board_package }, vault: handoff };
  }
  if (gi.status === "REVIEW" || gr.status === "REVIEW") {
    return { status: "ACTION_REQUIRED", bottlenecks: results, data: { ...results, board_package }, vault: handoff, friction: "Human review (match or rec)" };
  }

  const canAutoAdvance =
    gi.status === "CLEARED" && gs.status === "CLEARED" && gr.status === "CLEARED" && grest?.status === "CLEARED";

  if (canAutoAdvance) {
    return { status: "READY_FOR_SEAL", data: { ...results, board_package }, vault: handoff, message: "Hand off to human Gate 5 (Sovereign Seal) & dual signature." };
  }
  return { status: "ACTION_REQUIRED", bottlenecks: results, data: { ...results, board_package } };
}

/**
 * @param {Date|number} [d]
 * @param {new () => number} [DateImpl]
 */
export function isFirstOfMonth(d, DateImpl) {
  const C = DateImpl || Date;
  const x = d == null ? new C() : new C(d);
  return x.getDate() === 1;
}

/**
 * @param {string} tenantId
 * @param {string} [yearMonth] — 'YYYY-MM' ; uses current 1st-of-month if omitted when invoked on day 1
 * @param {object} [fullCtx] — passed to initiateAutoClose; include month/year inside or parse yearMonth
 */
export async function runScheduledAutoSeal(tenantId, yearMonth, fullCtx) {
  const ctx = fullCtx ?? {};
  if (!ctx.force && !isFirstOfMonth()) {
    return { run: false, message: "Scheduler: only the 1st of month (pass ctx.force to test off-calendar)" };
  }
  const c = new Date();
  const y = yearMonth ? parseInt(String(yearMonth).split("-")[0] || String(c.getFullYear()), 10) : c.getFullYear();
  const m = yearMonth ? parseInt(String(yearMonth).split("-")[1] || "1", 10) : c.getMonth() + 1;
  return initiateAutoClose(tenantId, m, y, ctx);
}

export default {
  initiateAutoClose,
  aiAutoBookTransactions,
  runGuardianAIScan,
  autoReconcileBank,
  runStewardshipCheck,
  runScheduledAutoSeal,
  isFirstOfMonth,
};
