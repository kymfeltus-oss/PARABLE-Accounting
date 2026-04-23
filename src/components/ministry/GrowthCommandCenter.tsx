"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBrand } from "@/components/branding/BrandProvider";
import { getSupabaseBrowser } from "@/lib/supabase/browser-client";
import { calculateMemberYOY } from "@/lib/growthFromRoot.js";
import {
  computeFunnelCounts,
  effectiveOnboardingStage,
} from "@/lib/onboardingFromRoot.js";

type OnboardingKey = "welcome" | "stewardship" | "discovery" | "active";

type Row = {
  id: string;
  full_name: string;
  member_kind: "active" | "inactive" | "digital";
  joined_at: string | null;
  created_at: string;
  onboarding_stage?: OnboardingKey;
};

const STAGES: { key: OnboardingKey; label: string }[] = [
  { key: "welcome", label: "Welcome" },
  { key: "stewardship", label: "Stewardship" },
  { key: "discovery", label: "Discovery" },
  { key: "active", label: "Active" },
];

const DEMO: Row[] = [
  { id: "d0", full_name: "Riley C.", member_kind: "active", joined_at: "2026-01-10", created_at: "2026-01-10T12:00:00Z", onboarding_stage: "welcome" },
  { id: "d1", full_name: "Jordan T.", member_kind: "digital", joined_at: "2026-02-02", created_at: "2026-02-02T12:00:00Z", onboarding_stage: "stewardship" },
  { id: "d2", full_name: "Sam A.", member_kind: "active", joined_at: "2026-01-20", created_at: "2026-01-20T12:00:00Z", onboarding_stage: "discovery" },
  { id: "d3", full_name: "Alex M.", member_kind: "active", joined_at: "2025-10-15", created_at: "2025-10-15T12:00:00Z", onboarding_stage: "active" },
];

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"] as const;

function monthBucketsYtdCount(rows: Row[], year: number): number[] {
  const c = new Array(12).fill(0) as number[];
  for (const m of rows) {
    const t = m.joined_at || m.created_at;
    if (!t) continue;
    const d = new Date(t);
    if (d.getUTCFullYear() !== year) continue;
    const mo = d.getUTCMonth();
    c[mo] = (c[mo] || 0) + 1;
  }
  return c;
}

function buildGivingCumulativeSeries(totalYtd: number, nowM: number): number[] {
  if (nowM < 0 || nowM > 11) return new Array(12).fill(0);
  return MONTHS.map((_, i) => (i > nowM ? 0 : (totalYtd * (i + 1)) / (nowM + 1)));
}

function normSeries(values: number[]): number[] {
  const mx = Math.max(1, ...values.map((v) => Math.abs(v)));
  return values.map((v) => (mx <= 0 ? 0 : v / mx));
}

type PulsePoint = { m: (typeof MONTHS)[number]; members: number; giving: number };

function PulseChart({ points, glow }: { points: PulsePoint[]; glow: string }) {
  const w = 100;
  const h = 46;
  const n = points.length;
  if (n < 1) return null;
  const mem = points.map((p) => p.members);
  const giv = points.map((p) => p.giving);
  const nm = normSeries(mem);
  const ng = normSeries(giv);
  const toPoly = (arr: number[]) =>
    arr
      .map((t, i) => {
        const x = n <= 1 ? 50 : (i / (n - 1)) * w;
        const y = h - t * (h - 4) - 2;
        return `${i === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h + 6}`} className="h-36 w-full max-w-xl" role="img" aria-label="Pulse: new members vs giving YTD">
      <defs>
        <filter id="pulseGlow" x="-20%" y="-20%" width="140%" height="160%">
          <feGaussianBlur stdDeviation="0.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="gLine" x1="0" y1="0" x2="1" y2="0">
          <stop stopColor={glow} stopOpacity="0.15" offset="0%" />
          <stop stopColor={glow} stopOpacity="1" offset="50%" />
          <stop stopColor={glow} stopOpacity="0.15" offset="100%" />
        </linearGradient>
      </defs>
      <g filter="url(#pulseGlow)">
        <path d={toPoly(ng)} fill="none" stroke="rgba(120,200,255,0.4)" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" />
        <path d={toPoly(nm)} fill="none" stroke="url(#gLine)" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" style={{ color: glow }} />
      </g>
    </svg>
  );
}

const glass =
  "rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md";

export default function GrowthCommandCenter() {
  const { tenant } = useBrand();
  const supabase = getSupabaseBrowser();
  const asOf = useMemo(() => new Date(), []);
  const [rows, setRows] = useState<Row[]>([]);
  const [ytdByMember, setYtdByMember] = useState<Record<string, number>>({});
  const [err, setErr] = useState<string | null>(null);
  const [useDemo, setUseDemo] = useState(false);
  const [selected, setSelected] = useState<OnboardingKey | null>(null);
  const [stageHasColumn, setStageHasColumn] = useState(true);

  const load = useCallback(async () => {
    if (!supabase || !tenant?.id) return;
    setErr(null);
    let data: unknown = null;
    const q = await supabase
      .schema("parable_ledger")
      .from("congregation_members")
      .select("id, full_name, member_kind, joined_at, created_at, onboarding_stage")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false });
    if (q.error) {
      if (q.error.message.toLowerCase().includes("onboarding") || q.error.message.includes("column")) {
        const q2 = await supabase
          .schema("parable_ledger")
          .from("congregation_members")
          .select("id, full_name, member_kind, joined_at, created_at")
          .eq("tenant_id", tenant.id)
          .order("created_at", { ascending: false });
        if (q2.error) {
          if (q2.error.message.includes("does not exist")) {
            setErr("Run migration: 20250423320000_capex_projects_members.sql");
            return;
          }
          setErr(q2.error.message);
          return;
        }
        data = q2.data;
        setStageHasColumn(false);
      } else {
        if (q.error.message.includes("does not exist")) {
          setErr("Run migration: 20250423320000_capex_projects_members.sql");
          return;
        }
        setErr(q.error.message);
        return;
      }
    } else {
      data = q.data;
      setStageHasColumn(true);
    }
    const list = (data ?? []) as Row[];
    setRows(list);
    if (!list.length) {
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
      for (const s of stew as { member_id: string; ytd_giving: number }[]) {
        m[s.member_id] = Number(s.ytd_giving) || 0;
      }
      setYtdByMember(m);
    } else {
      setYtdByMember({});
    }
  }, [supabase, tenant?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const y0 = asOf.getUTCFullYear();
  const nowM = asOf.getUTCMonth();
  const dataRows = useDemo ? DEMO : rows;
  const totalYtd = useMemo(() => {
    if (useDemo) return 42000.25;
    return Object.values(ytdByMember).reduce((a, b) => a + b, 0);
  }, [useDemo, ytdByMember]);

  const ytdNew = useMemo(() => {
    return dataRows.filter((m) => {
      const t = m.joined_at || m.created_at;
      if (!t) return false;
      return new Date(t).getUTCFullYear() === y0;
    }).length;
  }, [dataRows, y0]);

  const yoyM = useMemo(
    () =>
      calculateMemberYOY(
        dataRows.map((r) => ({ id: r.id, created_at: r.joined_at ? `${r.joined_at}T12:00:00Z` : r.created_at })),
        asOf
      ),
    [dataRows, asOf]
  );

  const yoyNarr = useMemo(() => {
    const p = yoyM.yoyPercent;
    if (p == null) return "Not enough data for a same-month comparison last year.";
    const dir = p > 0 ? "higher" : p < 0 ? "lower" : "flat";
    if (p === 0) return "Growth is flat vs the same month last year.";
    const monthName = asOf.toLocaleString("en-US", { month: "long" });
    return `Growth is ${Math.abs(p)}% ${dir} than ${monthName} ${y0 - 1} (new members, same month).`;
  }, [yoyM.yoyPercent, y0, asOf]);

  const yoyGiveNarr = useMemo(() => {
    const t = totalYtd;
    const p = yoyM.yoyPercent;
    if (p == null) return "Tie financial close to YOY after two full years of data.";
    const w = p > 0 ? "strengthen" : p < 0 ? "rebalance" : "stabilize";
    return `Giving & participation ${w} — pulse vs ${y0 - 1} (same month) ${p > 0 ? "↑" : p < 0 ? "↓" : "→"} by member pace. YTD $${t.toFixed(0)}.`;
  }, [totalYtd, y0, yoyM.yoyPercent]);

  const funnel = useMemo(() => {
    const forCounts = dataRows.map((r) => ({
      onboarding_stage: r.onboarding_stage,
      joined_at: r.joined_at ?? undefined,
      created_at: r.created_at,
    }));
    return computeFunnelCounts(forCounts, asOf) as Record<OnboardingKey, number>;
  }, [dataRows, asOf]);
  const maxF = useMemo(() => Math.max(1, ...STAGES.map((s) => funnel[s.key] ?? 0)), [funnel]);

  const atStage = useCallback(
    (k: OnboardingKey) =>
      dataRows.filter((r) =>
        effectiveOnboardingStage(
          { onboarding_stage: r.onboarding_stage, joined_at: r.joined_at, created_at: r.created_at },
          asOf
        ) === k
      ),
    [dataRows, asOf]
  );

  const yearBuckets = useMemo(() => monthBucketsYtdCount(dataRows, y0), [dataRows, y0]);
  const givingCum = useMemo(() => buildGivingCumulativeSeries(totalYtd, nowM), [totalYtd, nowM]);
  const pulsePoints: PulsePoint[] = useMemo(
    () =>
      MONTHS.map((label, i) => ({
        m: label,
        members: i <= nowM ? yearBuckets[i] ?? 0 : 0,
        giving: givingCum[i] ?? 0,
      })),
    [yearBuckets, givingCum, nowM]
  );

  const brandGlow = tenant?.primary_color?.trim() || "#22d3ee";

  return (
    <div
      className="min-h-screen space-y-8 p-3 text-white sm:p-6"
      style={{ background: "radial-gradient(90% 60% at 50% -20%, #0f172a 0, #050505 50%, #030303 100%)" }}
    >
      <header className="space-y-1 text-center sm:text-left">
        <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-white/50">Ministry growth</p>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl" style={{ textShadow: "0 0 40px color-mix(in srgb, var(--brand-cyber, #22d3ee) 0.25, transparent)" }}>
          Command center
        </h1>
        <p className="max-w-xl text-sm text-white/50">Liveliness, onboarding funnel, and YOY in one matte-black panel — interactive elements use the Sovereign glow.</p>
      </header>

      {useDemo && <p className="text-center text-xs text-amber-200/80">Demo data — add congregation members to replace the sample.</p>}
      {err && <p className="text-center text-sm text-red-400">{err}</p>}
      {!stageHasColumn && !err && !useDemo && (
        <p className="text-center text-xs text-amber-200/90">Funnel uses tenure until migration 20250423330000 (onboarding_stage) is applied.</p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={glass} style={{ boxShadow: "0 0 28px color-mix(in srgb, var(--brand-cyber, #22d3ee) 0.06, transparent)" }}>
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">The pulse</h2>
            <span className="text-[9px] text-cyan-300/80">YTD {y0}</span>
          </div>
          <p className="mb-3 text-xs text-white/45">New members (joined this year) vs estimated cumulative giving (ramp to current YTD total).</p>
          <div className="text-cyan-200/80">
            <PulseChart points={pulsePoints.slice(0, nowM + 1)} glow={String(brandGlow)} />
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-[10px] text-white/50">
            <span className="inline-flex items-center gap-1">
              <span className="h-0.5 w-4 rounded-full" style={{ background: brandGlow }} />
              New members
            </span>
            <span className="inline-flex items-center gap-1 text-sky-300/70">
              <span className="h-0.5 w-4 rounded-full bg-sky-300/50" />
              Giving growth
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className={glass} style={{ color: "var(--brand-cyber, #22d3ee)" }}>
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/50">YOY</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {yoyM.yoyPercent == null ? "—" : `${yoyM.yoyPercent > 0 ? "+" : ""}${yoyM.yoyPercent}%`}
            </p>
            <p className="mt-2 text-xs text-white/55">{yoyNarr}</p>
          </div>
          <div className={glass} style={{ color: "var(--brand-cyber, #a5f3fc)" }}>
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/50">Liveliness & giving</p>
            <p className="mt-1 text-lg font-semibold">YTD new: {ytdNew}</p>
            <p className="mt-1 text-xs text-white/50">{yoyGiveNarr}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className={glass}>
          <h2 className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Onboarding funnel</h2>
          <div className="flex flex-col items-center gap-0">
            {STAGES.map((s) => {
              const v = funnel[s.key] ?? 0;
              const wPct = 28 + (v / maxF) * 62;
              const active = selected === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSelected((prev) => (prev === s.key ? null : s.key))}
                  className="relative w-full max-w-sm py-1 text-left transition"
                  style={{
                    maxWidth: `${wPct}%`,
                    filter: active ? "brightness(1.1)" : undefined,
                  }}
                >
                  <div
                    className="rounded border border-white/10 py-2 pl-3 pr-2"
                    style={{
                      background: "linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.2) 100%)",
                      boxShadow: active
                        ? "0 0 18px color-mix(in srgb, var(--brand-glow, #22d3ee) 0.2, transparent), inset 0 0 0 1px color-mix(in srgb, var(--brand-glow) 0.3, transparent)"
                        : "inset 0 0 0 0 transparent",
                    }}
                  >
                    <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--brand-glow, #22d3ee)" }}>
                      {s.label}
                    </p>
                    <p className="text-xl font-black tabular-nums">{v}</p>
                  </div>
                </button>
              );
            })}
            <p className="mt-4 text-center text-[10px] text-white/35">Tap a stage to list members there.</p>
          </div>
        </div>

        <div className={glass}>
          <h2 className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Roster for stage</h2>
          {selected == null && <p className="text-sm text-white/40">Select a stage in the funnel.</p>}
          {selected != null && (
            <ul className="max-h-64 space-y-1 overflow-y-auto pr-1 text-sm">
              {atStage(selected).map((m) => (
                <li key={m.id} className="flex items-center justify-between border-b border-white/5 py-1.5">
                  <span className="font-medium">{m.full_name}</span>
                  <span className="text-[10px] uppercase text-white/35">{m.member_kind}</span>
                </li>
              ))}
              {atStage(selected).length === 0 && <li className="text-white/40">No one in this stage (with current rules).</li>}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
