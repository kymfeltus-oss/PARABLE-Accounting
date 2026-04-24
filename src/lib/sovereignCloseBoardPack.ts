/**
 * One-page board pack (print / PDF) for the Sovereign Close “REVIEW & SIGN” step.
 * Summarizes the same signals the close wizard already tracks — not a substitute for audited financials.
 */

export type BoardPackViewModel = {
  monthLabel: string;
  orgName: string;
  /** All three rec flags true → show full match. */
  bankReconciled: boolean;
  apReconciled: boolean;
  arReconciled: boolean;
  unresolvedCriticalViolations: number;
  unresolvedOpenViolations: number;
  restrictedIntact: boolean;
};

function statusLine(ok: boolean, pass: string, fail: string) {
  return ok ? pass : fail;
}

export function buildSovereignCloseBoardPackHtml(vm: BoardPackViewModel): string {
  const recOk = vm.bankReconciled && vm.apReconciled && vm.arReconciled;
  const irsOk = vm.unresolvedCriticalViolations === 0;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Board pack — ${escapeHtml(vm.orgName)} — ${escapeHtml(vm.monthLabel)}</title>
  <style>
    body { font-family: system-ui, sans-serif; color: #111; padding: 2rem; max-width: 40rem; margin: 0 auto; }
    h1 { font-size: 1.25rem; letter-spacing: 0.06em; text-transform: uppercase; }
    .row { display: flex; justify-content: space-between; border-bottom: 1px solid #e5e5e5; padding: 0.6rem 0; font-size: 0.85rem; }
    .muted { color: #666; text-transform: uppercase; font-size: 0.65rem; letter-spacing: 0.1em; }
    .ok { color: #047857; font-weight: 700; }
    .bad { color: #b91c1c; font-weight: 700; }
    footer { margin-top: 2rem; font-size: 0.7rem; color: #666; }
  </style>
</head>
<body>
  <h1>Review board pack</h1>
  <p class="muted">${escapeHtml(vm.orgName)} · Close month ${escapeHtml(vm.monthLabel)}</p>
  <div class="row"><span class="muted">AI reconciliation (bank / AP / AR)</span>
    <span class="${recOk ? "ok" : "bad"}">${statusLine(recOk, "100% gate cleared", "Review required — not all rec flags are set")}</span></div>
  <div class="row"><span class="muted">IRS compliance scan (context: Pub. 1828)</span>
    <span class="${irsOk ? "ok" : "bad"}">${statusLine(irsOk, "No critical open items in Guardian", `${vm.unresolvedCriticalViolations} critical · ${vm.unresolvedOpenViolations} open`)}</span></div>
  <div class="row"><span class="muted">Restricted / donor intent (stewardship)</span>
    <span class="${vm.restrictedIntact ? "ok" : "bad"}">${statusLine(vm.restrictedIntact, "Modeled intact", "Flag: review restricted movement")}</span></div>
  <footer>PARABLE · internal close workpaper. Print via browser (Save as PDF) for the governance file.</footer>
</body>
</html>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
