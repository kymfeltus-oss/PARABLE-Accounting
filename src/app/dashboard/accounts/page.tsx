import type { Metadata } from "next";
import { Plus, ShieldCheck, Wallet } from "lucide-react";
import type { CoaListRow, LiveLedgerFeedRow } from "@/types/accounting";
import { addAccount } from "@/lib/actions/accounting";
import AccountingAudit from "@/components/AccountingAudit";
import LiveLedgerFeed from "@/components/LiveLedgerFeed";
import MinistryAppShell from "@/components/MinistryAppShell";
import { FOUNDRY_TENANT_ID } from "@/lib/accounting/foundry";
import { getSupabaseServerAnon } from "@/lib/supabase/server-anon";

export const metadata: Metadata = {
  title: "Institutional Ledger",
  description: "Chart of accounts and live general ledger view.",
};

export const dynamic = "force-dynamic";

function drCrForCategory(category: string): { label: string; className: string } {
  if (category === "Asset" || category === "Expense") {
    return { label: "debit", className: "text-cyan-400" };
  }
  return { label: "credit", className: "text-emerald-400" };
}

export default async function DashboardAccountsPage() {
  const supabase = getSupabaseServerAnon();
  if (!supabase) {
    return (
      <MinistryAppShell>
        <p className="p-6 text-sm text-red-400">Data connection is not configured. Set Supabase environment variables.</p>
      </MinistryAppShell>
    );
  }

  const [coaRes, feedRes] = await Promise.all([
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
      .limit(120),
  ]);

  if (coaRes.error) {
    return (
      <MinistryAppShell>
        <p className="p-6 text-sm text-red-400">Chart of accounts: {coaRes.error.message}</p>
      </MinistryAppShell>
    );
  }

  const accounts = (coaRes.data ?? []) as CoaListRow[];
  const feedItems: LiveLedgerFeedRow[] = !feedRes.error
    ? ((feedRes.data ?? []) as LiveLedgerFeedRow[]).map((r) => ({
        ...r,
        debit: Number(r.debit),
        credit: Number(r.credit),
      }))
    : [];

  return (
    <MinistryAppShell>
      <div className="min-h-full w-full max-w-[100%] bg-slate-950 text-slate-200 -mx-4 -mt-0 px-4 py-5 md:-mx-8 md:px-8 lg:px-10 lg:py-8">
        <AccountingAudit />

          <header className="mb-8 flex flex-col justify-between gap-6 border-b border-slate-800/80 pb-8 md:flex-row md:items-end">
            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-2 text-cyan-400">
                <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400/95">
                  Institutional verification
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Wallet className="hidden h-5 w-5 text-slate-600 sm:block" aria-hidden />
                <h1 className="text-3xl font-black tracking-tighter text-white sm:text-4xl">INSTITUTIONAL LEDGER</h1>
              </div>
              <p className="max-w-md text-sm text-slate-500">
                Unified chart of accounts with structured GAAP-style oversight and a real-time line feed.
              </p>
            </div>

            <form
              action={addAccount}
              className="flex w-full min-w-0 max-w-2xl flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4 ring-1 ring-cyan-400/10 md:max-w-xl lg:max-w-lg"
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
                <label className="font-mono text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  Code
                  <input
                    name="account_code"
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 4030"
                    required
                    className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950/90 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-400/50 focus:outline-none"
                  />
                </label>
                <label className="font-mono text-[9px] font-bold uppercase tracking-widest text-slate-500 sm:col-span-1">
                  Name
                  <input
                    name="account_name"
                    type="text"
                    placeholder="Operating — unrestricted"
                    required
                    className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950/90 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-400/50 focus:outline-none"
                  />
                </label>
                <label className="font-mono text-[9px] font-bold uppercase tracking-widest text-slate-500 sm:col-span-1">
                  Class
                  <select
                    name="category"
                    required
                    defaultValue=""
                    className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950/90 px-2 py-2 text-sm text-slate-200 focus:border-cyan-400/50 focus:outline-none"
                  >
                    <option value="" disabled>
                      Select
                    </option>
                    <option value="Asset">Asset</option>
                    <option value="Liability">Liability</option>
                    <option value="Net Asset">Net asset</option>
                    <option value="Income">Income</option>
                    <option value="Expense">Expense</option>
                  </select>
                </label>
                <label className="font-mono text-[9px] font-bold uppercase tracking-widest text-slate-500 sm:col-span-1">
                  Posture
                  <select
                    name="normal_balance"
                    required
                    defaultValue=""
                    className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950/90 px-2 py-2 text-sm text-slate-200 focus:border-cyan-400/50 focus:outline-none"
                  >
                    <option value="" disabled>
                      Select
                    </option>
                    <option value="debit">Debit</option>
                    <option value="credit">Credit</option>
                  </select>
                </label>
              </div>
              <button
                type="submit"
                className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-400 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-950 transition hover:bg-cyan-300"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Add fund
              </button>
            </form>
          </header>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-10">
            <div className="min-w-0 space-y-0 lg:col-span-2">
              <div className="overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-900/25 shadow-[0_0_0_1px_rgba(6,182,212,0.08)]">
                <div className="border-b border-slate-800 bg-slate-900/50 px-4 py-3">
                  <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-400/90">
                    Chart of accounts
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/80">
                        <th className="p-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">Code</th>
                        <th className="p-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">Account / fund</th>
                        <th className="p-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">Class</th>
                        <th className="p-3 text-right font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">Rule</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/90">
                      {accounts.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-slate-500">
                            No accounts in this tenant. Add a line to begin.
                          </td>
                        </tr>
                      ) : (
                        accounts.map((acc) => {
                          const rule = drCrForCategory(acc.category);
                          return (
                            <tr
                              key={acc.id}
                              className="transition-colors hover:bg-cyan-400/5"
                            >
                              <td className="p-3.5 font-mono font-bold tabular-nums text-cyan-400">{acc.account_code}</td>
                              <td className="p-3.5 font-medium text-slate-100">
                                {acc.account_name}
                                {acc.sub_category ? (
                                  <span className="ml-1.5 text-xs font-normal text-slate-500">· {acc.sub_category}</span>
                                ) : null}
                              </td>
                              <td className="p-3.5">
                                <span className="inline-flex rounded border border-slate-700/90 bg-slate-900/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                  {acc.account_type
                                    ? String(acc.account_type).replaceAll("_", " ")
                                    : acc.category}
                                </span>
                              </td>
                              <td className="p-3.5 text-right">
                                <span className={`text-xs font-bold uppercase ${rule.className}`}>{rule.label}</span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <aside className="min-w-0 lg:col-span-1">
              <div className="lg:sticky lg:top-4">
                {feedRes.error ? (
                  <p className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-sm text-amber-200/90">
                    Live feed unavailable: {feedRes.error.message}
                  </p>
                ) : (
                  <LiveLedgerFeed
                    items={feedItems}
                    className="border-cyan-400/15 ring-1 ring-cyan-400/10 [box-shadow:0_0_0_1px_rgba(34,211,238,0.06),0_12px_40px_rgba(0,0,0,0.45)]"
                  />
                )}
              </div>
            </aside>
          </div>
      </div>
    </MinistryAppShell>
  );
}
