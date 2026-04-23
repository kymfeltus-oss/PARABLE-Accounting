/**
 * PARABLE — Genesis-style demo seed ("healthy ministry" simulation for sales)
 * Target schema: `parable_ledger` (not public). Requires existing tenant + genesis funds (GEN, UBI, …).
 *
 * There is no `pastor_profiles` table in core migrations; demo pastor is stored on the
 * housing mandate's `metadata` and a few payroll-style expense rows.
 *
 * @module seedDemoData
 */

const FED = "parable_ledger";

const DEMO_PASTOR = {
  full_name: "Rev. Jordan Mitchell",
  email: "j.mitchell@demo-sanctuary.org",
  base_salary: 65000,
  housing_allowance: 35000,
};

const DEMO_RESOLUTION_PDF = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} tenantId
 * @param {{ fiscalYear?: number; transactionCount?: number; streamDaysBack?: number; force?: boolean }} [options]
 * @returns {Promise<{ summary: { transactionsInserted: number; mandateUpserts: number; eftpsRows: number } }>}
 */
export async function seedDemoTenant(supabase, tenantId, options = {}) {
  if (!supabase) throw new Error("seedDemoTenant requires a Supabase client");
  if (!tenantId) throw new Error("tenantId is required");

  const now = new Date();
  const fiscalYear = options.fiscalYear ?? now.getFullYear();
  const nTx = options.transactionCount ?? 60;
  const streamMs = (options.streamDaysBack ?? 90) * 24 * 60 * 60 * 1000;
  const since = now.getTime() - streamMs;

  const { data: demoProbe } = await supabase
    .schema(FED)
    .from("transactions")
    .select("id, metadata")
    .eq("tenant_id", tenantId)
    .limit(400);
  const hasDemo = (demoProbe ?? []).some((r) => r && r.metadata && r.metadata.demo === true);
  if (hasDemo && !options.force) {
    return {
      summary: { skipped: true, message: "Demo data already present (set force to re-seed; append-only rows cannot be purged in-app).", transactionsInserted: 0, mandateUpserts: 0, eftpsRows: 0 },
    };
  }

  const { data: funds, error: fErr } = await supabase
    .schema(FED)
    .from("ministry_funds")
    .select("id, fund_code, balance")
    .eq("tenant_id", tenantId);
  if (fErr) throw new Error(fErr.message);
  const gen = (funds ?? []).find((f) => f.fund_code === "GEN");
  const ubi = (funds ?? []).find((f) => f.fund_code === "UBI") ?? gen;
  if (!gen?.id) throw new Error("GEN fund missing — run genesis provisioning for this tenant.");

  const mockTxs = [];
  for (let i = 0; i < nTx; i++) {
    const isUbi = Math.random() > 0.8;
    const amount = round2(10 + Math.random() * 490);
    const createdAt = new Date(since + Math.random() * (now.getTime() - since)).toISOString();
    mockTxs.push({
      tenant_id: tenantId,
      fund_id: isUbi && ubi?.id ? ubi.id : gen.id,
      amount,
      tx_type: "revenue",
      source: isUbi ? "PARABLE Stream: ad share" : "PARABLE Stream: tithe",
      is_ubi: isUbi,
      is_tax_deductible: !isUbi,
      contribution_nature: isUbi ? "ubit_candidate" : "charitable_gift",
      irs_category: isUbi ? "Unrelated Business Income" : "Contributions",
      metadata: { demo: true, stream: true, lane: isUbi ? "990_t" : "mission" },
      created_at: createdAt,
    });
  }

  // Payroll-style expenses (FICA + FIT model for 941) — last 45 days, monthly-ish
  for (let m = 0; m < 3; m++) {
    const createdAt = new Date(now.getTime() - m * 14 * 24 * 60 * 60 * 1000).toISOString();
    const gross = round2(5000 + m * 120);
    const fit = round2(620 + m * 20);
    mockTxs.push({
      tenant_id: tenantId,
      fund_id: gen.id,
      amount: gross,
      tx_type: "expense",
      source: "Payroll: pastoral salary (sim)",
      is_ubi: false,
      is_tax_deductible: false,
      contribution_nature: "charitable_gift",
      irs_category: "Program Service Expense",
      metadata: {
        demo: true,
        wage_type: "salary",
        employee_type: "minister",
        federal_income_tax_withheld: fit,
        housing_amount_usd: 2916,
        gross_wages: gross,
        demo_pastor: DEMO_PASTOR,
        payroll_line: "salary",
      },
      created_at: createdAt,
    });
  }

  // EFTPS-style outflows (tagged) — current quarter
  for (const label of ["EFTPS TAX PMT", "IRS USA TAX PMT (sim)"]) {
    mockTxs.push({
      tenant_id: tenantId,
      fund_id: gen.id,
      amount: round2(4000 + Math.random() * 2000),
      tx_type: "expense",
      source: label,
      is_ubi: false,
      is_tax_deductible: false,
      contribution_nature: "charitable_gift",
      irs_category: "Tax remittance (simulation)",
      metadata: { irs_eftps: true, demo: true },
      created_at: new Date().toISOString(),
    });
  }

  const { data: ins, error: tErr } = await supabase.schema(FED).from("transactions").insert(mockTxs).select("id");
  if (tErr) throw new Error(`Transactions insert: ${tErr.message}`);

  const boardTs = "2025-12-15T10:00:00.000Z";
  const mandateRows = [
    {
      tenant_id: tenantId,
      fiscal_year: fiscalYear,
      mandate_type: "HOUSING_ALLOWANCE",
      status: "active",
      document_url: DEMO_RESOLUTION_PDF,
      board_approval_timestamp: boardTs,
      metadata: {
        demo: true,
        housing_amount_usd: DEMO_PASTOR.housing_allowance,
        reported_salary_usd: DEMO_PASTOR.base_salary,
        demo_pastor: DEMO_PASTOR,
        resolution: "pre_signed_demo",
      },
    },
    {
      tenant_id: tenantId,
      fiscal_year: fiscalYear,
      mandate_type: "BOARD_MINUTES",
      status: "active",
      document_url: DEMO_RESOLUTION_PDF,
      board_approval_timestamp: boardTs,
      metadata: { demo: true, notes: "Simulated board minutes on file" },
    },
    {
      tenant_id: tenantId,
      fiscal_year: fiscalYear,
      mandate_type: "SECA_STATUS",
      status: "active",
      document_url: null,
      board_approval_timestamp: boardTs,
      metadata: { demo: true, seca_acknowledged: true },
    },
    {
      tenant_id: tenantId,
      fiscal_year: fiscalYear,
      mandate_type: "ACCOUNTABLE_PLAN",
      status: "active",
      document_url: DEMO_RESOLUTION_PDF,
      board_approval_timestamp: boardTs,
      metadata: { demo: true, accountable: true },
    },
  ];

  const { error: mErr } = await supabase
    .schema(FED)
    .from("compliance_mandates")
    .upsert(mandateRows, { onConflict: "tenant_id,fiscal_year,mandate_type" });
  if (mErr) throw new Error(`compliance_mandates: ${mErr.message}`);

  return {
    summary: {
      transactionsInserted: (ins ?? []).length || mockTxs.length,
      mandateUpserts: mandateRows.length,
      eftpsRows: 2,
    },
  };
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

export { DEMO_PASTOR, DEMO_RESOLUTION_PDF };
