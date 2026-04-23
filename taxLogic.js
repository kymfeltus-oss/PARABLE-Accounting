/**
 * PARABLE Ministry ERP — Quarterly Form 941 data aggregator
 *
 * Payroll source rows: `parable_ledger.transactions` with `tx_type = 'expense'`
 * and metadata identifying salary / wages (see isSalaryRow / parsePayrollMetadata).
 *
 * Conventions (metadata JSON on each transaction):
 *   - wage_type: "salary" | "wages" (case-insensitive)  OR  payroll_line: "salary" | "gross_wages"
 *   - employee_type: "minister" | "non_minister"  (ministers: FICA-exempt in this model; may still have FIT)
 *   - fica_status: optional override; "exempt" forces ministerial FICA treatment, "subject" non-minister
 *   - federal_income_tax_withheld: number string (USD) for line 3 (FITW) attributed to that row
 *   - amount: use as gross salary/wages for the line when gross_wages not set
 *   - gross_wages: optional explicit gross (string or number)
 *
 * @module taxLogic
 */

const FICA_EMPLOYER_RATE = 0.0765; // 6.2% OASDI + 1.45% Medicare (employer share on same base as typically reported)

/**
 * @param {number} year
 * @param {1|2|3|4} quarter
 * @returns {{ start: string, end: string, startDate: Date, endDate: Date }}
 */
export function getQuarterDateRangeIso(year, quarter) {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, startMonth + 3, 0, 23, 59, 59, 999));
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    startDate: start,
    endDate: end,
  };
}

/**
 * @param {Record<string, unknown>} metadata
 * @param {string} [irsCategory]
 */
export function isSalaryRow(metadata, irsCategory) {
  const m = metadata && typeof metadata === "object" ? metadata : {};
  const wt = String(m.wage_type ?? m.payroll_line ?? "").toLowerCase();
  if (wt === "salary" || wt === "wages" || wt === "gross_wages") return true;
  if (String(m.payroll_line ?? "").toLowerCase() === "salary") return true;
  if (String(irsCategory ?? "")
    .toLowerCase()
    .includes("wage")) return true;
  if (String(irsCategory ?? "")
    .toLowerCase()
    .includes("salary")) return true;
  if (m.form_941 === true && String(m.line ?? "").includes("2")) return true;
  return false;
}

/**
 * @param {Record<string, unknown>} metadata
 * @returns {boolean} true if treated as minister (FICA-exempt for SS/Medicare employee/employer on 941-style calc)
 */
export function isMinisterialForFica(metadata) {
  const m = metadata && typeof metadata === "object" ? metadata : {};
  const et = String(m.employee_type ?? m.employee_class ?? "").toLowerCase();
  if (et === "minister" || et === "ministerial" || et === "clergy") return true;
  if (m.is_minister === true) return true;
  const fs = String(m.fica_status ?? "").toLowerCase();
  if (fs === "exempt" || fs === "exempt_minister") return true;
  return false;
}

/**
 * @param {Record<string, unknown>} metadata
 * @param {number} amountAbs
 * @returns {{ gross: number, fitWithheld: number }}
 */
export function parsePayrollMetadata(metadata, amountAbs) {
  const m = metadata && typeof metadata === "object" ? metadata : {};
  const g = m.gross_wages ?? m.gross ?? m.amount_gross;
  const gross = g != null && g !== "" ? roundMoney(Number(g)) : roundMoney(amountAbs);
  const w = m.federal_income_tax_withheld ?? m.fit_withheld ?? m.income_tax_withheld ?? m.federal_withholding;
  const fitWithheld = w != null && w !== "" ? roundMoney(Number(w)) : 0;
  return { gross: Number.isFinite(gross) ? gross : 0, fitWithheld: Number.isFinite(fitWithheld) ? fitWithheld : 0 };
}

function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Housing / parsonage amount excluded from Social Security and Medicare **wage base** (ministers often fully excluded; secular staff: cash housing in box 14 is not FICA).
 * @param {Record<string, unknown>} metadata
 * @returns {number}
 */
export function housingAllowanceExclusionFica(metadata) {
  const m = metadata && typeof metadata === "object" ? metadata : {};
  const raw = m.housing_allowance_usd ?? m.housing_allowance ?? m.minister_housing_exclusion ?? m.parsonage_exclusion ?? 0;
  return roundMoney(Math.max(0, Number(raw) || 0));
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} tenantId
 * @param {number} year
 * @param {1|2|3|4} quarter
 * @param {{ persist?: boolean }} [options] persist=true writes parable_ledger.quarterly_tax_reports
 * @returns {Promise<{
 *   year: number,
 *   quarter: number,
 *   line2: number,
 *   line3: number,
 *   line5a: number,
 *   employerFicaMatch: number,
 *   subtotals: { ministerSalary: number, nonMinisterSalary: number },
 *   rowCount: number,
 *   detail: object
 * }>}
 */
export async function getQuarterlyTotals(supabase, tenantId, year, quarter, options = {}) {
  if (!supabase) throw new Error("getQuarterlyTotals requires a Supabase client");
  if (!tenantId) throw new Error("tenantId is required");
  if (quarter < 1 || quarter > 4) throw new Error("quarter must be 1–4");
  const { start, end } = getQuarterDateRangeIso(year, quarter);

  const { data: rows, error } = await supabase
    .schema("parable_ledger")
    .from("transactions")
    .select("id, amount, tx_type, irs_category, metadata, created_at, tenant_id")
    .eq("tenant_id", tenantId)
    .eq("tx_type", "expense")
    .gte("created_at", start)
    .lte("created_at", end)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`getQuarterlyTotals query failed: ${error.message}`);

  let line2 = 0;
  let line3 = 0;
  let line5a = 0;
  let ministerSalary = 0;
  let nonMinisterSalary = 0;
  const detail = { included: [], excluded: [] };

  for (const row of rows ?? []) {
    const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
    if (!isSalaryRow(meta, row.irs_category)) {
      detail.excluded.push({ id: row.id, reason: "not_wage_salary" });
      continue;
    }
    const amountAbs = roundMoney(Math.abs(Number(row.amount)));
    const { gross, fitWithheld } = parsePayrollMetadata(meta, amountAbs);
    const minister = isMinisterialForFica(meta);

    line2 = roundMoney(line2 + gross);
    line3 = roundMoney(line3 + fitWithheld);

    if (minister) {
      ministerSalary = roundMoney(ministerSalary + gross);
      // Minister: entire cash comp excluded from SS/Med wage base in this model (incl. housing in gross).
    } else {
      nonMinisterSalary = roundMoney(nonMinisterSalary + gross);
      const hEx = housingAllowanceExclusionFica(meta);
      const ficaWageBase = roundMoney(Math.max(0, gross - hEx));
      line5a = roundMoney(line5a + ficaWageBase);
    }

    detail.included.push({
      id: row.id,
      gross,
      fitWithheld,
      minister,
      ficaSsaWagePortion: minister ? 0 : roundMoney(Math.max(0, gross - housingAllowanceExclusionFica(meta))),
    });
  }

  const employerFicaMatch = roundMoney(line5a * FICA_EMPLOYER_RATE);

  const result = {
    year,
    quarter,
    line2,
    line3,
    line5a,
    employerFicaMatch,
    subtotals: {
      ministerSalary,
      nonMinisterSalary,
    },
    rowCount: detail.included.length,
    detail: {
      period: { start, end, ficaEmployerRate: FICA_EMPLOYER_RATE },
      ...detail,
    },
  };

  if (options.persist) {
    const { error: upErr } = await supabase
      .schema("parable_ledger")
      .from("quarterly_tax_reports")
      .upsert(
        {
          tenant_id: tenantId,
          tax_year: year,
          quarter,
          line2_total_wages: result.line2,
          line3_federal_income_tax_withheld: result.line3,
          line5a_taxable_social_security_wages: result.line5a,
          employer_fica_match: result.employerFicaMatch,
          subtotal_salary_minister: result.subtotals.ministerSalary,
          subtotal_salary_non_minister: result.subtotals.nonMinisterSalary,
          detail_json: {
            line2: result.line2,
            line3: result.line3,
            line5a: result.line5a,
            employerFicaMatch: result.employerFicaMatch,
            subtotals: result.subtotals,
            rowCount: result.rowCount,
          },
          computed_at: new Date().toISOString(),
          is_generated: false,
        },
        { onConflict: "tenant_id,tax_year,quarter" }
      );
    if (upErr) throw new Error(`quarterly_tax_reports upsert failed: ${upErr.message}`);
  }

  // Direct 941 line mapping (numeric dollars)
  return {
    year,
    quarter,
    line2: result.line2,
    line3: result.line3,
    line5a: result.line5a,
    employerFicaMatch: result.employerFicaMatch,
    subtotals: result.subtotals,
    rowCount: result.rowCount,
    detail: result.detail,
  };
}

/**
 * 941-style JSON (lines as named in instructions — Part 2)
 * @param {Awaited<ReturnType<typeof getQuarterlyTotals>>} totals
 */
export function toForm941LineMap(totals) {
  return {
    line2_totalWagesTipsAndOtherCompensation: totals.line2,
    line3_federalIncomeTaxWithheld: totals.line3,
    line5a_taxableSocialSecurityWages: totals.line5a,
    employerFicaMatch_7_65percent_onFicaWages: totals.employerFicaMatch,
    _meta: {
      ministerialWagesExcludedFrom5a: totals.subtotals.ministerSalary,
      ficaWageBaseForLine5a: totals.line5a,
    },
  };
}

export { FICA_EMPLOYER_RATE };
