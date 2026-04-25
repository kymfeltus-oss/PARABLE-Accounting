"use client";

import { useMemo, useState, type ReactNode } from "react";
import MinistryAppShell from "@/components/MinistryAppShell";
import CoaAddAccountSheet from "@/components/dashboard/CoaAddAccountSheet";

export type CoaListRow = {
  id: string;
  account_code: number;
  account_name: string;
  category: string;
  sub_category: string | null;
  account_type: string | null;
  is_restricted: boolean;
};

function normalForCategory(category: string): { label: string; className: string } {
  if (category === "Asset" || category === "Expense") {
    return { label: "DEBIT", className: "text-sky-400" };
  }
  return { label: "CREDIT", className: "text-emerald-400" };
}

type Props = {
  tenantLabel: string;
  accounts: CoaListRow[];
  error: string | null;
  /** Server components (e.g. AccountingAudit) passed from the page */
  children?: ReactNode;
};

export default function MasterCoaAccounts({ tenantLabel, accounts, error, children }: Props) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!q.trim()) return accounts;
    const s = q.trim().toLowerCase();
    return accounts.filter(
      (a) =>
        String(a.account_code).includes(s) ||
        a.account_name.toLowerCase().includes(s) ||
        a.category.toLowerCase().includes(s) ||
        (a.sub_category?.toLowerCase().includes(s) ?? false) ||
        (a.account_type?.toLowerCase().includes(s) ?? false),
    );
  }, [accounts, q]);

  if (error) {
    return (
      <MinistryAppShell>
        <div className="p-8 text-sm text-red-400">Error: {error}</div>
      </MinistryAppShell>
    );
  }

  return (
    <MinistryAppShell>
      <div className="p-6 md:p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          {children}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400/80">Parable ledger</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white md:text-3xl">Chart of accounts</h1>
              <p className="mt-1 text-sm text-white/45">Master UCOA — {tenantLabel}</p>
            </div>
            <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:max-w-md sm:flex-row sm:items-end sm:gap-2">
              <CoaAddAccountSheet />
              <div className="w-full min-w-0 sm:min-w-[220px] sm:max-w-xs sm:flex-1">
                <label className="sr-only" htmlFor="coa-search">
                  Search accounts
                </label>
                <input
                  id="coa-search"
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search code, name, category…"
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none ring-cyan-400/40 transition focus:ring-2"
                />
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0b] shadow-[0_0_0_1px_rgba(0,255,255,0.04)]">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-sm font-semibold text-white">Master ledger</h2>
              <p className="text-xs text-white/40">{filtered.length} of {accounts.length} accounts</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-bold uppercase tracking-wider text-white/50">
                    <th className="w-[100px] px-4 py-3">Code</th>
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Normal</th>
                    <th className="w-[120px] px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-white/90">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-white/40">
                        No accounts match this search.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((account) => {
                      const n = normalForCategory(account.category);
                      return (
                        <tr
                          key={account.id}
                          className="transition hover:bg-white/[0.03]"
                        >
                          <td className="px-4 py-3 font-mono text-sm font-bold tabular-nums text-cyan-200/90">
                            {account.account_code}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-white">{account.account_name}</span>
                            {account.sub_category ? (
                              <span className="ml-2 text-xs text-white/35">· {account.sub_category}</span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-sm text-white/50">{account.category}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/70">
                              {account.account_type?.replaceAll("_", " ") ?? "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold ${n.className}`}>{n.label}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {account.is_restricted ? (
                              <span className="inline-flex rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200">
                                Restricted
                              </span>
                            ) : (
                              <span className="inline-flex rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300/90">
                                Active
                              </span>
                            )}
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
      </div>
    </MinistryAppShell>
  );
}
