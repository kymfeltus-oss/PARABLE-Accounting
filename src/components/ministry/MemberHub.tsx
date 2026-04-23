"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useBrand } from "@/components/branding/BrandProvider";
import { getSupabaseBrowser } from "@/lib/supabase/browser-client";
import { averageMonthlyGivingSustainability, calculateMemberYOY } from "@/lib/growthFromRoot.js";
import MemberDossier, { type DossierMember } from "@/components/ministry/MemberDossier";

type Member = {
  id: string;
  full_name: string;
  member_kind: "active" | "inactive" | "digital";
  joined_at: string | null;
  created_at: string;
  onboarding_stage?: "welcome" | "stewardship" | "discovery" | "active";
};

type Steward = { ytd_giving: number; member_id: string };

const DEMO: Member[] = [
  { id: "0", full_name: "Riley C.", member_kind: "active", joined_at: "2026-01-10", created_at: "2026-01-10" },
  { id: "1", full_name: "Jordan T.", member_kind: "digital", joined_at: "2026-02-02", created_at: "2026-02-02" },
];

export default function MemberHub() {
  const { tenant, ready } = useBrand();
  const supabase = getSupabaseBrowser();
  const [members, setMembers] = useState<Member[]>([]);
  const [ytdByMember, setYtdByMember] = useState<Record<string, number>>({});
  const [err, setErr] = useState<string | null>(null);
  const [useDemo, setUseDemo] = useState(false);
  const [dossier, setDossier] = useState<DossierMember | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !tenant?.id) return;
    setErr(null);
    const r0 = await supabase
      .schema("parable_ledger")
      .from("congregation_members")
      .select("id, full_name, member_kind, joined_at, created_at, onboarding_stage")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false });
    const r1 =
      r0.error && (r0.error.message.toLowerCase().includes("onboarding") || r0.error.message.includes("column"))
        ? await supabase
            .schema("parable_ledger")
            .from("congregation_members")
            .select("id, full_name, member_kind, joined_at, created_at")
            .eq("tenant_id", tenant.id)
            .order("created_at", { ascending: false })
        : null;
    const { data, error } = r1 && !r1.error ? r1 : r0;
    if (error) {
      if (error.message.includes("does not exist")) {
        setErr("Run migration: 20250423320000_capex_projects_members.sql");
        return;
      }
      setErr(error.message);
      return;
    }
    setMembers((data ?? []) as Member[]);
    if (!data || data.length === 0) {
      setUseDemo(true);
    } else {
      setUseDemo(false);
    }
    const { data: stew, error: e2 } = await supabase
      .schema("parable_ledger")
      .from("v_member_stewardship_giving")
      .select("member_id, ytd_giving")
      .eq("tenant_id", tenant.id);
    if (!e2 && stew) {
      const m: Record<string, number> = {};
      for (const s of stew as unknown as (Steward & { tenant_id: string })[]) {
        m[s.member_id] = Number(s.ytd_giving) || 0;
      }
      setYtdByMember(m);
    }
  }, [supabase, tenant?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useDemo ? DEMO : members;
  const yoy = useMemo(
    () =>
      calculateMemberYOY(
        rows.map((r) => ({ id: r.id, created_at: r.joined_at ? `${r.joined_at}T12:00:00Z` : r.created_at })),
        new Date()
      ),
    [rows]
  );
  const total = rows.length;
  const ytdNew = useMemo(() => {
    const y0 = new Date().getUTCFullYear();
    return rows.filter((m) => {
      const t = m.joined_at || m.created_at;
      if (!t) return false;
      return new Date(t).getUTCFullYear() === y0;
    }).length;
  }, [rows]);

  const actives = useMemo(
    () => Math.max(1, rows.filter((m) => m.member_kind === "active" || m.member_kind === "digital").length),
    [rows]
  );
  const ytdG = useMemo(
    () => (useDemo ? 12400.5 : Object.values(ytdByMember).reduce((a, b) => a + b, 0)),
    [useDemo, ytdByMember]
  );
  const monthN = new Date().getMonth() + 1;
  const partPct = useMemo(
    () =>
      useDemo
        ? 42
        : Math.min(100, (Object.keys(ytdByMember).filter((k) => (ytdByMember[k] ?? 0) > 0).length / actives) * 100) || 0,
    [useDemo, ytdByMember, actives]
  );
  const avMonthly = useMemo(
    () => averageMonthlyGivingSustainability(ytdG, monthN, actives),
    [ytdG, monthN, actives]
  );

  return (
    <div className="space-y-10 p-2 text-white sm:p-4" style={{ background: "linear-gradient(180deg,#0a0a0a, #050505 40%)" }}>
      <p className="text-center text-[9px] uppercase tracking-widest text-zinc-500">
        Congregation side — org payroll &amp; staff onboarding:{" "}
        <Link href="/staff-onboarding" className="text-cyan-500/80 hover:underline">
          Staff Genesis
        </Link>
      </p>
      {useDemo && <p className="text-center text-xs text-amber-200/80">Demo sample — add rows to congregation_members to replace.</p>}
      {err && <p className="text-center text-sm text-red-400">{err}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {[
          { k: "Total (shown)", v: String(total) },
          { k: "YTD new (join this year)", v: `+${ytdNew}` },
          { k: "YoY growth (joins, this month vs last year)", v: yoy.yoyPercent == null ? "—" : `${yoy.yoyPercent > 0 ? "+" : ""}${yoy.yoyPercent}%` },
          { k: "Est. giving participation (active w/ $)", v: `${useDemo ? "42" : partPct.toFixed(0)}%` },
        ].map((c) => (
          <div key={c.k} className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-white/40">{c.k}</p>
            <h3 className="text-3xl font-black italic" style={c.k.includes("YTD") ? { color: "var(--brand-cyber, #22d3ee)" } : {}}>
              {c.v}
            </h3>
          </div>
        ))}
        <div className="rounded-3xl border border-violet-500/20 bg-violet-950/20 p-5 lg:col-span-4">
          <p className="text-[9px] font-bold uppercase tracking-widest text-violet-200/70">Sustainability: avg monthly / active (YTD ÷ month ÷ actives)</p>
          <p className="mt-1 text-2xl font-mono text-violet-100/90">
            {avMonthly.toLocaleString("en-US", { style: "currency", currency: "USD" })}
          </p>
          <p className="mt-1 text-[10px] text-zinc-500">View source: v_member_stewardship_giving + members (metadata.member_id on donations for live data).</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <h4 className="text-xs font-bold uppercase tracking-widest">Recent members — click a row for full dossier</h4>
          <button
            type="button"
            className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--brand-cyber, #22d3ee)" }}
            disabled
          >
            Roster export (coming soon)
          </button>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="text-[9px] uppercase text-white/40">
            <tr>
              <th className="p-4">Name</th>
              <th className="p-4">Join / created</th>
              <th className="p-4">Type</th>
              <th className="p-4">YTD (linked)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-zinc-200">
            {rows.slice(0, 20).map((m) => (
              <tr
                key={m.id}
                className="hover:bg-white/[0.04] cursor-pointer"
                onClick={() =>
                  setDossier({
                    id: m.id,
                    full_name: m.full_name,
                    member_kind: m.member_kind,
                    joined_at: m.joined_at,
                    created_at: m.created_at,
                    onboarding_stage: m.onboarding_stage,
                  })
                }
              >
                <td className="p-4 font-semibold">{m.full_name}</td>
                <td className="p-4 font-mono text-xs opacity-70">{(m.joined_at || m.created_at).slice(0, 10)}</td>
                <td className="p-4 text-xs text-zinc-400">{m.member_kind}</td>
                <td className="p-4 font-mono text-xs text-cyan-200/80">
                  {useDemo ? "—" : (ytdByMember[m.id] ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!ready && <p className="text-xs text-amber-200/80">Set tenant slug in env.</p>}

      <MemberDossier
        member={dossier}
        onClose={() => setDossier(null)}
        ytdCentsOrUsd={dossier ? (useDemo ? 0 : ytdByMember[dossier.id] ?? 0) : undefined}
        useDemoData={useDemo}
      />
    </div>
  );
}
