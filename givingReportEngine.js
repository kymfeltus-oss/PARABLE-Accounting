// PARABLE: Ledger — giving statements & batch comm helpers (CFO / IRS display surface)
// Not tax advice. Pulls member-linked donation/revenue rows; splits by fund restriction.

/**
 * @typedef {{ id: string, amount: string | number, created_at: string, tx_type: string, fund_id: string, metadata?: Record<string, unknown> }} TxRow
 * @typedef {{ is_restricted: boolean, fund_name?: string, fund_code?: string }} FundInfo
 */

/**
 * @param {Array<TxRow & { fund?: FundInfo }>} rows
 * @param {Record<string, FundInfo>} [fundById]
 * @returns {{ total: number, unrestricted: number, restricted: number, byCategory: Record<string, number> }}
 */
export function summarizeGivingByRestriction(rows, fundById) {
  let unrestricted = 0;
  let restricted = 0;
  /** @type {Record<string, number>} */
  const byCategory = {};
  for (const r of rows || []) {
    const amt = Math.abs(Number(r.amount) || 0);
    const fund = r.fund || (r.fund_id && fundById ? fundById[r.fund_id] : null);
    const isR = fund && fund.is_restricted;
    if (isR) restricted += amt;
    else unrestricted += amt;
    const key = (fund && fund.fund_name) || (fund && fund.fund_code) || (isR ? "Restricted" : "Unrestricted");
    byCategory[key] = (byCategory[key] || 0) + amt;
  }
  return {
    total: unrestricted + restricted,
    unrestricted,
    restricted,
    byCategory,
  };
}

/**
 * @param {Array<TxRow & { fund?: FundInfo }>} rows
 * @param {number} year
 * @returns {number[]} length 12, USD totals per calendar month (UTC)
 */
export function buildMonthlyGivingSeries(rows, year) {
  const m = new Array(12).fill(0);
  for (const r of rows || []) {
    const t = r.created_at ? new Date(r.created_at) : null;
    if (!t || Number.isNaN(t.getTime())) continue;
    if (t.getUTCFullYear() !== year) continue;
    m[t.getUTCMonth()] = (m[t.getUTCMonth()] || 0) + Math.abs(Number(r.amount) || 0);
  }
  return m;
}

/**
 * @param {Record<string, number>} byCategory
 * @returns {string | null} fund label with highest share
 */
export function topGivingCategoryKey(byCategory) {
  const entries = Object.entries(byCategory || {});
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

/**
 * AI-style single sentence for email batch (no external API; deterministic template).
 * @param {object} p
 * @param {string} p.memberFirstName
 * @param {string} [p.topCategory]
 * @param {string} [p.legalEntityName] — 501(c)(3) name on file
 * @param {string} [p.tone]
 * @returns {string}
 */
export function buildThankYouLine(p) {
  const name = p.memberFirstName && p.memberFirstName.trim() ? p.memberFirstName.split(/\s+/)[0] : "friend";
  const org = p.legalEntityName || "our church";
  const top = p.topCategory || "general ministry support";
  return (
    `Thank you, ${name} — we noticed your heart for ${top}; your generosity at ${org} is stewarded with audit-ready care and 501(c)(3) integrity.`
  );
}

/**
 * "Impact" line: member share of a bucket (e.g. local missions % of their giving vs org total) — for PDF narrative.
 * @param {number} memberToBucket — dollars member gave to bucket
 * @param {number} orgBucketTotal
 * @returns {number} 0-100
 */
export function formatImpactShare(memberToBucket, orgBucketTotal) {
  if (!orgBucketTotal || orgBucketTotal <= 0) return 0;
  return Math.min(100, Math.round((memberToBucket / orgBucketTotal) * 1000) / 10);
}

/**
 * @param {object} input
 * @param {string} input.memberName
 * @param {string} [input.tenantLegalName]
 * @param {string} [input.einDisplay] — last 4 or masked
 * @param {ReturnType<typeof summarizeGivingByRestriction>} input.summary
 * @param {number} [input.impactMissionsPercent] — narrative
 * @param {string} [input.periodLabel] e.g. "Q1 2026"
 * @param {string} [input.sovereignSealText]
 * @returns {string} print-friendly HTML
 */
export function buildGivingStatementHtml(input) {
  const period = input.periodLabel || "Year-to-date";
  const org = input.tenantLegalName || "PARABLE Ministry Partner";
  const total = (input.summary && input.summary.total) || 0;
  const u = (input.summary && input.summary.unrestricted) || 0;
  const r = (input.summary && input.summary.restricted) || 0;
  const imp = input.impactMissionsPercent;
  const seal = input.sovereignSealText || "Sovereign seal: contributions recorded on UCOA-aligned, restricted/unrestricted fund lines — audit posture maintained.";
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Giving statement — ${escapeHtml(period)}</title>
<style>
  body { font-family: system-ui, sans-serif; background:#0a0a0a; color:#e4e4e7; margin:0; padding: 40px; }
  .card { max-width: 640px; margin: 0 auto; background: #101010; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 32px; }
  h1 { color: #22d3ee; font-size: 1.1rem; letter-spacing: 0.15em; text-transform: uppercase; }
  .amt { font-size: 1.6rem; font-weight: 800; color: #4ade80; }
  .muted { color: #71717a; font-size: 0.8rem; }
  .seal { margin-top: 32px; padding: 20px; border: 1px solid rgba(34,211,238,0.25); border-radius: 12px; }
</style>
</head>
<body>
  <div class="card">
    <h1>Charitable giving summary</h1>
    <p class="muted">${escapeHtml(period)} · ${escapeHtml(org)}</p>
    <p><strong>Member:</strong> ${escapeHtml(input.memberName)}</p>
    <p class="total"><span class="muted">Total tax-relevant gifts (as recorded)</span><br/>
    <span class="amt">$${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span></p>
    <p class="muted">Unrestricted: $${u.toFixed(2)} &nbsp;·&nbsp; Restricted: $${r.toFixed(2)}</p>
    ${imp != null ? `<p><span style="color:#4ade80">Impact:</span> your tithes in this period helped underwrite approximately <strong>${imp}%</strong> of the local missions line (narrative allocation).</p>` : ""}
    <div class="seal"><strong style="color:#22d3ee">Sovereign seal & 501(c)(3) integrity</strong><br/>${escapeHtml(seal)}</div>
    <p class="muted" style="margin-top:24px">This statement reflects ledger postings only. For official tax advice, see your tax professional.</p>
  </div>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default {
  summarizeGivingByRestriction,
  buildMonthlyGivingSeries,
  topGivingCategoryKey,
  buildThankYouLine,
  formatImpactShare,
  buildGivingStatementHtml,
};
