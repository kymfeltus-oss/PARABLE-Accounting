// PARABLE: Ledger - Internal Controls AI
// Heuristic rules inspired by IRS Publication 1828 (Tax Guide for Churches & Religious Orgs) and
// 990/990-T concepts. This is not legal advice; churches should work with a qualified tax advisor.

/**
 * @param {object} transaction - Row from parable_ledger.transactions (plus description helper fields).
 * @param {object} [vendorData] - Optional vendor: { name, ein?, flags? }
 * @param {object} [context] - { totalAnnualUbi, lobbyingYtd, compensationBenchmark, speechContext?: 'public_ledger' | 'internal_worship' }
 *   If speechContext is internal_worship (e.g. internal transcript only), political keyword flags on journal memos are skipped — public stream / marketing copy should be reviewed in statementMonitor.js instead.
 */

function norm(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFKC");
}

function getDescription(tx) {
  if (tx.description) return String(tx.description);
  const m = tx.metadata;
  if (m && typeof m === "object") {
    if (m.description) return String(m.description);
    if (m.memo) return String(m.memo);
    if (m.payee) return String(m.payee);
  }
  return String(tx.source ?? "");
}

const POLITICAL_KEYWORD_RE =
  /\b(campaign|candidate|election|ballot|pac\b|p\.a\.c|political action|endorse(ment)?|partisan|vote (yes|no)|voter (registration|drive))\b/i;
const LOBBYING_KEYWORD_RE =
  /\b(lobb(y|ing|yist|ied)|legislation|legislator|bill h\.r|grassroots lobbying|s\. ?\d{3,4}\b|house bill|senate bill)\b/i;
const VENDOR_INUREMENT_RE = /\b(insider|private benefit|interested director|board member( pay)?|related party)\b/i;

/**
 * @returns {Array<{ code: string, type: string, description: string, correction: string, irsRef: string, risk: string }>}
 */
export function scanForViolations(transaction, vendorData, context) {
  const c = context ?? {};
  const totalAnnualUbi = Number(c.totalAnnualUbi ?? 0) || 0;
  const lobbyingYtd = Number(c.lobbyingYtd ?? 0) || 0;

  const violations = [];
  const amount = Math.abs(Number(transaction.amount ?? 0) || 0);
  const irs = norm(transaction.irs_category);
  const desc = norm(getDescription(transaction));
  const vname = norm((vendorData && vendorData.name) || "");

  const isSalaryLike = irs.includes("salary") || irs.includes("wage") || irs.includes("compensation");
  if (isSalaryLike && amount > 250_000) {
    violations.push({
      code: "INURE-01",
      type: "Potential private inurement / high compensation",
      description:
        "A compensation-class transaction exceeds the conservative benchmark for routine nonprofit comparison (rule-of-thumb: review against comparable roles and total package).",
      correction:
        "Obtain a comparable salary/benefit survey, document the board (or comp committee) process, and retain records in the Sovereign Vault. Consult counsel if total comp may be excess benefit.",
      irsRef: "p1828-inurement",
      risk: "CRITICAL",
    });
  }

  if (VENDOR_INUREMENT_RE.test(desc) || VENDOR_INUREMENT_RE.test(vname)) {
    violations.push({
      code: "INURE-02",
      type: "Insider or private benefit — review",
      description:
        "Memo or payee text suggests a transaction with a board member, officer, or related party where private benefit or self-dealing may need documentation.",
      correction:
        "Confirm arm’s-length terms, disinterested approval, and contemporaneous minutes. Reclass or reject disqualified payments. Document in the Sovereign Vault.",
      irsRef: "p1828-inurement",
      risk: "HIGH",
    });
  }

  const internalLedgerSpeech =
    c.speechContext === "internal_worship" ||
    (transaction.metadata &&
      typeof transaction.metadata === "object" &&
      String((transaction.metadata).compliance_channel || "") === "internal_worship");

  if (
    !internalLedgerSpeech &&
    (POLITICAL_KEYWORD_RE.test(getDescription(transaction)) || POLITICAL_KEYWORD_RE.test(desc + " " + vname))
  ) {
    violations.push({
      code: "POLIT-01",
      type: "Prohibited political campaign intervention (flag)",
      description:
        "Narration references campaigns, candidates, or electioneering. Section 501(c)(3) organizations are prohibited from political campaign activity.",
      correction:
        "Cease and correct any outlay or communication that is campaign intervention; seek counsel. Nonpartisan voter education (without bias) and certain voter registration (subject to safe practices) are distinguishable from intervention.",
      irsRef: "p1828-political",
      risk: "CRITICAL",
    });
  }

  if ((LOBBYING_KEYWORD_RE.test(getDescription(transaction)) && amount > 2_000) || lobbyingYtd > 20_000) {
    violations.push({
      code: "LOBBY-01",
      type: "Lobbying or legislative influence — 501(c)(3) limits",
      description:
        "Labels suggest lobbying/legislative activity. Public charities must monitor lobbying; churches have an election; others use 501(h) expense or insubstantial-part tests (facts-and-circumstances).",
      correction:
        "Categorize direct vs. grass-roots lobbying, track the annual proxy if using 501(h), and keep board oversight. Reallocate or restructure if substantial lobbying is possible.",
      irsRef: "p1828-lobbying",
      risk: "HIGH",
    });
  }

  const isUbi =
    Boolean(transaction.is_ubi) ||
    transaction.contribution_nature === "ubit_candidate" ||
    norm((transaction.metadata && transaction.metadata.tax_lane) || "").includes("990-t") ||
    norm((transaction.metadata && transaction.metadata.ubi) || "false") === "true";

  if (isUbi && totalAnnualUbi > 1_000) {
    violations.push({
      code: "TAX-01",
      type: "Form 990-T — UBI threshold (indicator)",
      description: "Unrelated business income, taken together for the year, can exceed the $1,000 filing and tax exposure trigger.",
      correction: "Model UBI on 990-T (and state), report as required, and maintain tracing for each trade or business. Coordinate with a tax return preparer.",
      irsRef: "form-990-t",
      risk: "CRITICAL",
    });
  }

  return violations;
}

/**
 * @param {object[]} rows - transactions
 * @param {function} getUbi - optional row filter for UBI
 */
export function sumUbiYtdForYear(rows, year) {
  const y = year ?? new Date().getUTCFullYear();
  return rows
    .filter((r) => {
      if (!r.created_at) return false;
      return new Date(r.created_at).getUTCFullYear() === y;
    })
    .filter((r) => {
      const t = norm((r.metadata && r.metadata.tax_lane) || "");
      if (r.is_ubi) return true;
      if (r.contribution_nature === "ubit_candidate") return true;
      if (t.includes("990-t") || t.includes("ubi")) return true;
      return r.tx_type === "revenue" && Boolean(r.is_ubi);
    })
    .reduce((s, r) => s + Math.abs(Number(r.amount || 0)), 0);
}

/**
 * @param {object[]} rows
 */
export function sumLobbyingYtd(rows) {
  return rows
    .filter((r) => LOBBYING_KEYWORD_RE.test(getDescription(r)) || LOBBYING_KEYWORD_RE.test(norm(r.irs_category)))
    .reduce((s, r) => s + Math.abs(Number(r.amount || 0)), 0);
}
