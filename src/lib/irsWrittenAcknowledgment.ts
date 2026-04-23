/**
 * PARABLE Ledger — contemporaneous written acknowledgment (HTML body)
 * IRS rules for charitable contributions > $250 require specific written disclosures.
 * This helper produces merge-ready HTML for print/PDF pipelines (e.g. Playwright, headless Chrome).
 * Not legal advice; have counsel review your template and variable fields.
 */

export type AcknowledgmentInput = {
  organizationLegalName: string;
  ein: string;
  donorDisplayName: string;
  /** ISO date string */
  contributionDate: string;
  /** Total cash/check amount for this acknowledgment */
  amountUsd: number;
  /** If any goods/services were provided in exchange, describe (quid pro quo) */
  goodsOrServicesProvided: boolean;
  goodsOrServicesDescription?: string;
  /** Optional: tax year label */
  taxYear?: string;
};

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function buildWrittenAcknowledgmentHtml(input: AcknowledgmentInput): string {
  const quid = input.goodsOrServicesProvided
    ? `The organization provided goods or services in connection with this contribution, consisting of: ${input.goodsOrServicesDescription ?? "(see attached description)"}. Under IRS rules, only the excess of your payment over the value of those goods or services may be deductible; consult your tax advisor.`
    : `No goods or services were provided by the organization in return for this contribution.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Written acknowledgment — ${escapeHtml(input.organizationLegalName)}</title>
  <style>
    body { font-family: Inter, system-ui, sans-serif; color: #0a0a0a; max-width: 40rem; margin: 2rem auto; line-height: 1.5; }
    .header { font-weight: 800; font-style: italic; letter-spacing: -0.06em; text-transform: uppercase; color: #00a8b3; }
    .muted { color: #444; font-size: 0.9rem; }
    .box { border: 1px solid #ccc; border-radius: 12px; padding: 1.25rem; margin-top: 1.5rem; }
  </style>
</head>
<body>
  <p class="header">PARABLE Ledger</p>
  <p class="muted">Written acknowledgment of charitable contribution${input.taxYear ? ` — ${escapeHtml(input.taxYear)}` : ""}</p>
  <div class="box">
    <p>${escapeHtml(input.organizationLegalName)} (EIN ${escapeHtml(input.ein)}) acknowledges the following charitable contribution:</p>
    <ul>
      <li><strong>Donor:</strong> ${escapeHtml(input.donorDisplayName)}</li>
      <li><strong>Date of contribution:</strong> ${escapeHtml(input.contributionDate)}</li>
      <li><strong>Amount:</strong> ${escapeHtml(formatMoney(input.amountUsd))}</li>
    </ul>
    <p>${quid}</p>
    <p class="muted">This acknowledgment is prepared for tax substantiation purposes. Retain with your tax records.</p>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
