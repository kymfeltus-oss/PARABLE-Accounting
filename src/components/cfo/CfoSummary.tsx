"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useBrand } from "@/components/branding/BrandProvider";
import { useDemoMode } from "@/context/DemoModeContext";
import { getSupabaseBrowser } from "@/lib/supabase/browser-client";
import type { CfoAnnualReport } from "@/types/cfoReport";
import { generateSamplePdf } from "../../../exportSampleSummary.js";
import { generateAnnualComplianceSummary } from "../../../cfoReportEngine.js";
import "../../../samplePdfStyles.css";
import CfoComplianceView from "./CfoComplianceView";

type Report = CfoAnnualReport;

const PILLAR_META = [
  { key: "governance" as const, title: "Governance", goal: "Prospective compliance" },
  { key: "transparency" as const, title: "Transparency", goal: "Donor intent & integrity" },
  { key: "tax" as const, title: "Tax status", goal: "Payroll & non-profit status" },
  { key: "financial" as const, title: "Financial pulse", goal: "Stewardship & health" },
];

const SCAN_MIN_MS = 1200;

const DCOH_CAPTION = "Unrestricted + restricted balances vs. 12-mo. expense run rate";

function buildCertifiedCfoHtml(report: Report, displayName: string, logoUrl: string | null) {
  const safe = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const qRows = report.taxCompliance.form941Quarters
    .map(
      (q) => `<tr><td>${q.label} ${report.fiscalYear}</td><td>${q.isGenerated ? "Workpaper" : "Pending"}</td><td>EFTPS: $${q.eftpsDetected.toFixed(2)}</td></tr>`,
    )
    .join("");
  const logoBlock = logoUrl
    ? `<p><img src="${logoUrl}" alt="" style="max-height:40px" /></p>`
    : "<p><strong>" + safe(displayName) + "</strong></p>";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>CFO compliance — ${report.fiscalYear}</title>
  <style>
    body{font-family:system-ui,Segoe UI,sans-serif;color:#111;padding:2.5rem;max-width:720px;margin:0 auto;line-height:1.45}
    h1{font-size:1.1rem;letter-spacing:.2em;font-weight:800}
    h2{font-size:0.75rem;text-transform:uppercase;letter-spacing:.15em;margin-top:1.75rem;color:#444}
    .muted{color:#666;font-size:0.8rem}
    table{width:100%;border-collapse:collapse;font-size:0.85rem;margin-top:0.5rem}
    th,td{border:1px solid #ccc;padding:0.45rem 0.5rem;text-align:left}
    th{background:#f0f0f0;font-size:0.65rem;text-transform:uppercase;letter-spacing:.1em}
  </style></head><body>
  ${logoBlock}
  <h1>Certificate of financial integrity (advisory — not a legal opinion)</h1>
  <p class="muted">Fiscal year ${report.fiscalYear} — generated ${new Date(report.generatedAt).toLocaleString()}</p>
  <h2>Shield</h2>
  <p><strong>${safe(report.readiness.headline)}</strong></p>
  <h2>Governance</h2>
  <p>${safe(report.governanceScore.label)}</p>
  <h2>Form 941 — quarters</h2>
  <table><thead><tr><th>Period</th><th>941 workpaper</th><th>EFTPS (tagged)</th></thead><tbody>${qRows}</tbody></table>
  <h2>Tax & UBI (modeled)</h2>
  <p>${safe(report.taxCompliance.ubiStatus)}</p>
  <h2>Housing allowance (modeled)</h2>
  <p>${safe(report.shieldSummary.housingTotalLabel)} designated · est. self-employment shelter ${safe(report.shieldSummary.taxSavedLabel)} (illustrative)</p>
  <h2>Cash (ledger funds)</h2>
  <p>Combined fund balances: <strong>$${report.financialPulse.cashOnHand.toFixed(2)}</strong></p>
  <p class="muted">${safe(report.auditTrail)}</p>
  <p class="muted">Print this page to PDF. PARABLE is not a substitute for a CPA, attorney, or IRS e-file service.</p>
  </body></html>`;
}

function DaysCashBar({ days }: { days: number | null }) {
  if (days == null || !Number.isFinite(days)) {
    return <p className="text-sm text-white/50">Not enough annual expense on file to compute days (add payroll / expense history).</p>;
  }
  const cap = 180;
  const pct = Math.min(100, (Math.min(Math.max(0, days), cap) / cap) * 100);
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-white/50">Days cash on hand (modeled)</span>
        <span className="font-mono text-[var(--brand-glow)]" style={{ textShadow: "0 0 12px color-mix(in srgb, var(--brand-glow) 35%, transparent)" }}>
          {Math.round(days)}d
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full border border-white/10 bg-black/50">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, color-mix(in srgb, var(--brand-cyber) 50%, #0a0a0a), var(--brand-cyber))",
            boxShadow: "0 0 20px color-mix(in srgb, var(--brand-cyber) 40%, transparent)",
          }}
        />
      </div>
      <p className="mt-2 text-[10px] text-white/40">
        0–{cap} days scale · {DCOH_CAPTION}
      </p>
    </div>
  );
}

function ScanOverlay({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key="scan"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#060606]/95 p-6 backdrop-blur-sm"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <p className="mb-4 text-center text-xs font-bold uppercase tracking-[0.4em] text-white/50">Sovereign pillars scan</p>
          <div className="relative h-1 w-64 max-w-full overflow-hidden rounded-full bg-white/5">
            <motion.div
              className="absolute left-0 top-0 h-full w-1/3 bg-gradient-to-r from-transparent via-[var(--brand-cyber)]/90 to-transparent"
              animate={{ x: ["-100%", "200%"] }}
              transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
            />
          </div>
          <p className="mt-4 animate-pulse text-sm text-white/60">Mandates · 941 files · EFTPS · UBI · liquidity…</p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function ObsidianCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-3xl border border-white/[0.09] p-6 shadow-2xl sm:p-8",
        "bg-gradient-to-b from-zinc-900/95 via-zinc-950/98 to-[#020202]",
        "ring-1 ring-inset ring-white/5",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-3xl before:opacity-40",
        "before:bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(255,255,255,0.01)_2px,rgba(255,255,255,0.01)_4px)]",
        className ?? "",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export type CfoSummaryProps = { year?: number };

export default function CfoSummary({ year: yearProp }: CfoSummaryProps) {
  const year = yearProp ?? new Date().getFullYear();
  const supabase = getSupabaseBrowser();
  const { isSimulation: isDemo } = useDemoMode();
  const { tenant, error: brandError, ready: brandReady } = useBrand();
  const [report, setReport] = useState<Report | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showScan, setShowScan] = useState(true);
  const [engagementOpen, setEngagementOpen] = useState(false);
  const postSampleFallback = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !tenant?.id) {
      setLoading(false);
      if (brandReady) setErr(brandError ?? "Select a tenant to generate the report.");
      return;
    }
    setErr(null);
    setLoading(true);
    try {
      const r = (await generateAnnualComplianceSummary(
        supabase,
        tenant.id,
        year,
      )) as CfoAnnualReport;
      setReport(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Report failed");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [supabase, tenant, year, brandReady, brandError]);

  const scanT0 = useRef<number | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading) {
      scanT0.current = Date.now();
      return;
    }
    if (scanT0.current == null) scanT0.current = Date.now();
    const wait = Math.max(0, SCAN_MIN_MS - (Date.now() - scanT0.current));
    const t = window.setTimeout(() => setShowScan(false), wait);
    return () => window.clearTimeout(t);
  }, [loading]);

  const displayName = tenant?.display_name ?? "PARABLE";
  const irsBanner = report?.readiness.irsReady ? "100% model sync" : "Review with counsel";
  const shieldGlowing = report?.readiness.irsReady === true;

  const onExportPdf = () => {
    if (!report) return;
    if (isDemo) {
      const w = window.open("", "_blank");
      if (!w) return;
      if (postSampleFallback.current) clearTimeout(postSampleFallback.current);
      const totalDep = report.taxCompliance.form941Quarters.reduce((a, q) => a + q.eftpsDetected, 0);
      const form941Text = report.taxCompliance.form941Quarters
        .map((q) => `${q.label} ${q.isGenerated ? "workpaper" : "pending"}`)
        .join(" · ");
      const html = generateSamplePdf({
        year: report.fiscalYear,
        orgName: displayName,
        resolutionDate: "2025-12-15",
        totalDeposits: totalDep,
        eftpsMatchLine: "Modeled match to EFTPS-tagged transactions",
        governanceLine: report.governanceScore.label,
        ubiStatus: report.taxCompliance.ubiStatus,
        form941QuartersText: form941Text,
        stylesOrigin: typeof window !== "undefined" ? window.location.origin : "",
      });
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      let done = false;
      const finishEngagement = () => {
        if (done) return;
        done = true;
        if (postSampleFallback.current) {
          clearTimeout(postSampleFallback.current);
          postSampleFallback.current = null;
        }
        w.removeEventListener("afterprint", finishEngagement);
        setEngagementOpen(true);
      };
      postSampleFallback.current = setTimeout(finishEngagement, 2000);
      w.addEventListener("afterprint", finishEngagement);
      w.print();
      return;
    }
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(buildCertifiedCfoHtml(report, displayName, tenant?.logo_url ?? null));
    w.document.close();
    w.focus();
    w.print();
  };

  if (!brandReady && !report) {
    return <div className="text-sm text-white/50">Resolving brand…</div>;
  }

  return (
    <div
      className="mx-auto max-w-5xl space-y-8 pb-20 text-white"
      data-cfo-pdf-surface
    >
      <ScanOverlay show={showScan} />

      <AnimatePresence>
        {engagementOpen ? (
          <motion.div
            key="engagement"
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEngagementOpen(false)}
            role="presentation"
          >
            <motion.div
              className="max-w-md cursor-default rounded-3xl border border-[color:rgb(var(--brand-cyber-rgb)/0.35)] bg-zinc-950/95 p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.95, y: 12, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 8, opacity: 0 }}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/50">You&apos;re set (demo)</p>
              <p className="mt-2 text-lg font-bold leading-snug text-white">
                Ready to protect your real ministry?{" "}
                <span
                  className="text-[color:rgb(var(--brand-glow-rgb))]"
                  style={{ textShadow: "0 0 20px color-mix(in srgb, var(--brand-glow) 30%, transparent)" }}
                >
                  Go live
                </span>{" "}
                in 60 seconds.
              </p>
              <p className="mt-2 text-sm text-white/50">
                Connect a real workspace, EIN, and guardrails. We&apos;ll walk you through onboarding.
              </p>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setEngagementOpen(false)}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white/70 transition hover:bg-white/10"
                >
                  Not now
                </button>
                <Link
                  href="/onboarding"
                  onClick={() => setEngagementOpen(false)}
                  className="inline-flex items-center justify-center rounded-xl border border-[color:rgb(var(--brand-cyber-rgb)/0.4)] px-4 py-2.5 text-center text-xs font-black uppercase tracking-wider text-black"
                  style={{
                    background: "var(--brand-cyber)",
                    boxShadow: "0 0 24px color-mix(in srgb, var(--brand-cyber) 35%, transparent)",
                  }}
                >
                  Onboarding wizard
                </Link>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <header className="text-center sm:text-left">
        <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/40">CFO — annual</p>
        <h1
          className="mt-2 text-2xl font-black uppercase italic tracking-tight sm:text-4xl"
          style={{ textShadow: "0 0 40px color-mix(in srgb, var(--brand-glow) 20%, transparent)" }}
        >
          Certificate of financial integrity
        </h1>
        <p className="mt-2 text-sm text-white/50">Fiscal {year} · {report?.governanceScore.label ?? "Sovereign pillars"}</p>
      </header>

      {err ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{err}</div>
      ) : null}

      {loading && !report ? (
        <p className="text-sm text-white/45">Compiling data fragments…</p>
      ) : null}

      {report && tenant?.id ? (
        <ObsidianCard>
          <CfoComplianceView year={year} cashOnHand={report.financialPulse.cashOnHand} />
        </ObsidianCard>
      ) : null}

      {report ? (
        <div className="space-y-8">
          {/* The Shield */}
          <ObsidianCard>
            <div className="flex flex-col items-center justify-between gap-6 sm:flex-row sm:items-start">
              <div className="relative flex flex-col items-center sm:items-start">
                <div
                  className="relative flex h-36 w-36 items-center justify-center rounded-2xl border-2"
                  style={{
                    borderColor: "color-mix(in srgb, var(--brand-cyber) 55%, transparent)",
                    background: "color-mix(in srgb, var(--brand-cyber) 8%, #050505)",
                    boxShadow: shieldGlowing
                      ? "0 0 60px color-mix(in srgb, var(--brand-cyber) 40%, transparent), inset 0 0 30px color-mix(in srgb, var(--brand-cyber) 15%, transparent)"
                      : "0 0 20px rgba(0,0,0,0.5)",
                  }}
                >
                  <div
                    className="absolute inset-0 animate-pulse rounded-2xl opacity-50"
                    style={{ background: "radial-gradient(circle at 50% 30%, var(--brand-cyber) 0%, transparent 60%)" }}
                  />
                  <div className="relative z-10 text-center">
                    <p className="text-2xl font-black text-white">{irsBanner}</p>
                    <p
                      className="mt-1 text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--brand-glow)]"
                      style={{ textShadow: "0 0 18px var(--brand-glow)" }}
                    >
                      {shieldGlowing ? "IRS-ready pack" : "Open items"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="max-w-xl space-y-3 text-sm text-white/60">
                <h2 className="text-base font-bold tracking-wide text-white/90">The four sovereign pillars</h2>
                <ul className="space-y-2 text-xs leading-relaxed">
                  {PILLAR_META.map((p) => {
                    const st = report.readiness.pillars[p.key];
                    return (
                      <li key={p.key} className="flex items-start gap-2">
                        <span className={st?.ok ? "text-[var(--brand-glow)]" : "text-amber-400/90"}>{st?.ok ? "✓" : "○"}</span>
                        <span>
                          <span className="text-white/85">{p.title}</span> — {p.goal}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </ObsidianCard>

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Paper trail */}
            <ObsidianCard>
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">The paper trail</h2>
              <ul className="mt-4 space-y-3 text-sm">
                {report.taxCompliance.form941Quarters.map((q) => (
                  <li
                    key={q.quarter}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 py-2 last:border-0"
                  >
                    <span>Form 941 {q.label} {year}</span>
                    <span className="text-white/50">{q.isGenerated ? "Workpaper saved" : "Not generated"}</span>
                    <span className="w-full text-[10px] text-white/35 sm:w-auto sm:text-right">EFTPS · ${q.eftpsDetected.toFixed(2)}</span>
                    <Link
                      href="/quarterly-review"
                      className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-cyber)] hover:underline"
                    >
                      View
                    </Link>
                  </li>
                ))}
                <li className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4">
                  <span>Housing resolution</span>
                  {report.housing.documentUrl ? (
                    <a
                      href={report.housing.documentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-cyber)] hover:underline"
                    >
                      View PDF
                    </a>
                  ) : (
                    <Link
                      href="/sovereign-accord"
                      className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90 hover:underline"
                    >
                      Add document
                    </Link>
                  )}
                </li>
              </ul>
            </ObsidianCard>

            {/* Financial health */}
            <ObsidianCard>
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">Financial health</h2>
              <p className="mt-2 text-sm text-white/55">{report.financialPulse.operatingReservesNote}</p>
              <p className="mt-1 font-mono text-lg text-white/90">
                Cash (funds) ${report.financialPulse.cashOnHand.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-white/45">Liquidity ratio (modeled) {report.financialPulse.liquidityRatio?.toFixed(2) ?? "—"}</p>
              <div className="mt-6">
                <DaysCashBar days={report.financialPulse.daysCashOnHand} />
              </div>
            </ObsidianCard>
          </div>

          <ObsidianCard>
            <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/50">Housing (tax-shield, illustrative)</p>
                <p className="mt-1 text-lg text-white/90">
                  {report.shieldSummary.housingTotalLabel} <span className="text-white/50">· est. effect</span> {report.shieldSummary.taxSavedLabel}
                </p>
                <p className="mt-2 text-sm text-white/50">{report.taxCompliance.nonProfitStanding}</p>
              </div>
              <button
                type="button"
                onClick={onExportPdf}
                disabled={!report}
                className="shrink-0 cursor-pointer rounded-2xl border border-white/20 px-6 py-4 text-left text-xs font-black uppercase leading-tight tracking-[0.1em] text-white transition hover:scale-[1.01] sm:px-8 sm:py-4 sm:text-sm sm:tracking-[0.15em] disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background: "linear-gradient(180deg, color-mix(in srgb, var(--brand-cyber) 15%, #111), #050505)",
                  boxShadow: "0 0 40px color-mix(in srgb, var(--brand-cyber) 20%, transparent)",
                }}
              >
                {isDemo ? "Export sample PDF (watermarked)" : "Generate certified compliance report"}
              </button>
            </div>
            <p className="mt-4 text-[10px] leading-relaxed text-white/35">
              {report.auditTrail} Board packets should include counsel review.
            </p>
          </ObsidianCard>
        </div>
      ) : null}
    </div>
  );
}
