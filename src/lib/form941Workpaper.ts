import { toForm941LineMap } from "../../taxLogic.js";
import type { QuarterlyTotals } from "@/lib/taxAggregationFromLedger";

export type Form941WorkpaperInput = {
  orgName: string;
  legalName: string;
  ein: string | null;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  totals: QuarterlyTotals;
  /** When liability exceeds EFTPS-tagged deposits in the quarter */
  unfundedLiabilityWarning: boolean;
  eftpsDetectedInQuarter: number;
  modeledLiability: number;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Printable HTML workpaper: maps ledger-derived fields into IRS Form 941 Part 2 line labels (simplified one-column).
 * This is not e-file output; professional review required.
 */
export function buildForm941WorkpaperHtml(p: Form941WorkpaperInput): string {
  const m = toForm941LineMap(p.totals);
  const erMatch = p.totals.employerFicaMatch ?? 0;
  const totalFicaEeEr = 2 * erMatch;

  const part2Rows = [
    { line: "2", label: "Wages, tips, and other compensation", amount: m.line2_totalWagesTipsAndOtherCompensation },
    { line: "3", label: "Federal income tax withheld from wages, tips, and other compensation", amount: m.line3_federalIncomeTaxWithheld },
    { line: "5a", label: "Taxable social security wages (FICA base — ministers excluded; housing excl. on non-minister lines)", amount: m.line5a_taxableSocialSecurityWages },
    { line: "5a col.", label: "Model: Social Security + Medicare taxes (ee + er) on 5a base (7.65% + 7.65%)", amount: totalFicaEeEr },
  ];

  const _meta = m._meta as { ministerialWagesExcludedFrom5a?: number; ficaWageBaseForLine5a?: number };
  const warnBlock = p.unfundedLiabilityWarning
    ? `<div style="background:#3b0a0a;color:#fecaca;border:2px solid #f87171;padding:12px 16px;margin:16px 0;font-weight:700;letter-spacing:0.05em">UNFUNDED LIABILITY DETECTED — DEPOSIT REQUIRED. Modeled employment taxes and withholding (${esc(
        p.modeledLiability.toFixed(2),
      )}) exceed EFTPS-tagged payments this quarter (${esc(
        p.eftpsDetectedInQuarter.toFixed(2),
      )}). Reconcile bank, EFTPS, and the ledger before filing.</div>`
    : "";

  const rows = part2Rows
    .map(
      (r) =>
        `<tr><td style="border:1px solid #999;padding:6px 8px;font-weight:600">Line ${esc(r.line)}</td><td style="border:1px solid #999;padding:6px 8px">${esc(
          r.label,
        )}</td><td style="border:1px solid #999;padding:6px 8px;text-align:right;font-family:ui-monospace,monospace">$${r.amount.toFixed(2)}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Form 941 workpaper — ${p.year} Q${p.quarter}</title>
<style>
  body{font-family:ui-sans-serif,system-ui,sans-serif;color:#111;max-width:8.5in;margin:0 auto;padding:0.5in}
  h1{font-size:14pt;letter-spacing:0.08em;margin:0 0 4pt}
  .sub{font-size:9pt;color:#444}
  .hdr{border:2px solid #111;padding:8px 10px;margin-bottom:12px}
  table{width:100%;border-collapse:collapse;font-size:10pt}
  .meta{font-size:8pt;color:#666;margin-top:8px}
</style></head><body>
  <div class="hdr">
    <h1>FORM 941 — WORKPAPER (NOT A FILING)</h1>
    <p class="sub">PARABLE internal compliance sync · For CPA / payroll provider · Not IRS e-file</p>
  </div>
  <p><strong>Employer name (trade):</strong> ${esc(p.orgName)}<br/>
  <strong>Legal name:</strong> ${esc(p.legalName)}<br/>
  <strong>EIN:</strong> ${esc(p.ein ?? "— (set on tenant record)")}<br/>
  <strong>Return period (calendar):</strong> Year ${p.year} · Quarter ${p.quarter} (1=Jan–Mar, 2=Apr–Jun, 3=Jul–Sep, 4=Oct–Dec)
  </p>
  ${warnBlock}
  <h2 style="font-size:11pt;margin-top:16px">Part 2 — Report for this quarter (from PARABLE ledger)</h2>
  <table>
    <thead><tr><th style="text-align:left;border:1px solid #999">Line</th><th style="text-align:left;border:1px solid #999">Description (abbrev.)</th><th style="text-align:right;border:1px solid #999">Amount (USD)</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="meta">Ministerial wages excluded from line 5a (SS/Med): $${( _meta?.ministerialWagesExcludedFrom5a ?? 0).toFixed(2)}. Non-minister FICA base after housing allowance exclusions (if any in metadata): $${( _meta?.ficaWageBaseForLine5a ?? 0).toFixed(2)}. Print and attach to board packet. PARABLE does not file with the IRS.</p>
  </body></html>`;
}
