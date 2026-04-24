// PARABLE: Autonomous Close Engine - Logic Chain (virtual controller)
// Sequentially runs: Auto-Book -> IRS Guardian (Pub. 1828) -> Reconciliation -> Stewardship.
// Plaid-sourced lines carry metadata.parable_verification_state = "unverified" until you clear them in close.
// Wires to autonomousController + autonomousEngineCore. Use from Node cron, workers, or tests.

import {
  aiAutoBookTransactions,
  runGuardianAIScan,
  autoReconcileBank,
  runStewardshipCheck,
} from "./autonomousController.js";
import { buildBoardPackageDescriptor } from "./autonomousEngineCore.js";

/**
 * Gate 1 — match bank / stream lines to COA (heuristic engine).
 * @param {string} tenantId
 * @param {object} [bookOpts] — bankLines, coa; see aiAutoBookTransactions
 */
export async function autoBookTransactions(tenantId, bookOpts) {
  const r = await aiAutoBookTransactions(tenantId, bookOpts);
  const d = r.detail;
  const byLines = Array.isArray(d?.lines) ? d.lines.length : null;
  const count = byLines != null ? byLines : Number((d?.cleared ?? 0) + (d?.reviewCount ?? 0)) || 0;
  return { status: r.status, count, raw: r };
}

/**
 * Gate 2 — compliance pause if open / critical items would block the sequence.
 * @param {string} tenantId
 * @param {{ openViolationCount?: number, criticalCount?: number }} [complianceOpts]
 */
export async function runIrsGuardianScan(tenantId, complianceOpts = {}) {
  const r = await runGuardianAIScan(tenantId, complianceOpts);
  const open = Number(complianceOpts.openViolationCount ?? 0) || 0;
  const crit = Number(complianceOpts.criticalCount ?? 0) || 0;
  const violations = r.status === "PAUSED" ? Math.max(1, open, crit) || 1 : open;
  return { ...r, violations, openViolationCount: open, criticalCount: crit };
}

/**
 * Gate 3 — bank/ledger pair sanity (fuzzy = human review).
 * @param {string} tenantId
 * @param {object} [recOpts] — recState; see autoReconcileBank
 */
export async function reconcileLedger(tenantId, recOpts) {
  const r = await autoReconcileBank(tenantId, recOpts);
  return { ...r, isBalanced: r.status === "CLEARED" };
}

/**
 * Gate 4 — restricted / donor intent (stewardship).
 * @param {string} tenantId
 * @param {object} [s] — noDeficitLeak, releaseMatchesExpense; see runStewardshipCheck
 */
export async function verifyRestrictedFunds(tenantId, s) {
  const r = await runStewardshipCheck(tenantId, s);
  return { ...r, isIntact: r.status === "CLEARED" };
}

/**
 * @param {string} tenantId
 * @param {{
 *   autoBook?: Parameters<typeof autoBookTransactions>[1],
 *   compliance?: { openViolationCount?: number, criticalCount?: number },
 *   reconcile?: { recState?: { perfectMatches?: number, fuzzyMatches?: number } },
 *   stewardship?: { noDeficitLeak?: boolean, releaseMatchesExpense?: boolean },
 *   yearMonth?: string,
 * }} [opts]
 */
export async function runVirtualController(tenantId, opts = {}) {
  const t = new Date();
  const stamp = t.toTimeString().slice(0, 8);
  console.log(`[${stamp}] Initializing Virtual Controller (tenant: ${String(tenantId).slice(0, 8)}…)...`);

  const yearMonth = opts.yearMonth ?? t.toISOString().slice(0, 7);

  const bookStatus = await autoBookTransactions(tenantId, opts.autoBook);

  const complianceStatus = await runIrsGuardianScan(tenantId, opts.compliance);
  if (complianceStatus.violations > 0) {
    return {
      status: "HALTED",
      reason: "Compliance Breach Detected",
      bookStatus,
      complianceStatus,
    };
  }

  const reconStatus = await reconcileLedger(tenantId, opts.reconcile);
  const stewardshipStatus = await verifyRestrictedFunds(tenantId, opts.stewardship);

  return {
    status: "READY_FOR_SEAL",
    summary: {
      booked: bookStatus.count,
      reconciled: reconStatus.isBalanced,
      stewardship: stewardshipStatus.isIntact,
    },
    bookStatus,
    complianceStatus,
    reconStatus,
    stewardshipStatus,
    vault: buildBoardPackageDescriptor(tenantId, yearMonth),
  };
}

/**
 * Persist latest dry-run / health output for the CFO path (read by desktop jobs or a future API).
 * Node / server only; uses dynamic import so Next client bundles never pull `fs` from this file.
 * @param {unknown} report
 * @returns { Promise<{ ok: true, file: string } | { ok: false, error: string }> }
 */
export async function stageReportForVault(report) {
  if (typeof process === "undefined" || !/** @type {import('node:process')} */ (process).versions?.node) {
    return { ok: false, error: "stageReportForVault requires Node" };
  }
  try {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const { cwd } = await import("node:process");
    const dir = join(cwd(), "data");
    await mkdir(dir, { recursive: true });
    const file = join(dir, "sunday-sovereign-health.json");
    const payload = {
      report,
      stagedAt: new Date().toISOString(),
    };
    await writeFile(file, JSON.stringify(payload, null, 2), "utf8");
    return { ok: true, file };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export default { runVirtualController, stageReportForVault, autoBookTransactions, runIrsGuardianScan, reconcileLedger, verifyRestrictedFunds };
