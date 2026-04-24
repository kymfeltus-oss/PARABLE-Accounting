import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildMonthlyGivingSeries,
  buildThankYouLine,
  formatImpactShare,
  summarizeGivingByRestriction,
  topGivingCategoryKey,
  buildGivingStatementHtml,
} from "./givingReportFromRoot.js";

type Tx = {
  id: string;
  amount: string | number;
  created_at: string;
  tx_type: string;
  fund_id: string;
  metadata: Record<string, unknown>;
};

type Fund = {
  id: string;
  is_restricted: boolean;
  fund_name: string | null;
  fund_code: string | null;
};

export type GivingReportResult = {
  memberId: string;
  year: number;
  total: number;
  unrestricted: number;
  restricted: number;
  byCategory: Record<string, number>;
  monthly: number[];
  topCategory: string | null;
  thankYou: string;
  memberFirstName: string;
};

/**
 * Compiles YTD/annual giving for one member: restricted vs unrestricted from fund flags.
 * Queries donation + revenue lines where metadata.member_id = member id.
 */
export async function generateGivingReport(
  supabase: SupabaseClient,
  opts: { tenantId: string; memberId: string; year?: number; memberFullName?: string; legalName?: string },
): Promise<GivingReportResult> {
  const year = opts.year ?? new Date().getUTCFullYear();
  const yStart = new Date(Date.UTC(year, 0, 1)).toISOString();
  const yEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)).toISOString();

  const [{ data: raw, error }, { data: ppRows, error: ppErr }] = await Promise.all([
    supabase
      .schema("parable_ledger")
      .from("transactions")
      .select("id, amount, created_at, tx_type, fund_id, metadata")
      .eq("tenant_id", opts.tenantId)
      .in("tx_type", ["donation", "revenue"])
      .gte("created_at", yStart)
      .lte("created_at", yEnd)
      .eq("metadata->>member_id", opts.memberId)
      .order("created_at", { ascending: true }),
    supabase
      .schema("parable_ledger")
      .from("member_contributions")
      .select("id, amount, timestamp, fund_id, status")
      .eq("tenant_id", opts.tenantId)
      .eq("member_id", opts.memberId)
      .eq("status", "SECURED")
      .gte("timestamp", yStart)
      .lte("timestamp", yEnd)
      .order("timestamp", { ascending: true }),
  ]);

  if (error) {
    throw new Error(error.message);
  }
  if (ppErr) {
    throw new Error(ppErr.message);
  }

  const { data: allFunds, error: fundListErr } = await supabase
    .schema("parable_ledger")
    .from("ministry_funds")
    .select("id, is_restricted, fund_name, fund_code")
    .eq("tenant_id", opts.tenantId);
  if (fundListErr) {
    throw new Error(fundListErr.message);
  }

  const fundById: Record<string, { is_restricted: boolean; fund_name?: string; fund_code?: string }> = {};
  const fundByCode: Record<string, { id: string; is_restricted: boolean; fund_name?: string; fund_code?: string }> = {};
  for (const f of (allFunds ?? []) as Fund[]) {
    const entry = {
      is_restricted: !!f.is_restricted,
      fund_name: f.fund_name ?? undefined,
      fund_code: f.fund_code ?? undefined,
    };
    fundById[f.id] = entry;
    if (f.fund_code) {
      fundByCode[f.fund_code] = { id: f.id, ...entry };
    }
  }

  const list = (raw ?? []) as Tx[];
  const ppList = (ppRows ?? []) as { id: string; amount: string | number; timestamp: string; fund_id: string; status: string }[];

  const txFromParablePay: Tx[] = ppList.map((r) => {
    const f = fundByCode[r.fund_id];
    const fundUuid = f?.id ?? r.fund_id;
    return {
      id: `pp-${r.id}`,
      amount: r.amount,
      created_at: r.timestamp,
      tx_type: "donation",
      fund_id: fundUuid,
      metadata: { member_id: opts.memberId, parable_pay: true, member_contribution_id: r.id },
    };
  });

  const merged = [...list, ...txFromParablePay].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const s = summarizeGivingByRestriction(merged as never, fundById);
  const byCat = s.byCategory;
  const top = topGivingCategoryKey(byCat);
  const name = (opts.memberFullName || "Member").trim();
  const first = name.split(/\s+/)[0] || "Member";

  return {
    memberId: opts.memberId,
    year,
    total: s.total,
    unrestricted: s.unrestricted,
    restricted: s.restricted,
    byCategory: byCat,
    monthly: buildMonthlyGivingSeries(merged as never, year),
    topCategory: top,
    thankYou: buildThankYouLine({ memberFirstName: first, topCategory: top ?? "ministry", legalEntityName: opts.legalName }),
    memberFirstName: first,
  };
}

/**
 * Missions "impact" line: member’s share of giving to a named fund vs org total to that fund (narrative %).
 */
export async function orgFundTotalForNarrative(
  supabase: SupabaseClient,
  opts: { tenantId: string; year: number; fundNameSubstr: string | null },
): Promise<number> {
  if (!opts.fundNameSubstr) return 0;
  const yStart = new Date(Date.UTC(opts.year, 0, 1)).toISOString();
  const yEnd = new Date(Date.UTC(opts.year, 11, 31, 23, 59, 59, 999)).toISOString();
  const { data: funds, error: e1 } = await supabase
    .schema("parable_ledger")
    .from("ministry_funds")
    .select("id, fund_name")
    .eq("tenant_id", opts.tenantId)
    .ilike("fund_name", `%${opts.fundNameSubstr}%`);
  if (e1 || !funds?.length) return 0;
  const ids = (funds as { id: string }[]).map((f) => f.id);
  const { data: tx, error: e2 } = await supabase
    .schema("parable_ledger")
    .from("transactions")
    .select("amount")
    .eq("tenant_id", opts.tenantId)
    .in("tx_type", ["donation", "revenue"])
    .gte("created_at", yStart)
    .lte("created_at", yEnd)
    .in("fund_id", ids);
  if (e2 || !tx) return 0;
  return (tx as { amount: string }[]).reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0);
}

export { buildThankYouLine, buildGivingStatementHtml, formatImpactShare, summarizeGivingByRestriction } from "./givingReportFromRoot.js";
