"use client";

import { useMemo, useState } from "react";
import type { CoaListRow } from "@/types/accounting";

type Props = { accounts: CoaListRow[] };

function normalForCategory(category: string): { label: string; className: string } {
  if (category === "Asset" || category === "Expense") {
    return { label: "Dr", className: "text-cyan-500" };
  }
  return { label: "Cr", className: "text-cyan-600" };
}

export default function CoaManagerTable({ accounts }: Props) {
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

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/50 shadow-xl">
      <div className="border-b border-slate-800 bg-slate-900/90 px-4 py-3">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-bold text-slate-200">Chart of accounts</h2>
            <p className="text-xs text-slate-500">Foundry tenant · parable_ledger.chart_of_accounts</p>
          </div>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter code, name, class…"
            className="w-full max-w-xs rounded-md border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm text-slate-200">
          <thead>
            <tr className="border-b border-slate-800/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <th className="w-24 px-3 py-2.5">Code</th>
              <th className="px-3 py-2.5">Name</th>
              <th className="w-32 px-3 py-2.5">Class</th>
              <th className="w-32 px-3 py-2.5">Type</th>
              <th className="w-20 px-3 py-2.5">Dr/Cr</th>
              <th className="w-28 text-right px-3 py-2.5">Posture</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-slate-500">
                  No records match. Adjust filters or add a line with Quick add.
                </td>
              </tr>
            ) : (
              filtered.map((a) => {
                const n = normalForCategory(a.category);
                return (
                  <tr key={a.id} className="hover:bg-slate-900/60">
                    <td className="px-3 py-2.5 font-mono text-cyan-400 tabular-nums">{a.account_code}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-100">
                      {a.account_name}
                      {a.sub_category ? (
                        <span className="ml-1.5 text-xs font-normal text-slate-500">· {a.sub_category}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-slate-400">{a.category}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">
                      {a.account_type ? a.account_type.replaceAll("_", " ") : "—"}
                    </td>
                    <td className={`px-3 py-2.5 text-xs font-bold ${n.className}`}>{n.label}</td>
                    <td className="px-3 py-2.5 text-right">
                      {a.is_restricted ? (
                        <span className="text-[10px] font-bold uppercase text-amber-500/90">Encumbered</span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase text-cyan-600/90">Unrestricted</span>
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
  );
}
