/** Canonical task keys and labels for parable_ledger.close_checklists */

export type CloseTaskDef = {
  key: string;
  label: string;
  isSubItem?: boolean;
};

export const G1_CHECKLIST: CloseTaskDef[] = [
  { key: "g1_tithes_offerings", label: "All tithes and offerings posted" },
];

export const G2_CHECKLIST: CloseTaskDef[] = [
  { key: "g2_bank_reconciliations", label: "Bank reconciliations" },
  { key: "g2_restricted_accounts", label: "Reconcile restricted account" },
  { key: "g2_ap_recon", label: "Accounts Payable recon" },
  { key: "g2_ar_recon", label: "Accounts Receivable recon" },
];

export const G3_CHECKLIST: CloseTaskDef[] = [
  { key: "g3_ai_internal_controls", label: "Run AI internal controls feature" },
  { key: "g3_adjusting_entries", label: "Adjusting entries" },
];

/** Gate 4 — statement & analysis attestation; legacy single-row key still accepted in isGate4Complete */
export const G4_CHECKLIST: CloseTaskDef[] = [
  { key: "g4_balance_sheet", label: "Review balance sheet" },
  { key: "g4_profit_loss", label: "Review P&L" },
  { key: "g4_cash_flow", label: "Review cash flow" },
  { key: "g4_analysis", label: "Analysis (variance, narrative, board context)" },
];

export const G4_LEGACY_TASK_KEYS = [
  "g4_review_distribute",
  "g4_review_financials",
] as const;

export const FOUNDRY_SUBMISSION_KEY = "g4_foundry_executive_submission";

const ALL: Record<number, CloseTaskDef[]> = {
  1: G1_CHECKLIST,
  2: G2_CHECKLIST,
  3: G3_CHECKLIST,
  4: G4_CHECKLIST,
};

export function toReportingPeriod(monthStartIso: string): string {
  const d = new Date(`${monthStartIso}T12:00:00`);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(2, 4);
  return `${mm}/${yy}`;
}

function isGate4CompleteForLedger(rows: Map<string, { verifier_name: string | null; completed_at: string }>): boolean {
  if (
    G4_CHECKLIST.every((d) => {
      const r = rows.get(d.key);
      return Boolean(r?.verifier_name && r?.completed_at);
    })
  ) {
    return true;
  }
  for (const k of G4_LEGACY_TASK_KEYS) {
    const r = rows.get(k);
    if (r?.verifier_name && r?.completed_at) return true;
  }
  return false;
}

export function isGateChecklistComplete(gate: number, rows: Map<string, { verifier_name: string | null; completed_at: string }>): boolean {
  if (gate === 4) return isGate4CompleteForLedger(rows);
  const defs = ALL[gate];
  if (!defs) return true;
  return defs.every((d) => {
    const r = rows.get(d.key);
    return Boolean(r?.verifier_name && r?.completed_at);
  });
}

export function taskListForGate(gate: number): CloseTaskDef[] {
  return ALL[gate] ?? [];
}
