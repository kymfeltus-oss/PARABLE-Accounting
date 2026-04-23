// PARABLE: Sovereign Migration Engine
// Translates QuickBooks / generic exports into the Institutional UCOA (Universe Chart of Accounts) namespace.
// Unknown labels never receive a fake code — they enter the mapping review queue.

/** @typedef {{ [key: string]: string | number | null | undefined } & { AccountName?: string; "Account Name"?: string; accountName?: string }} QbInputRow */
/** @typedef {QbInputRow & { parable_code: number | null; parable_code_raw?: number; status: string; mapping_note?: string }} ParableMigrationRow */

export const MIGRATION_STATUS = {
  READY: "READY",
  MAPPING_REVIEW: "MAPPING_REVIEW",
};

/**
 * Default institutional map (UCOA). Extend per tenant; AI layer can merge suggestions here.
 * Keys: canonical labels used after normalization; values: PARABLE numeric line codes.
 */
export const INSTITUTIONAL_UCOA_TRANSLATION_MAP = {
  tithes: 4010,
  tithe: 4010,
  offerings: 4010,
  offering: 4010,
  "pastor salary": 5010,
  salary: 5010,
  payroll: 5010,
  "staff salary": 5010,
  "pastor housing": 5020,
  parsonage: 5020,
  housing: 5020,
  "housing allowance": 5020,
  maintenance: 6100,
  utilities: 6010,
  "utilities expense": 6010,
  insurance: 6200,
  "insurance expense": 6200,
};

const REVIEW_SUGGESTED_FALLBACK = 9999;

/**
 * @param {string} raw
 * @returns {string}
 */
export function normalizeQbAccountName(raw) {
  if (raw == null || String(raw).trim() === "") return "";
  return String(raw)
    .replace(/\s+/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .trim()
    .toLowerCase();
}

/**
 * Picks a QuickBooks "account name" field from the usual column variants.
 * @param {QbInputRow} row
 * @returns {string}
 */
export function pickAccountNameColumn(row) {
  if (row == null) return "";
  if (row["Account Name"] != null && String(row["Account Name"]).trim() !== "") {
    return String(row["Account Name"]);
  }
  if (row.AccountName != null && String(row.AccountName).trim() !== "") {
    return String(row.AccountName);
  }
  if (row.accountName != null && String(row.accountName).trim() !== "") {
    return String(row.accountName);
  }
  if (row.account != null && String(row.account).trim() !== "") {
    return String(row.account);
  }
  if (row.name != null && String(row.name).trim() !== "") {
    return String(row.name);
  }
  return "";
}

/**
 * Human-readable alias matches (fuzzy but conservative — one-to-one to UCOA code).
 * Order matters: first match wins; unknown falls through to review.
 */
const ALIAS_PATTERNS = [
  { test: (n) => /tithes?\b|tithe\s+&|offering|general\s+fund|plate/i.test(n), code: 4010 },
  { test: (n) => /pastor.*salary|senior\s*pastor|clergy\s*salary|ordained/i.test(n), code: 5010 },
  { test: (n) => /salary|wages|payroll/i.test(n) && /pastor|minister|staff|employee|pastoral/i.test(n), code: 5010 },
  { test: (n) => /parson|housing|manse|parsonage/i.test(n), code: 5020 },
  { test: (n) => /utilities?|electric|water|sewer|gas(?!oline)/i.test(n), code: 6010 },
  { test: (n) => /mainten|repairs?|ground/i.test(n), code: 6100 },
  { test: (n) => /insur/i.test(n), code: 6200 },
];

/**
 * @param {string} accountLabel
 * @returns {number | null}
 */
function resolveCodeFromName(accountLabel) {
  if (!accountLabel) return null;
  const n = normalizeQbAccountName(accountLabel);
  if (INSTITUTIONAL_UCOA_TRANSLATION_MAP[n] != null) {
    return Number(INSTITUTIONAL_UCOA_TRANSLATION_MAP[n]);
  }
  for (const { test, code } of ALIAS_PATTERNS) {
    if (test(accountLabel)) return code;
  }
  return null;
}

/**
 * Map QuickBooks-style rows to PARABLE. Never assigns a "real" ledger code when uncertain —
 * `parable_code` stays `null` and `status` is MAPPING_REVIEW; `review_bucket` holds the Intuit-safe bucket for UI.
 * @param {QbInputRow[]} qbData
 * @param {{ useReviewBucketCode?: boolean }} [opts]
 * @returns {ParableMigrationRow[]}
 */
export function mapQuickBooksToParable(qbData, opts) {
  const useBucket = opts?.useReviewBucketCode === true;
  if (!Array.isArray(qbData)) return [];
  return qbData.map((row) => {
    const label = pickAccountNameColumn(row);
    const n = normalizeQbAccountName(label);
    const code = resolveCodeFromName(n);
    if (code != null) {
      return {
        ...row,
        parable_code: code,
        parable_code_raw: code,
        status: MIGRATION_STATUS.READY,
      };
    }
    return {
      ...row,
      parable_code: useBucket ? REVIEW_SUGGESTED_FALLBACK : null,
      parable_code_raw: useBucket ? REVIEW_SUGGESTED_FALLBACK : null,
      status: MIGRATION_STATUS.MAPPING_REVIEW,
      mapping_note:
        "No institutional match — send to mapping review; do not post to operating COA without human confirmation.",
    };
  });
}

/**
 * Splits a simple CSV (commas, optional quotes). For complex Excel, export CSV from QuickBooks.
 * @param {string} csvText
 * @param {{ delimiter?: string }} [o]
 * @returns {QbInputRow[]}
 */
export function parseQbExportCsvString(csvText, o) {
  const delim = o?.delimiter === "\t" ? "\t" : ",";
  const text = String(csvText || "");
  if (!text.trim()) return [];
  const lines = splitCsvLines(text);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0], delim).map((h) => h.replace(/^\uFEFF/, "").trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i], delim);
    if (cells.length === 0) continue;
    const row = {};
    headers.forEach((h, j) => {
      row[h] = cells[j] != null ? cells[j] : "";
    });
    rows.push(row);
  }
  return rows;
}

/**
 * @param {string} text
 */
function splitCsvLines(text) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      cur += c;
    } else if ((c === "\n" || c === "\r") && !inQuotes) {
      if (c === "\r" && text[i + 1] === "\n") i += 1;
      if (cur.length || out.length) out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  if (cur.length || inQuotes) out.push(cur);
  return out.filter((l) => l.trim() !== "" || l.includes(","));
}

/**
 * @param {string} line
 * @param {string} delimiter
 * @returns {string[]}
 */
function parseCsvLine(line, delimiter) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQ = !inQ;
      }
    } else if (c === delimiter && !inQ) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

/**
 * "Parable Template" — bulk upload header row for members / vendors / JEs (extend columns per table).
 * @param {{ kind?: "transactions" | "members" | "vendors" }} [k]
 * @returns {string}
 */
export function getParableBulkTemplateCsv(k) {
  const kind = k?.kind ?? "transactions";
  if (kind === "members") {
    return [
      "member_external_id,full_name,email,phone,household_id,role,since_date",
    ].join("\n");
  }
  if (kind === "vendors") {
    return [
      "vendor_id,display_name,remit_to_email,default_expense_coa,notes,active",
    ].join("\n");
  }
  return [
    "transaction_id,transaction_date,amount,memo,parable_account_code,fund_id,import_batch_id,source",
  ].join("\n");
}

export default {
  MIGRATION_STATUS,
  INSTITUTIONAL_UCOA_TRANSLATION_MAP,
  mapQuickBooksToParable,
  pickAccountNameColumn,
  normalizeQbAccountName,
  parseQbExportCsvString,
  getParableBulkTemplateCsv,
};
