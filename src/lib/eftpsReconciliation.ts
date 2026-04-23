import type { SupabaseClient } from "@supabase/supabase-js";
import { getDepositorFlags, getDepositStatus } from "../../depositLogic.js";
import { getQuarterlyTotals, type QuarterlyTotals } from "./taxAggregationFromLedger";
import { getQuarterDateRangeIso } from "../../taxLogic.js";

type Quarter = 1 | 2 | 3 | 4;

/**
 * Form 941-modeled deposit liability: FIT withheld + employee + employer FICA on 5a base
 * (matches QuarterlyReview total block).
 */
export function quarterLiabilityFromTotals(t: Pick<QuarterlyTotals, "line3" | "employerFicaMatch">): number {
  const fica = (t.employerFicaMatch ?? 0) * 2;
  return round2((t.line3 ?? 0) + fica);
}

/**
 * four consecutive calendar quarters *ending* at (year, quarter) — e.g. 2024 Q1 →
 * 2023 Q2, Q3, Q4, 2024 Q1.
 */
export function fourQuartersEnding(year: number, quarter: Quarter): Array<{ year: number; quarter: Quarter }> {
  const r: Array<{ year: number; quarter: Quarter }> = [];
  let y = year;
  let q: number = quarter;
  for (let i = 0; i < 4; i++) {
    r.push({ year: y, quarter: q as Quarter });
    q -= 1;
    if (q < 1) {
      q = 4;
      y -= 1;
    }
  }
  return r;
}

/**
 * Total modeled employment taxes in the 4Q lookback period (for depositor class).
 * Does not persist; uses live `getQuarterlyTotals` per quarter.
 */
export async function getLookbackLiability(
  supabase: SupabaseClient,
  tenantId: string,
  year: number,
  quarter: Quarter,
): Promise<number> {
  const qtrs = fourQuartersEnding(year, quarter);
  let sum = 0;
  for (const { year: y, quarter: q } of qtrs) {
    const t = await getQuarterlyTotals(supabase, tenantId, y, q, { persist: false });
    sum += quarterLiabilityFromTotals(t);
  }
  return round2(sum);
}

const EFTPS_RE = /eftps|irs[\s,]*usa[\s,]*tax|irs[\s,]*tax[\s,]*(pymt|payment|eft)/i;

/**
 * @param m — metadata
 */
function metadataSearchBlob(m: Record<string, unknown> | null | undefined): string {
  if (!m || typeof m !== "object") return "";
  const keys = ["description", "memo", "bank_memo", "narrative", "payee", "import_note", "plaid_name"] as const;
  return keys.map((k) => (m[k] != null ? String(m[k]) : "")).join(" ");
}

/**
 * @param r — row from `parable_ledger.transactions`
 */
export function rowLooksLikeEftpsPayment(r: { source: string | null; metadata: unknown; tx_type?: string | null }): boolean {
  if (r.metadata && typeof r.metadata === "object") {
    const o = r.metadata as Record<string, unknown>;
    if (o.irs_eftps === true || o.eftps === true) return true;
  }
  const s = (r.source ?? "") + " " + metadataSearchBlob((r.metadata as Record<string, unknown> | null) ?? undefined);
  if (EFTPS_RE.test(s)) return true;
  if (/irs\s*usa\s*tax/i.test(s)) return true;
  if (/\beftps\b/i.test(s)) return true;
  return false;
}

/**
 * Sums in-quarter transactions that look like EFTPS / federal tax from bank import.
 * Uses absolute `amount` as the payment (expense is typically the dominant sign).
 */
export async function matchEFTPSPayments(
  supabase: SupabaseClient,
  tenantId: string,
  year: number,
  quarter: Quarter,
): Promise<{ totalDetected: number; matchCount: number; txIds: string[] }> {
  const { start, end } = getQuarterDateRangeIso(year, quarter);

  const { data, error } = await supabase
    .schema("parable_ledger")
    .from("transactions")
    .select("id, amount, source, tx_type, metadata, created_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", start)
    .lte("created_at", end);

  if (error) throw new Error(`matchEFTPSPayments: ${error.message}`);

  let total = 0;
  const txIds: string[] = [];
  for (const row of data ?? []) {
    if (!rowLooksLikeEftpsPayment(row as { source: string | null; metadata: unknown; tx_type: string })) continue;
    total += Math.abs(Number(row.amount) || 0);
    txIds.push(String(row.id));
  }

  return {
    totalDetected: round2(total),
    matchCount: txIds.length,
    txIds,
  };
}

export { getDepositStatus, getDepositorFlags };

type DepositStatus = ReturnType<typeof getDepositStatus>;
type DepositorFlags = ReturnType<typeof getDepositorFlags>;
export type { DepositStatus, DepositorFlags };

/**
 * @param onLookbackError — e.g. network; we still return deposit line status using 0 lookback
 */
export async function buildEftpsDepositView(
  supabase: SupabaseClient,
  tenantId: string,
  year: number,
  quarter: Quarter,
  liabilityFromTotals: number,
  onLookbackError?: (msg: string) => void,
): Promise<{
  eftps: Awaited<ReturnType<typeof matchEFTPSPayments>>;
  lookback: number;
  status: ReturnType<typeof getDepositStatus>;
  depositor: ReturnType<typeof getDepositorFlags>;
}> {
  const eftps = await matchEFTPSPayments(supabase, tenantId, year, quarter);
  let lookback = 0;
  try {
    lookback = await getLookbackLiability(supabase, tenantId, year, quarter);
  } catch (e) {
    onLookbackError?.(e instanceof Error ? e.message : "lookback failed");
    lookback = round2(liabilityFromTotals);
  }
  const status = getDepositStatus(round2(liabilityFromTotals), eftps.totalDetected, { lookbackLiability: lookback });
  return { eftps, lookback, status, depositor: getDepositorFlags(lookback) };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
