import type { SupabaseClient } from "@supabase/supabase-js";

export type ApRow = {
  id: string;
  vendor_name: string;
  amount: number;
  status: string;
  due_date: string | null;
  invoice_url: string | null;
};

export type ArRow = {
  id: string;
  payer_name: string;
  amount_due: number;
  amount_paid: number;
  due_date: string | null;
  category: string | null;
  is_restricted: boolean;
  fund_code: string | null;
};

export type MonthEndCloseStatus = {
  /** Bills not yet paid (pending or approved) */
  unpaidBills: number;
  /** Count of AR rows with balance remaining */
  openPledges: number;
  /** Sum of remaining AR balance (for display) */
  openArBalance: number;
  canSeal: boolean;
  apRows: ApRow[];
  arRows: ArRow[];
};

const OPEN_AP = (s: string) => s === "pending" || s === "approved";

/**
 * Unpaid AP + open AR block the month-end seal.
 */
export async function loadSubledgerForMonthEnd(supabase: SupabaseClient, tenantId: string): Promise<MonthEndCloseStatus> {
  const [{ data: apData, error: apErr }, { data: arData, error: arErr }] = await Promise.all([
    supabase
      .schema("parable_ledger")
      .from("accounts_payable")
      .select("id, vendor_name, amount, status, due_date, invoice_url")
      .eq("tenant_id", tenantId)
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .schema("parable_ledger")
      .from("accounts_receivable")
      .select("id, payer_name, amount_due, amount_paid, due_date, category, is_restricted, fund_code")
      .eq("tenant_id", tenantId)
      .order("due_date", { ascending: true, nullsFirst: false }),
  ]);

  if (apErr) throw new Error(`AP: ${apErr.message}`);
  if (arErr) throw new Error(`AR: ${arErr.message}`);

  const apRows = (apData ?? []) as ApRow[];
  const arRows = (arData ?? []) as ArRow[];

  const unpaidBills = apRows.filter((r) => OPEN_AP(r.status)).length;
  const openAr = arRows.filter((r) => Number(r.amount_due) - Number(r.amount_paid) > 0.01);
  const openPledges = openAr.length;
  const openArBalance = openAr.reduce((a, r) => a + (Number(r.amount_due) - Number(r.amount_paid)), 0);

  const canSeal = unpaidBills === 0 && openPledges === 0;

  return {
    unpaidBills,
    openPledges,
    openArBalance: Math.round(openArBalance * 100) / 100,
    canSeal,
    apRows,
    arRows,
  };
}
