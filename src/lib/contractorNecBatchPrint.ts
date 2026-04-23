import type { NECBatchVendor } from "./contractorNecTypes";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/**
 * Informational 1099-NEC batch sheet — not an IRS e-file. CPA review.
 */
export function buildNecBatchDocumentHtml(
  orgName: string,
  year: number,
  rows: NECBatchVendor[],
): string {
  const rRows = rows
    .map(
      (r) => `<tr>
      <td>${esc(r.name)}</td>
      <td style="text-align:right">${r.ytd.toFixed(2)}</td>
      <td>${r.w9OnFile ? "Yes" : "No — obtain before file"}</td>
      <td>${esc(r.entity)}</td>
    </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>1099-NEC watch batch — ${year}</title>
<style>body{font-family:system-ui,sans-serif;padding:2rem;color:#111;max-width:800px}
h1{font-size:1.1rem;letter-spacing:.1em} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ccc;padding:.4rem}
.muted{color:#666;font-size:0.8rem} .bar{color:#8b1538}</style>
</head><body>
<h1>1099-NEC information package (internal) — not a filing</h1>
<p class="muted"><strong>${esc(orgName)}</strong> — calendar ${year} · PARABLE · verify every amount with a CPA. IRS 1099-NEC threshold is often $600; this list uses the product watch ($2,000).</p>
<table><thead><tr><th>Payee</th><th>Watch YTD (USD)</th><th>W-9</th><th>Entity</th></tr></thead><tbody>
${rRows}
</tbody></table>
<p class="muted">Corporation filter: C/S-corp may not require NEC from the church in some cases. Legal: facts vary.</p>
</body></html>`;
}
