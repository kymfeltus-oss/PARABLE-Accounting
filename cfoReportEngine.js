/**
 * PARABLE — CFO annual compliance summary (report engine)
 * Aggregates governance, tax, EFTPS, cash, and UBI signals.
 * @module cfoReportEngine
 */

import { getQuarterDateRangeIso, getQuarterlyTotals } from "./taxLogic.js";

const FED = "parable_ledger";

const EFTPS_RE = /eftps|irs[\s,]*usa[\s,]*tax|irs[\s,]*tax[\s,]*(pymt|payment|eft)/i;

/**
 * @param {Record<string, unknown> | null | undefined} m
 */
function metadataSearchBlob(m) {
  if (!m || typeof m !== "object") return "";
  const keys = ["description", "memo", "bank_memo", "narrative", "payee", "import_note", "plaid_name"];
  return keys.map((k) => (m[k] != null ? String(m[k]) : "")).join(" ");
}

/**
 * @param {{ source: string | null; metadata: unknown }} r
 * @returns {boolean}
 */
export function rowLooksLikeEftpsPayment(r) {
  if (r.metadata && typeof r.metadata === "object") {
    if (r.metadata.irs_eftps === true || r.metadata.eftps === true) return true;
  }
  const s = (r.source ?? "") + " " + metadataSearchBlob(/** @type {Record<string, unknown>} */ (r.metadata) ?? undefined);
  if (EFTPS_RE.test(s)) return true;
  if (/irs\s*usa\s*tax/i.test(s)) return true;
  if (/\beftps\b/i.test(s)) return true;
  return false;
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * @param {Awaited<ReturnType<typeof getQuarterlyTotals>>} t
 */
function quarterLiabilityFromTotals(t) {
  const fica = (t.employerFicaMatch ?? 0) * 2;
  return round2((t.line3 ?? 0) + fica);
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} tenantId
 * @param {number} year
 * @param {1|2|3|4} q
 * @returns {Promise<{ totalDetected: number; matchCount: number }>}
 */
export async function sumEftpsForQuarter(supabase, tenantId, year, q) {
  const { start, end } = getQuarterDateRangeIso(year, q);
  const { data, error } = await supabase
    .schema(FED)
    .from("transactions")
    .select("id, amount, source, metadata, created_at, tx_type")
    .eq("tenant_id", tenantId)
    .gte("created_at", start)
    .lte("created_at", end);

  if (error) throw new Error(`sumEftpsForQuarter: ${error.message}`);

  let total = 0;
  let n = 0;
  for (const row of data ?? []) {
    if (!rowLooksLikeEftpsPayment(row)) continue;
    total += Math.abs(Number(row.amount) || 0);
    n += 1;
  }
  return { totalDetected: round2(total), matchCount: n };
}

const MANDATE_TYPES = /** @type {const} */ (["HOUSING_ALLOWANCE", "SECA_STATUS", "ACCOUNTABLE_PLAN", "BOARD_MINUTES"]);

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} tenantId
 * @param {number} year
 * @returns {Promise<object>}
 */
export async function generateAnnualComplianceSummary(supabase, tenantId, year) {
  if (!supabase) throw new Error("generateAnnualComplianceSummary requires a Supabase client");
  if (!tenantId) throw new Error("tenantId is required");
  if (!Number.isFinite(year)) throw new Error("year is required");

  const yStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)).toISOString();
  const yEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)).toISOString();

  const [{ data: mandateRows, error: mErr }, { data: qtrRows, error: qErr }, { data: fundRows, error: fErr }, { data: yearTx, error: txErr }, { data: ubiTx, error: ubiErr }] = await Promise.all([
    supabase
      .schema(FED)
      .from("compliance_mandates")
      .select("id, mandate_type, status, document_url, board_approval_timestamp, metadata")
      .eq("tenant_id", tenantId)
      .eq("fiscal_year", year)
      .order("mandate_type"),
    supabase
      .schema(FED)
      .from("quarterly_tax_reports")
      .select("quarter, tax_year, is_generated, line3_federal_income_tax_withheld, detail_json, computed_at")
      .eq("tenant_id", tenantId)
      .eq("tax_year", year)
      .order("quarter"),
    supabase.schema(FED).from("ministry_funds").select("id, fund_code, fund_name, balance, is_restricted").eq("tenant_id", tenantId).eq("is_active", true),
    supabase
      .schema(FED)
      .from("transactions")
      .select("amount, tx_type, created_at, irs_category")
      .eq("tenant_id", tenantId)
      .gte("created_at", yStart)
      .lte("created_at", yEnd),
    supabase
      .schema(FED)
      .from("transactions")
      .select("amount, tx_type, created_at, is_ubi, irs_category")
      .eq("tenant_id", tenantId)
      .eq("is_ubi", true)
      .in("tx_type", ["revenue", "donation", "reversal"])
      .gte("created_at", yStart)
      .lte("created_at", yEnd),
  ]);

  if (mErr) throw new Error(`Mandates: ${mErr.message}`);
  if (qErr) throw new Error(`Quarterly reports: ${qErr.message}`);
  if (fErr) throw new Error(`Funds: ${fErr.message}`);
  if (txErr) throw new Error(`Transactions: ${txErr.message}`);
  if (ubiErr) throw new Error(`UBI query: ${ubiErr.message}`);

  const mandates = mandateRows ?? [];
  let nMandateOk = 0;
  for (const m of MANDATE_TYPES) {
    const r = mandates.find((x) => x.mandate_type === m);
    const hasDoc = r?.document_url != null && String(r.document_url).trim() !== "";
    if (r && r.status === "active" && (hasDoc || r.board_approval_timestamp)) nMandateOk += 1;
  }
  const governancePercent = Math.round((nMandateOk / MANDATE_TYPES.length) * 100);
  const governanceLabel = `${governancePercent}% (model) — ${nMandateOk}/${MANDATE_TYPES.length} board artifacts`;

  const housingMandate = mandates.find((r) => r.mandate_type === "HOUSING_ALLOWANCE");
  const housingMeta = housingMandate?.metadata && typeof housingMandate.metadata === "object" ? housingMandate.metadata : {};
  const housingAmount = Number(/** @type {{ housing_amount_usd?: number }} */ (housingMeta).housing_amount_usd) || 0;
  const estimatedSeTaxSavings = round2(housingAmount * 0.153);

  const cashOnHand = round2((fundRows ?? []).reduce((a, f) => a + Math.abs(Number(f.balance) || 0), 0));

  let yExp = 0;
  for (const t of yearTx ?? []) {
    if (t.tx_type === "expense") yExp += Math.abs(Number(t.amount) || 0);
  }
  const estimatedMonthlyOpEx = round2(yExp / 12) || 0;
  const daysCashOnHand = estimatedMonthlyOpEx > 0 ? round2(cashOnHand / (estimatedMonthlyOpEx / 30)) : null;
  const modeledCurrentLiab = round2(estimatedMonthlyOpEx * 1.5) || 1;
  const liquidityRatio = round2(cashOnHand / modeledCurrentLiab);

  let ubiYtd = 0;
  for (const t of ubiTx ?? []) {
    if (t.tx_type === "reversal") ubiYtd -= Math.abs(Number(t.amount) || 0);
    else ubiYtd += Math.abs(Number(t.amount) || 0);
  }
  ubiYtd = round2(ubiYtd);
  const ubiUnder1k = ubiYtd < 1000;

  /** @type {Record<number, { is_generated: boolean, computed_at: string | null }>} */
  const byQ = {};
  for (const r of qtrRows ?? []) {
    byQ[Number(r.quarter)] = { is_generated: !!r.is_generated, computed_at: r.computed_at ?? null };
  }

  const form941Quarters = [];
  for (let q = 1; q <= 4; q++) {
    const totals = await getQuarterlyTotals(supabase, tenantId, year, /** @type {1|2|3|4} */ (q), { persist: false });
    const liab = quarterLiabilityFromTotals(totals);
    const eft = await sumEftpsForQuarter(supabase, tenantId, year, /** @type {1|2|3|4} */ (q));
    const row = byQ[q];
    form941Quarters.push({
      quarter: q,
      label: `Q${q}`,
      isGenerated: row?.is_generated === true,
      eftpsDetected: eft.totalDetected,
      eftpsMatchCount: eft.matchCount,
      liabilityModeled: liab,
      computedAt: row?.computed_at ?? null,
    });
  }

  const all941Ready = form941Quarters.filter((q) => q.isGenerated).length === 4;
  const eftpsPulseOk = form941Quarters.every((q) => q.liabilityModeled === 0 || q.eftpsMatchCount > 0);

  const fundSegregationNote =
    (fundRows ?? []).filter((f) => f.is_restricted).length > 0 ? "Restricted + unrestricted funds on file" : "Add restricted fund rows for best evidence";

  return {
    tenantId,
    fiscalYear: year,
    generatedAt: new Date().toISOString(),
    governanceScore: {
      label: governanceLabel,
      percent: governancePercent,
      verifiedMandateCount: nMandateOk,
      totalMandates: MANDATE_TYPES.length,
    },
    taxCompliance: {
      payrollStatus: all941Ready ? "Current" : "Review 941 workpapers",
      ubiStatus: ubiUnder1k ? "Under $1,000 (modeled 990-T lane YTD)" : "Above de minimis / review (modeled UBI YTD)",
      ubiYtd: ubiYtd,
      form941Quarters,
      nonProfitStanding: "501(c)(3) — verify in governing documents & IRS determination (profile)",
    },
    transparency: {
      donorAck: "$250+ CWA: wire batch + written acknowledgment (see Compliance → acknowledgments when enabled)",
      fundSegregation: fundSegregationNote,
    },
    shieldSummary: {
      housingTotal: housingAmount,
      housingTotalLabel: new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(housingAmount),
      taxSaved: estimatedSeTaxSavings,
      taxSavedLabel: new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(estimatedSeTaxSavings),
    },
    housing: {
      mandateId: housingMandate?.id ?? null,
      amountUsd: housingAmount,
      documentUrl: housingMandate?.document_url ?? null,
      boardLocked: !!housingMandate?.board_approval_timestamp,
    },
    financialPulse: {
      cashOnHand,
      estimatedMonthlyOpEx,
      daysCashOnHand: daysCashOnHand ?? null,
      operatingReservesNote: "Modeled: unrestricted cash / monthly run-rate (ledger expenses, calendar year).",
      liquidityRatio,
    },
    auditTrail: "Mandate rows, quarterly_tax_reports, EFTPS-tagged transactions, and UBI-tagged rows — re-read as digital fragments only.",
    readiness: {
      irsReady: governancePercent === 100 && all941Ready && (housingMandate?.board_approval_timestamp ? true : false) && eftpsPulseOk,
      headline: governancePercent === 100 && all941Ready && eftpsPulseOk ? "100% model sync — IRS pack ready (CPA sign-off)" : "Review open items with counsel",
      pillars: {
        governance: { ok: governancePercent === 100, label: "Governance" },
        transparency: { ok: (fundRows ?? []).length > 0, label: "Transparency" },
        tax: { ok: ubiUnder1k && all941Ready, label: "Tax status" },
        financial: { ok: (daysCashOnHand ?? 0) >= 30, label: "Financial pulse" },
      },
    },
  };
}
