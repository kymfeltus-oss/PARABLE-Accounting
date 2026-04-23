"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBrand } from "@/components/branding/BrandProvider";
import { getSupabaseBrowser } from "@/lib/supabase/browser-client";
import { buildThankYouLine, buildGivingStatementHtml, summarizeGivingByRestriction } from "@/lib/givingReportFromRoot.js";
import { generateGivingReport } from "@/lib/givingReportClient";
import { motion } from "framer-motion";

type M = { id: string; full_name: string; member_kind: string; joined_at: string | null; created_at: string; ytd: number };
type Aud = "new_ytd" | "building" | "digital" | "all";

function filterMembers(rows: M[], a: Aud, y0: number) {
  if (a === "all") return rows;
  if (a === "digital") return rows.filter((r) => r.member_kind === "digital");
  if (a === "new_ytd")
    return rows.filter((r) => {
      const t = r.joined_at || r.created_at;
      if (!t) return false;
      return new Date(t).getUTCFullYear() === y0;
    });
  if (a === "building")
    return rows
      .filter((r) => r.ytd > 0)
      .sort((a, b) => b.ytd - a.ytd)
      .slice(0, Math.max(1, Math.ceil(rows.length * 0.25) || 5));
  return rows;
}

const DEMO: M[] = [
  { id: "e0", full_name: "Riley C.", member_kind: "active", joined_at: "2026-01-10", created_at: "2026-01-10T12:00:00Z", ytd: 200 },
  { id: "e1", full_name: "Jordan T.", member_kind: "digital", joined_at: "2026-02-02", created_at: "2026-02-02T12:00:00Z", ytd: 0 },
];

export default function AiCommHub() {
  const { tenant, ready, error: brandError } = useBrand();
  const supabase = getSupabaseBrowser();
  const y0 = new Date().getUTCFullYear();
  const [rows, setRows] = useState<M[]>([]);
  const [useDemo, setUseDemo] = useState(true);
  const [aud, setAud] = useState<Aud>("new_ytd");
  const [prompt, setPrompt] = useState("");
  const [batch, setBatch] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [summaryLine, setSummaryLine] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !tenant?.id) {
      if (!supabase) setUseDemo(true);
      return;
    }
    setErr(null);
    const { data, error } = await supabase
      .schema("parable_ledger")
      .from("congregation_members")
      .select("id, full_name, member_kind, joined_at, created_at")
      .eq("tenant_id", tenant.id);
    if (error) {
      if (error.message.includes("does not exist")) {
        setErr("Run members migration; showing demo list.");
        setUseDemo(true);
        setRows(DEMO);
        return;
      }
      setErr(error.message);
      return;
    }
    if (!data?.length) {
      setUseDemo(true);
      setRows(DEMO);
      return;
    }
    setUseDemo(false);
    const { data: ytdRows } = await supabase
      .schema("parable_ledger")
      .from("v_member_stewardship_giving")
      .select("member_id, ytd_giving")
      .eq("tenant_id", tenant.id);
    const ymap: Record<string, number> = {};
    for (const r of (ytdRows as { member_id: string; ytd_giving: string }[] | null) ?? []) {
      ymap[r.member_id] = Number(r.ytd_giving) || 0;
    }
    setRows(
      (data as Omit<M, "ytd">[]).map((m) => ({
        ...m,
        ytd: ymap[m.id] ?? 0,
      })),
    );
  }, [supabase, tenant?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const audience = useMemo(() => filterMembers(rows, aud, y0), [rows, aud, y0]);

  const onGenerate = async () => {
    if (!useDemo && supabase && tenant) {
      setGenerating(true);
      setBatch(null);
      setSummaryLine(null);
      try {
        const lines: string[] = [];
        for (const m of audience) {
          const r = await generateGivingReport(supabase, {
            tenantId: tenant.id,
            memberId: m.id,
            year: y0,
            memberFullName: m.full_name,
            legalName: (tenant.legal_name && tenant.legal_name.trim()) || undefined,
          });
          const thank = buildThankYouLine({
            memberFirstName: m.full_name.split(/\s+/)[0] || m.full_name,
            topCategory: r.topCategory || "our ministries",
            legalEntityName: tenant.legal_name ?? "PARABLE",
          });
          lines.push(`— ${m.full_name} (YTD $${r.total.toFixed(0)} | top: ${r.topCategory || "n/a"}): ${prompt ? `[${prompt.slice(0, 40)}…] ` : ""}${thank}`);
        }
        setBatch(lines.join("\n\n"));
        setSummaryLine(`Batch of ${lines.length} personalized lines (YTD from ledger). Add your Resend/AI key to send.`);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Generate failed");
      } finally {
        setGenerating(false);
      }
    } else {
      setGenerating(true);
      setTimeout(() => {
        setBatch(
          audience
            .map((m) => {
              const t = buildThankYouLine({
                memberFirstName: m.full_name.split(/\s+/)[0] || m.full_name,
                topCategory: m.ytd > 80 ? "Building" : "General",
              });
              return `— ${m.full_name} (YTD $${m.ytd} demo): ${t}`;
            })
            .join("\n\n"),
        );
        setSummaryLine("Demo — connect Supabase + real members to compile from the ledger.");
        setGenerating(false);
      }, 400);
    }
  };

  const onPreviewReports = async () => {
    if (useDemo || !supabase || !tenant) {
      const s = summarizeGivingByRestriction(
        [
          { amount: 200, fund_id: "1", fund: { is_restricted: false, fund_name: "General" } } as never,
          { amount: 50, fund_id: "2", fund: { is_restricted: true, fund_name: "Local missions" } } as never,
        ],
        {},
      );
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(
          buildGivingStatementHtml({
            memberName: audience[0]?.full_name ?? "Member",
            periodLabel: `Q preview ${y0}`,
            summary: s,
            impactMissionsPercent: 14,
          }),
        );
        w.document.close();
      }
      return;
    }
    const m = audience[0];
    if (!m) return;
    const r = await generateGivingReport(supabase, {
      tenantId: tenant.id,
      memberId: m.id,
      year: y0,
      memberFullName: m.full_name,
    });
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(
        buildGivingStatementHtml({
          memberName: m.full_name,
          periodLabel: `YTD ${y0}`,
          tenantLegalName: tenant.legal_name ?? "PARABLE",
          summary: {
            total: r.total,
            unrestricted: r.unrestricted,
            restricted: r.restricted,
            byCategory: r.byCategory,
          },
          impactMissionsPercent: 14,
        }),
      );
      w.document.close();
    }
  };

  const glow = "0 0 20px color-mix(in srgb, var(--brand-glow, #22d3ee) 0.2, transparent)";

  if (!ready) {
    return <p className="p-6 text-sm text-amber-200/80">Loading brand… {brandError}</p>;
  }

  return (
    <div className="p-2 text-white sm:p-4" style={{ background: "linear-gradient(200deg, #0a0a0a, #040404)" }}>
      <div className="mb-8 rounded-[40px] border border-white/10 bg-[#050505] p-6 sm:p-10" style={{ boxShadow: glow }}>
        <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter sm:text-3xl" style={{ color: "var(--brand-cyber, #22d3ee)" }}>
              AI communication hub
            </h2>
            <p className="text-xs text-zinc-500">Batch copy from ledger; wire OpenAI/Resend for real sends.</p>
          </div>
          <span className="whitespace-nowrap rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--brand-glow, #22d3ee)" }}>
            AI writing assistant
          </span>
        </div>

        {err && <p className="mb-4 text-sm text-amber-300/90">{err}</p>}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-3">
            <label className="text-[9px] font-bold uppercase tracking-widest text-white/40">Select audience</label>
            <select
              className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-100 outline-none focus:border-cyan-400/50"
              value={aud}
              onChange={(e) => setAud(e.target.value as Aud)}
            >
              <option value="new_ytd">All new members (YTD)</option>
              <option value="building">Building fund & top givers (top quartile, YTD &gt; 0)</option>
              <option value="digital">Digital participants (streaming)</option>
              <option value="all">Full active roster (shown)</option>
            </select>
            <p className="text-[10px] text-zinc-600">~{audience.length} recipient(s) in this slice {useDemo ? "(demo)" : ""}.</p>
          </div>
          <div className="space-y-3 lg:col-span-2">
            <label className="text-[9px] font-bold uppercase tracking-widest text-white/40">AI context / intent</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. 'Warm update on our Youth Center progress, thank them, include YTD total.'"
              className="h-32 w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-[#22d3ee]/50"
            />
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <button
            type="button"
            onClick={onGenerate}
            disabled={generating || audience.length === 0}
            className="min-h-[3rem] flex-1 rounded-2xl bg-cyan-400/90 py-3 text-sm font-black uppercase tracking-widest text-black enabled:hover:shadow-lg disabled:opacity-40"
            style={{ boxShadow: generating ? undefined : "0 0 20px color-mix(in srgb, #22d3ee, transparent 0.3)" }}
          >
            {generating ? "Working…" : "Generate personalized batch"}
          </button>
          <button
            type="button"
            onClick={onPreviewReports}
            className="rounded-2xl border border-white/10 bg-white/5 py-3 px-8 text-xs font-bold uppercase tracking-widest text-white hover:bg-white/10"
          >
            Preview giving report
          </button>
        </div>

        {summaryLine && <p className="mt-4 text-sm text-zinc-400">{summaryLine}</p>}

        {batch && (
          <motion.pre
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 max-h-80 overflow-auto rounded-2xl border border-white/5 bg-black/30 p-4 text-xs text-zinc-200"
          >
            {batch}
          </motion.pre>
        )}
      </div>
    </div>
  );
}
