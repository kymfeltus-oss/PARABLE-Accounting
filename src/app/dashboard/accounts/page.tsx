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
  title: "Institutional Ledger · Accounting",
  description: "Foundry-scoped UCOA with live general ledger view.",
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
      <div className="w-full min-w-0">
        <AccountingAudit />

        <div className="mx-auto max-w-7xl space-y-5 px-4 py-4 md:space-y-6 md:px-6 md:py-6">
          <header
            className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.08] to-white/[0.03] px-5 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md backdrop-saturate-150 sm:px-6 sm:py-5"
            style={{ WebkitBackdropFilter: "blur(12px) saturate(1.2)" }}
          >
            <h1 className="text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">Institutional Ledger</h1>
          </header>

          <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="min-w-0 space-y-5 lg:col-span-2 lg:space-y-5">
              <QuickAddFund />
              <CoaManagerTable accounts={accounts} />
            </div>
            <aside className="min-w-0 lg:col-span-1">
              <div className="lg:sticky lg:top-4">
                <LiveLedgerFeed
                  items={feedItems}
                  className="shadow-lg shadow-cyan-900/5 ring-1 ring-cyan-500/10 [box-shadow:0_4px_24px_rgba(0,0,0,0.3)]"
                />
              </div>
            </aside>
          </div>
        </div>
      </div>
    </MinistryAppShell>
  );
}
