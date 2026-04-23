// PARABLE: QuickBooks Online (QBO) sync shell — OAuth2, chart + JE fetch, migration mapping, discrepancy pass.
// Wire to Intuit in production: set QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REDIRECT_URI, QBO_APP_ENV.
// The AI translation layer reuses `migrationEngine.js` for institutional UCOA.

import {
  mapQuickBooksToParable,
  MIGRATION_STATUS,
  pickAccountNameColumn,
} from "./migrationEngine.js";

const INTUIT_OAUTH = "https://appcenter.intuit.com/connect/oauth2";
const QBO_SANDBOX_API = "https://sandbox-quickbooks.api.intuit.com";
const QBO_PROD_API = "https://quickbooks.api.intuit.com";

const SCOPES = "com.intuit.quickbooks.accounting openid profile email";

/**
 * @param {{ clientId: string, redirectUri: string, state: string, useSandbox?: boolean }} p
 * @returns {string}
 */
export function getQuickBooksAuthorizationUrl(p) {
  const params = new URLSearchParams({
    client_id: p.clientId,
    response_type: "code",
    scope: SCOPES,
    redirect_uri: p.redirectUri,
    state: p.state,
  });
  return `${INTUIT_OAUTH}?${params.toString()}`;
}

/**
 * @param {object} env
 * @param {string} [env.QUICKBOOKS_CLIENT_ID]
 * @param {string} [env.QUICKBOOKS_REDIRECT_URI]
 */
export function getBrowserQuickBooksConnectUrlFromEnv(env) {
  const clientId = env.QUICKBOOKS_CLIENT_ID || "";
  const redirect = env.QUICKBOOKS_REDIRECT_URI || (typeof location !== "undefined" ? `${location.origin}/import-export` : "");
  const state = btoa(
    `parable_${Date.now()}`,
  ).replace(/=+$/, "");
  if (!clientId) {
    return { url: null, error: "Set NEXT_PUBLIC_QUICKBOOKS_CLIENT_ID (or QUICKBOOKS_CLIENT_ID) for OAuth" };
  }
  return { url: getQuickBooksAuthorizationUrl({ clientId, redirectUri: redirect, state }), state };
}

/**
 * @param {string} baseApi e.g. sandbox or prod URL
 * @param {string} realmId companyId
 * @param {string} _accessToken stub
 */
export async function fetchQbChartOfAccounts(baseApi, realmId, _accessToken) {
  const _path = `/v3/company/${realmId}/query?query=select * from Account`;
  void _path;
  if (!baseApi || !realmId) {
    return { accounts: [], error: "Missing QBO config — using demo chart." };
  }
  /** @type {Array<{name: string, accountType: string, currentBalance: number, id: string}>} */
  const mock = [
    { id: "1", name: "Tithes", accountType: "Income", currentBalance: 0 },
    { id: "2", name: "Pastor Salary", accountType: "Expense", currentBalance: 0 },
    { id: "3", name: "Miscellaneous Reimbursement", accountType: "Expense", currentBalance: 0 },
  ];
  return { accounts: mock, error: null, demo: true };
}

/**
 * Last 12 months journal lines (QBO `JournalEntry` is heavy; stub returns one-line narrative rows).
 * @param {string} baseApi
 * @param {string} realmId
 * @param {string} _accessToken
 * @param {{ asOf?: Date }} [o]
 */
export async function fetchQbJournalEntriesLast12Months(baseApi, realmId, _accessToken, o) {
  const end = o?.asOf && !Number.isNaN(+o.asOf) ? new Date(o.asOf) : new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - 12);
  if (!baseApi || !realmId) {
    return { entries: [], range: { start, end }, error: null, demo: true };
  }
  return {
    entries: [
      {
        TxnDate: end.toISOString().slice(0, 10),
        Line: [
          { Account: { name: "Tithes" }, Amount: 100, Debit: 100, Credit: 0 },
          { Account: { name: "Undeposited Funds" }, Amount: 100, Debit: 0, Credit: 100 },
        ],
      },
    ],
    range: { start, end },
    error: null,
    demo: true,
  };
}

/**
 * @param {Array<Record<string, unknown>>} qbRows
 */
export function applyAICategoryMatchToRows(qbRows) {
  return mapQuickBooksToParable(
    qbRows.map((r) => ({
      ...r,
      AccountName: r.AccountName || r["Account Name"] || (r.Account && (typeof r.Account === "object" ? (/** @type {{name?:string}} */ (r.Account).name) : r.Account)) || r.name,
    })),
  );
}

/**
 * Full migration pass with throttled progress for a tech-noir UI.
 * @param {object} p
 * @param {Array<Record<string, unknown>>} p.qbRowBatch
 * @param {(n: number, label?: string) => void} [p.onProgress] 0–1
 * @param {{ asOf?: Date, useReviewBucketCode?: boolean }} [p.options]
 * @returns {Promise<{mapped: any[],readyCount:number,reviewCount:number,progress:number,discrepancies:any[]}>}
 */
export async function runSovereignMigrationInProgress(p) {
  const { qbRowBatch, onProgress, options } = p;
  const on = typeof onProgress === "function" ? onProgress : () => {};
  on(0.1, "Reading QuickBooks account layer");
  await delay(200);
  on(0.35, "Institutional UCOA translation (AI map)");
  const raw = mapQuickBooksToParable(
    Array.isArray(qbRowBatch) ? qbRowBatch : [],
    { useReviewBucketCode: options?.useReviewBucketCode },
  );
  on(0.6, "Integrity + fund alignment");
  await delay(200);
  on(0.85, "Sovereign migration in progress");
  const ready = raw.filter((r) => r.status === MIGRATION_STATUS.READY);
  const review = raw.filter((r) => r.status === MIGRATION_STATUS.MAPPING_REVIEW);
  on(1, "Complete");
  return {
    mapped: raw,
    readyCount: ready.length,
    reviewCount: review.length,
    progress: 1,
    /** Populated in `buildPostImportDiscrepancyReport` when you have both balances */
    discrepancies: [],
  };
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {object} p
 * @param {Record<string, number>} p.qbBalanceByAccountName
 * @param {Record<string, number>} p.parableBalanceByCode code -> balance
 * @param {Array<Record<string, unknown>>} [p.mappedRows] rows after `mapQuickBooksToParable`
 */
export function buildPostImportDiscrepancyReport(p) {
  const qb = p.qbBalanceByAccountName || {};
  const pl = p.parableBalanceByCode || {};
  /** @type {Array<Record<string, unknown>>} */
  const out = [];
  const nameToCode = new Map();
  for (const r of p.mappedRows || []) {
    if (r.status !== MIGRATION_STATUS.READY || r.parable_code == null) continue;
    const n = pickAccountNameColumn(/** @type {any} */ (r)) || "unknown";
    if (!nameToCode.has(n)) {
      nameToCode.set(n, r.parable_code);
    }
  }
  for (const [qName, qBal] of Object.entries(qb)) {
    const code = nameToCode.get(qName);
    if (code == null) {
      out.push({
        key: `qb:${qName}`,
        accountName: qName,
        qbBalance: qBal,
        parableBalance: 0,
        delta: null,
        severity: "high",
        note: "Unmapped in PARABLE — not posted to a fund/COA line",
      });
      continue;
    }
    const pbal = pl[String(code)] ?? 0;
    const delta = Math.round((qBal - pbal) * 100) / 100;
    if (Math.abs(delta) > 0.01) {
      out.push({
        key: `code:${code}`,
        accountName: qName,
        qbBalance: qBal,
        parableBalance: pbal,
        delta,
        severity: Math.abs(delta) > 1000 ? "high" : "warn",
        note: "Balance differs after import; reconcile in Sovereign close",
      });
    }
  }
  for (const [cStr, pbal] of Object.entries(pl)) {
    if (pbal == null || Math.abs(pbal) < 0.01) continue;
    if (out.some((o) => o.key != null && String((/** @type {any} */(o).key)) === `code:${cStr}`)) continue;
    out.push({
      key: `parable:${cStr}`,
      parable_code: parseInt(cStr, 10),
      qbBalance: 0,
      parableBalance: pbal,
      delta: -pbal,
      severity: "info",
      note: "PARABLE line with no mapped QB name in this comparison — verify funds and mapping",
    });
  }
  return out;
}

/**
 * @param {{ useSandbox?: boolean, token?: string }} o
 * @returns {string}
 */
export function getQboBaseApiUrl(o) {
  return o?.useSandbox ? QBO_SANDBOX_API : QBO_PROD_API;
}

export default {
  getQuickBooksAuthorizationUrl,
  getBrowserQuickBooksConnectUrlFromEnv,
  fetchQbChartOfAccounts,
  fetchQbJournalEntriesLast12Months,
  applyAICategoryMatchToRows,
  runSovereignMigrationInProgress,
  buildPostImportDiscrepancyReport,
  getQboBaseApiUrl,
  MIGRATION_STATUS,
  INTUIT_OAUTH: INTUIT_OAUTH,
  SCOPES,
};
