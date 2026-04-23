"use client";

import { useCallback, useEffect, useState } from "react";
import { useBrand } from "@/components/branding/BrandProvider";
import { getNextOnboardingStep, computeEngagementScore } from "@/lib/adaptiveFromRoot.js";
import {
  orgFundTotalForNarrative,
  generateGivingReport,
  buildGivingStatementHtml,
  formatImpactShare,
} from "@/lib/givingReportClient";
import { getSupabaseBrowser } from "@/lib/supabase/browser-client";
import { daysSinceJoin, effectiveOnboardingStage, ONBOARDING_TIMELINE } from "@/lib/onboardingFromRoot.js";
import { motion, AnimatePresence } from "framer-motion";

export type DossierMember = {
  id: string;
  full_name: string;
  member_kind: string;
  joined_at: string | null;
  created_at: string;
  onboarding_stage?: "welcome" | "stewardship" | "discovery" | "active";
};

const STAGE_ORDER: Record<string, number> = {
  welcome: 0,
  stewardship: 1,
  discovery: 2,
  active: 3,
};

function onboardingProgressPercent(stage: string) {
  const o = STAGE_ORDER[stage] ?? 0;
  return 25 * (o + 1);
}

type CommRow = { id: string; subject: string | null; body_preview: string | null; created_at: string; channel: string };

function lineChart(
  data: number[],
  opts: { accent: string; w?: number; h?: number; fill?: string },
) {
  const w = opts.w ?? 200;
  const h = opts.h ?? 64;
  const n = data.length;
  if (n < 2) {
    return (
      <p className="text-xs" style={{ color: opts.accent === "#4ade80" ? "#4ade80" : "#a1a1aa" }}>
        {data[0] != null ? `Total this period: $${data[0].toFixed(0)}` : "No monthly slice yet."}
      </p>
    );
  }
  const m = Math.max(1, ...data);
  const step = w / (n - 1);
  const d = data
    .map((v, i) => {
      const y = h - 4 - (v / m) * (h - 8);
      return `${i === 0 ? "M" : "L"}${i * step},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible" role="img" aria-label="Giving history by month">
      <defs>
        <linearGradient id="dossierFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={opts.accent} stopOpacity="0.3" />
          <stop offset="100%" stopColor={opts.accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={d + " L" + w + "," + h + " L0," + h + " Z"} fill="url(#dossierFill)" />
      <path d={d} fill="none" stroke={opts.accent} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

const DEMO_ENGAGE = { days_since_join: 4, emails_opened: 2, vision_pdf_opened: true, clicked_links: ["vision_pdf", "building_fund_report"] };

type Props = {
  member: DossierMember | null;
  onClose: () => void;
  ytdCentsOrUsd?: number;
  useDemoData?: boolean;
};

export default function MemberDossier({ member, onClose, ytdCentsOrUsd, useDemoData }: Props) {
  const { tenant, ready } = useBrand();
  const supabase = getSupabaseBrowser();
  const [report, setReport] = useState<Awaited<ReturnType<typeof generateGivingReport>> | null>(null);
  const [rErr, setRErr] = useState<string | null>(null);
  const [comms, setComms] = useState<CommRow[]>([]);
  const [cErr, setCErr] = useState<string | null>(null);

  const asOf = new Date();

  const load = useCallback(async () => {
    if (!member || !supabase || !tenant?.id) {
      setReport(null);
      setComms([]);
      return;
    }
    setRErr(null);
    setCErr(null);
    try {
      if (useDemoData) {
        setReport({
          memberId: member.id,
          year: new Date().getUTCFullYear(),
          total: 1200.5,
          unrestricted: 900.25,
          restricted: 300.25,
          byCategory: { "General (unrestr)": 900, "Building": 300 },
          monthly: [0, 100, 200, 200, 300, 200, 0, 0, 0, 0, 0, 0].map((a, i) => a * (1 + i * 0.02)),
          topCategory: "General (unrestr)",
          thankYou: "Thank you, Riley — we noticed your heart for the Building Fund; …",
          memberFirstName: member.full_name.split(/\s+/)[0] || "Friend",
        });
        setComms([
          { id: "1", subject: "Sovereign welcome: vision PDF", body_preview: "We’re glad you’re here. Link: vision_2026 …", created_at: "2026-01-10T10:00:00Z", channel: "ai_email" },
        ]);
        return;
      }
      const rep = await generateGivingReport(supabase, {
        tenantId: tenant.id,
        memberId: member.id,
        year: new Date().getUTCFullYear(),
        memberFullName: member.full_name,
        legalName: (tenant.legal_name && tenant.legal_name.trim()) || "PARABLE",
      });
      setReport(rep);

      const { data, error: ce } = await supabase
        .schema("parable_ledger")
        .from("member_communication_log")
        .select("id, subject, body_preview, created_at, channel")
        .eq("tenant_id", tenant.id)
        .eq("member_id", member.id)
        .order("created_at", { ascending: false })
        .limit(40);
      if (ce) {
        if (ce.message.includes("does not exist") || ce.message.includes("not found")) {
          setComms([]);
          setCErr(null);
        } else setCErr(ce.message);
        return;
      }
      setComms((data ?? []) as CommRow[]);
    } catch (e) {
      setRErr(e instanceof Error ? e.message : "Report failed");
    }
  }, [member, supabase, tenant, useDemoData]);

  useEffect(() => {
    void load();
  }, [load]);

  const st = member
    ? effectiveOnboardingStage(
        { onboarding_stage: member.onboarding_stage, joined_at: member.joined_at, created_at: member.created_at },
        asOf,
      )
    : "welcome";
  const pct = onboardingProgressPercent(String(st || "welcome"));
  const dJoin = member ? daysSinceJoin(member.joined_at || member.created_at, asOf) : 0;
  const act = useDemoData
    ? { ...DEMO_ENGAGE, days_since_join: dJoin, emails_opened: 2 }
    : { days_since_join: dJoin, emails_opened: 0, vision_pdf_opened: false, clicked_links: [] as string[] };
  const engagePreview = getNextOnboardingStep(act as never, { min_days_for_inreach: 5 });
  const score = computeEngagementScore(act as never);

  const openStatement = async () => {
    if (!report || !member) return;
    if (!useDemoData && supabase && tenant) {
      const mTo = (report.topCategory && report.byCategory[report.topCategory]) || 0;
      const orgM = await orgFundTotalForNarrative(supabase, { tenantId: tenant.id, year: report.year, fundNameSubstr: "ission" });
      const imp = formatImpactShare(mTo, orgM);
      const html = buildGivingStatementHtml({
        memberName: member.full_name,
        tenantLegalName: tenant.legal_name ?? "PARABLE",
        periodLabel: `YTD ${report.year}`,
        summary: {
          total: report.total,
          unrestricted: report.unrestricted,
          restricted: report.restricted,
          byCategory: report.byCategory,
        },
        impactMissionsPercent: orgM > 0 ? imp : 14,
        sovereignSealText: "Sovereign seal: contributions recorded to revenue/donation types with UCOA fund segregation (restricted / unrestricted).",
      });
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(html);
        w.document.close();
        return;
      }
    }
    if (useDemoData && report) {
      const html = buildGivingStatementHtml({
        memberName: member!.full_name,
        periodLabel: `YTD ${report.year}`,
        summary: {
          total: report.total,
          unrestricted: report.unrestricted,
          restricted: report.restricted,
          byCategory: report.byCategory,
        },
        impactMissionsPercent: 14,
      });
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(html);
        w.document.close();
      }
    }
  };

  if (!ready) return null;

  return (
    <AnimatePresence>
      {member && (
        <motion.div
          className="fixed inset-0 z-50 flex items-stretch justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default border-0 bg-black/60 backdrop-blur-sm"
            aria-label="Close dossier"
            onClick={onClose}
          />
          <motion.aside
            className="relative h-full w-full max-w-md overflow-y-auto border-l border-white/10 p-4 shadow-2xl sm:max-w-lg"
            style={{ background: "linear-gradient(200deg, #0c0c0c 0%, #050505 100%)" }}
            initial={{ x: 48 }}
            animate={{ x: 0 }}
            exit={{ x: 100 }}
            transition={{ type: "spring", stiffness: 280, damping: 32 }}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-zinc-500">Member dossier</p>
                <h2 className="text-xl font-bold tracking-tight" style={{ color: "var(--brand-cyber, #22d3ee)" }}>
                  {member.full_name}
                </h2>
                <p className="text-xs text-zinc-500">
                  {member.member_kind} · {member.joined_at || member.created_at} · {ytdCentsOrUsd != null && `YTD ref $${(ytdCentsOrUsd || 0).toFixed(0)} (hub)`}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-300 hover:bg-white/10"
              >
                Close
              </button>
            </div>

            {rErr && <p className="text-xs text-red-400">{rErr}</p>}

            {report && (
              <section className="mb-6 space-y-2">
                <h3 className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#4ade80" }}>
                  Giving history
                </h3>
                <p className="text-xs text-zinc-500">
                  Revenue / donation lines · restricted ${report.restricted.toFixed(2)} / unrestricted ${report.unrestricted.toFixed(2)} · YTD {report.year}
                </p>
                <div className="rounded-2xl border border-white/10 bg-black/40 p-3">{lineChart(report.monthly, { accent: "#4ade80", w: 220, h: 72 })}</div>
                <p className="text-sm leading-snug text-zinc-200">
                  <span className="font-medium" style={{ color: "#4ade80" }}>AI thank-you:</span> {report.thankYou}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={openStatement}
                    className="flex-1 rounded-xl border border-emerald-500/40 py-2 text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: "#4ade80" }}
                  >
                    Open giving statement
                  </button>
                </div>
              </section>
            )}

            <section className="mb-6 space-y-2">
              <h3 className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--brand-cyber, #22d3ee)" }}>
                Onboarding
              </h3>
              <p className="text-xs text-zinc-500">
                Stage: {st} · day {dJoin} since join · next milestone: day {ONBOARDING_TIMELINE.ACTIVATION} activation
              </p>
              <div className="h-2.5 w-full overflow-hidden rounded-full border border-white/10 bg-zinc-900">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, pct)}%`, background: "linear-gradient(90deg, #22d3ee, #4ade80)" }}
                />
              </div>
            </section>

            <section className="mb-4 space-y-1 rounded-2xl border border-white/5 bg-zinc-950/60 p-3">
              <h3 className="text-[9px] font-bold uppercase tracking-widest text-amber-200/80">Adaptive (preview signal)</h3>
              <p className="text-xs text-zinc-400">Engagement score: {useDemoData ? 85 : score} · track {engagePreview.track}</p>
              <p className="text-xs text-zinc-500">{engagePreview.ai_note}</p>
            </section>

            <section className="space-y-2">
              <h3 className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Communication log</h3>
              {cErr && <p className="text-xs text-amber-300/80">{cErr} — run migration 20250423340000 for full history.</p>}
              {comms.length === 0 && !cErr && <p className="text-xs text-zinc-600">No log entries (AI sends append here on deploy).</p>}
              <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
                {comms.map((c) => (
                  <li key={c.id} className="rounded-lg border border-white/5 bg-black/20 p-2">
                    <p className="text-[9px] uppercase text-zinc-500">{c.channel} · {c.created_at?.slice(0, 10)}</p>
                    <p className="font-medium text-zinc-200">{c.subject || "(no subject)"}</p>
                    {c.body_preview && <p className="line-clamp-2 text-xs text-zinc-500">{c.body_preview}</p>}
                  </li>
                ))}
              </ul>
            </section>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
