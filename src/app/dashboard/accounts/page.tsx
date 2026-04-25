import type { Metadata } from "next";
import type { CoaListRow } from "@/types/accounting";
import AccountingAudit from "@/components/AccountingAudit";
import CoaManagerTable from "@/components/dashboard/CoaManagerTable";
import LiveLedgerFeed from "@/components/LiveLedgerFeed";
import QuickAddFund from "@/components/dashboard/QuickAddFund";
import MinistryAppShell from "@/components/MinistryAppShell";
import { FOUNDRY_TENANT_ID } from "@/lib/accounting/foundry";
import { getSupabaseServerAnon } from "@/lib/supabase/server-anon";
import type { LiveLedgerFeedRow } from "@/types/accounting";

export const metadata: Metadata = {
  title: "Chart of accounts · Accounting",
  description: "Foundry-scoped UCOA with live ledger and audit feed.",
};

export const dynamic = "force-dynamic";

export default async function DashboardAccountsPage() {
  const supabase = getSupabaseServerAnon();

  if (!supabase) {
    return (
      <MinistryAppShell>
        <div className="p-8 text-sm text-red-400">Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and ANON key.</div>
      </MinistryAppShell>
    );
  }

  const [{ data: coa, error: coaErr }, { data: feedRaw, error: feedErr }] = await Promise.all([
    supabase
      .from("chart_of_accounts")
      .select("id, account_code, account_name, category, sub_category, account_type, is_restricted")
      .eq("tenant_id", FOUNDRY_TENANT_ID)
      .order("account_code", { ascending: true }),
    supabase
      .from("view_live_ledger_feed")
      .select("id, tenant_id, created_at, account_code, account_name, debit, credit, narrative, journal_entry_id")
      .eq("tenant_id", FOUNDRY_TENANT_ID)
      .order("created_at", { ascending: false })
      .limit(80),
  ]);

  if (coaErr) {
    return (
      <MinistryAppShell>
        <div className="p-8 text-sm text-red-400">Chart load failed: {coaErr.message}</div>
      </MinistryAppShell>
    );
  }

  const accounts = (coa ?? []) as CoaListRow[];
  const feedItems: LiveLedgerFeedRow[] =
    !feedErr && feedRaw
      ? (feedRaw as LiveLedgerFeedRow[]).map((r) => ({
          ...r,
          debit: Number(r.debit),
          credit: Number(r.credit),
        }))
      : [];

  return (
    <MinistryAppShell>
      <div className="p-4 md:p-6">
        <AccountingAudit />

        <div className="mx-auto max-w-7xl space-y-6">
          <header>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-500/90">Foundry · accounting</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-100">Chart of accounts</h1>
            <p className="mt-0.5 max-w-2xl text-sm text-slate-500">
              Machine-assisted ERP surface: unified chart, live general ledger line feed, and automated exception surfacing.
            </p>
          </header>

          <LiveLedgerFeed items={feedItems} />
          <QuickAddFund />
          <CoaManagerTable accounts={accounts} />
        </div>
      </div>
    </MinistryAppShell>
  );
}
