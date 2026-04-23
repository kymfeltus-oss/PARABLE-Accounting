"use client";

import { useCallback, useEffect, useState } from "react";
import { useBrand } from "@/components/branding/BrandProvider";
import { getSupabaseBrowser } from "@/lib/supabase/browser-client";
import { buildRestrictedReleaseJournalLines, canCoverCapExFromBuildingFund } from "@/lib/growthFromRoot.js";
import type { ProjectTrackerProject } from "./projectTrackerTypes";

type FundRow = { id: string; fund_name: string; balance: number; fund_code: string };

type ApRow = {
  id: string;
  project_id: string | null;
  amount: number;
  status: string;
  vendor_name: string;
  milestone_label: string | null;
  invoice_url: string | null;
};

type CapexRow = {
  id: string;
  name: string;
  description: string | null;
  budget: number;
  retainage: number;
  status: string;
  fund_id: string;
  __fund?: FundRow | null;
};

function toProjectModel(p: CapexRow, apPaid: number): ProjectTrackerProject {
  const spent = apPaid;
  const b = Math.max(0, Number(p.budget) || 0);
  const r = Math.max(0, Number(p.retainage) || 0);
  const f = p.__fund;
  return {
    id: p.id,
    name: p.name,
    fundName: f?.fund_name ?? "Building & restoration",
    fundCode: f?.fund_code ?? "BLD",
    budget: b,
    spent,
    retainage: r,
  };
}

export default function ProjectTracker() {
  const { tenant, ready } = useBrand();
  const supabase = getSupabaseBrowser();
  const [list, setList] = useState<CapexRow[]>([]);
  const [apByProject, setApByProject] = useState<Record<string, ApRow[]>>({});
  const [err, setErr] = useState<string | null>(null);
  const [proposed, setProposed] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showJe, setShowJe] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !tenant?.id) {
      setLoading(false);
      return;
    }
    setErr(null);
    setLoading(true);
    const { data: projects, error: e1 } = await supabase
      .schema("parable_ledger")
      .from("capex_projects")
      .select("id, name, description, budget, retainage, status, fund_id")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false });
    if (e1) {
      setErr(e1.message.includes("does not exist") ? "Run migration: 20250423320000_capex_projects_members.sql" : e1.message);
      setList([]);
      setApByProject({});
      setLoading(false);
      return;
    }
    const base = (projects ?? []) as Omit<CapexRow, "__fund">[];
    const fundIds = [...new Set(base.map((b) => b.fund_id).filter(Boolean))] as string[];
    let fundById: Record<string, FundRow> = {};
    if (fundIds.length > 0) {
      const { data: funds } = await supabase
        .schema("parable_ledger")
        .from("ministry_funds")
        .select("id, fund_name, balance, fund_code")
        .in("id", fundIds);
      for (const f of (funds ?? []) as FundRow[]) {
        fundById[f.id] = f;
      }
    }
    const prows: CapexRow[] = base.map((b) => ({ ...b, __fund: fundById[b.fund_id] ?? null }));
    setList(prows);
    if (prows.length === 0) {
      setApByProject({});
      setLoading(false);
      return;
    }
    const { data: ap, error: e2 } = await supabase
      .schema("parable_ledger")
      .from("accounts_payable")
      .select("id, amount, status, vendor_name, milestone_label, invoice_url, project_id")
      .eq("tenant_id", tenant.id)
      .in(
        "project_id",
        prows.map((p) => p.id)
      );
    if (e2) {
      setApByProject({});
    } else {
      const m: Record<string, ApRow[]> = {};
      for (const a of (ap ?? []) as ApRow[]) {
        if (!a.project_id) continue;
        m[a.project_id] = m[a.project_id] ?? [];
        m[a.project_id].push(a);
      }
      setApByProject(m);
    }
    setLoading(false);
  }, [supabase, tenant?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="p-6 text-sm text-zinc-500">Loading project tracker…</p>;
  }

  if (err) {
    return <p className="p-6 text-sm text-red-400">{err}</p>;
  }

  if (list.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/15 bg-[#050505] p-8 text-white/70">
        <h2 className="text-lg font-bold text-white">No CapEx projects yet</h2>
        <p className="mt-1 text-sm">After migration, add rows to <code className="text-cyan-300/90">capex_projects</code> (linked to your Building <code>BLD</code> fund).</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {list.map((p) => {
        const aps = apByProject[p.id] ?? [];
        const paid = aps.filter((a) => a.status === "paid").reduce((s, a) => s + (Number(a.amount) || 0), 0);
        const project = toProjectModel(p, paid);
        const fundBalance = p.__fund?.balance ?? 0;
        const prop = Number(proposed[p.id] ?? 0) || 0;
        const cap = canCoverCapExFromBuildingFund(fundBalance, project.spent, project.retainage, prop);
        const pct = project.budget > 0 ? Math.min(100, (project.spent / project.budget) * 100) : 0;
        return (
          <div key={p.id} className="rounded-3xl border border-white/10 bg-[#050505] p-6 text-white sm:p-8" style={{ boxShadow: "0 0 24px color-mix(in srgb, var(--brand-cyber, #22d3ee) 0.05, transparent)" }}>
            <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <h2 className="text-2xl font-black uppercase italic tracking-tighter sm:text-3xl">{project.name}</h2>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--brand-cyber, #22d3ee)" }}>
                  Fund: {project.fundName} ({project.fundCode})
                </p>
                {p.description && <p className="mt-1 text-sm text-zinc-500">{p.description}</p>}
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase opacity-40">Project budget</p>
                <p className="font-mono text-2xl">${project.budget.toLocaleString()}</p>
                <p className="text-[9px] text-zinc-500">Fund balance: ${Number(fundBalance).toLocaleString()}</p>
              </div>
            </div>

            <div className="mb-6 h-4 w-full overflow-hidden rounded-full border border-white/10 bg-white/5">
              <div className="h-full bg-cyan-400 transition-all" style={{ width: `${pct}%`, boxShadow: "0 0 15px #22d3ee" }} />
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                <p className="mb-1 text-[10px] uppercase opacity-40">Total spent (AP paid)</p>
                <p className="text-lg font-bold">${project.spent.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                <p className="mb-1 text-[10px] uppercase opacity-40">Contractor retainage</p>
                <p className="text-lg font-bold">${project.retainage.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                <p className="mb-1 text-[10px] uppercase opacity-40">Remaining budget</p>
                <p className="text-lg font-bold" style={{ color: "var(--brand-cyber, #22d3ee)" }}>
                  ${(project.budget - project.spent).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Test proposed draw (CapEx check)</label>
                <input
                  type="number"
                  className="mt-1 w-full max-w-xs rounded border border-zinc-800 bg-black/50 px-2 py-1.5 font-mono text-sm"
                  placeholder="0"
                  value={proposed[p.id] ?? ""}
                  onChange={(e) => setProposed((x) => ({ ...x, [p.id]: e.target.value }))}
                />
              </div>
              <p className={"text-sm " + (cap.ok ? "text-emerald-400/90" : "text-amber-200/90")}>{cap.message}</p>
            </div>

            <div className="mb-4 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3 text-xs text-zinc-400">
              <p className="text-[9px] font-bold uppercase text-zinc-500">Invoices & milestones (maintenance hub)</p>
              {aps.length === 0 ? (
                <p className="mt-1">No AP lines linked to this project. Set <code className="text-cyan-200/80">project_id</code> on payables when posting.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {aps.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-1 border-b border-white/5 py-1 font-mono text-[10px]">
                      <span>{a.vendor_name}</span>
                      <span>{a.milestone_label || "—"}</span>
                      <span>{a.status}</span>
                      <span className="text-cyan-200/80">${Number(a.amount).toFixed(2)}</span>
                      {a.invoice_url && (
                        <a href={a.invoice_url} target="_blank" rel="noreferrer" className="text-cyan-400 underline">
                          invoice
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowJe((x) => (x === p.id ? null : p.id))}
                className="w-full rounded-xl border border-white/10 bg-white/5 py-3 text-xs font-bold uppercase transition hover:border-cyan-500/50 sm:w-auto"
              >
                {showJe === p.id ? "Hide" : "View"} restricted release J/E (3100 / 3010) — demo
              </button>
            </div>
            {showJe === p.id && prop > 0 && (
              <pre className="mt-3 max-h-48 overflow-auto rounded-lg border border-white/5 bg-black/50 p-3 text-[10px] text-cyan-100/90">
                {JSON.stringify(
                  buildRestrictedReleaseJournalLines(prop, { projectId: p.id, memo: `Release for ${p.name}` }),
                  null,
                  2
                )}
              </pre>
            )}

            {!ready && <p className="mt-3 text-xs text-amber-200/80">Configure tenant to persist projects.</p>}
          </div>
        );
      })}
    </div>
  );
}
