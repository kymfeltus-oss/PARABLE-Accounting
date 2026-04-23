// PARABLE: Annual Impact & Integrity Report — board / annual meeting (advisory).
// Pairs with integrityCertificate + sealId for "Proof of Stewardship" line in the narrative.

/**
 * @typedef {object} FiscalDataLite
 * @property {object} [balanceSheet]
 * @property {object} [restrictedOutflow]
 * @property {string} [narrative]
 * @property {number} [year]
 */

/**
 * @param {FiscalDataLite} fiscalData
 * @param {string|null} [sealId] — from generateIntegrityCertificate; omit if not certified
 */
export function compileAnnualReport(fiscalData, sealId) {
  const year = fiscalData?.year ?? new Date().getFullYear();
  return {
    year,
    header: `${year} ANNUAL STEWARDSHIP & INTEGRITY REPORT`,
    tagline: "Institutional ministry financial story — for members and the board (not a legal opinion).",
    sections: [
      { title: "Financial position", data: fiscalData?.balanceSheet ?? { note: "Connect GL for full balance sheet" } },
      { title: "Mission & restricted impact", data: fiscalData?.restrictedOutflow ?? { note: "Designated giving vs spend" } },
      {
        title: "Compliance verification",
        data: sealId
          ? `Sovereign seal ID (proof of stewardship at generation): ${sealId}`
          : "Certificate not generated — complete all five integrity pillars to receive a seal ID.",
      },
      { title: "Narrative", data: fiscalData?.narrative ?? "Add your church’s story, baptisms, outreach, and capital vision." },
    ],
    footer: "Verified for operational use by PARABLE Integrity Gatekeeper (advisory). CPA / legal review as required.",
    formatForPrint: true,
  };
}

/**
 * @param {ReturnType<typeof compileAnnualReport>} report
 * @param {{ orgName: string }} meta
 * @returns {string} HTML for print / save PDF
 */
export function annualReportToPrintHtml(report, meta) {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const sectionHtml = (report.sections || [])
    .map(
      (s) => `
    <h2 style="font-size:0.75rem;letter-spacing:0.2em;text-transform:uppercase;color:#333;margin-top:1.5rem;">${esc(s.title)}</h2>
    <pre style="white-space:pre-wrap;font-size:0.85rem;color:#111;">${esc(typeof s.data === "string" ? s.data : JSON.stringify(s.data, null, 2))}</pre>`,
    )
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(report.header)}</title>
  <style>body{font-family:Georgia,serif;max-width:42rem;margin:2rem auto;padding:1.5rem;color:#111;line-height:1.5}
  h1{font-size:1.15rem;letter-spacing:0.15em;font-weight:800}
  .sub{color:#555;font-size:0.8rem}
  .foot{margin-top:2.5rem;font-size:0.7rem;color:#666;border-top:1px solid #ddd;padding-top:0.75rem}
  </style></head><body>
  <p class="sub">${esc(meta.orgName)}</p>
  <h1>${esc(report.header)}</h1>
  <p class="sub">${esc(report.tagline || "")}</p>
  ${sectionHtml}
  <p class="foot">${esc(report.footer || "")}</p>
  </body></html>`;
}

export default { compileAnnualReport, annualReportToPrintHtml };
