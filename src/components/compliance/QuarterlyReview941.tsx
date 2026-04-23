"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBrand } from "@/components/branding/BrandProvider";
import { getForm941DueDate, suggestedReportQuarter } from "@/lib/quarterFilingCalendar";
import { buildEftpsDepositView, quarterLiabilityFromTotals } from "@/lib/eftpsReconciliation";
import { getQuarterlyTotals, markQuarterly941Generated, type QuarterlyTotals } from "@/lib/taxAggregationFromLedger";
import { getSupabaseBrowser } from "@/lib/supabase/browser-client";
import { useDemoMode } from "@/context/DemoModeContext";
import { buildForm941WorkpaperHtml } from "@/lib/form941Workpaper";
import EFTPSPulse from "./EFTPSPulse";

export type QuarterlyReviewProps = {
  year?: number;
  quarter?: 1 | 2 | 3 | 4;
};

/** Row from `parable_ledger.view_941_quarterly_summary` (EOQ 941 read model). */
export type View941QuarterlySummary = {
  tenant_id: string;
  tax_year: number;
  quarter: number;
  line2_wages_tips_other_compensation: string | number;
  line3_federal_income_tax_withheld: string | number;
  line5a_social_security_wages: string | number;
  employer_fica_match: string | number;
  subtotal_minister_wages_excluded_from_ss_medicare: string | number;
  subtotal_non_minister_gross: string | number;
  total_modeled_deposit_liability: string | number;
  is_generated: boolean;
  computed_at: string;
};

function n(v: string | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v) || 0;
}

export default function QuarterlyReview941({ year: yearProp, quarter: quarterProp }: QuarterlyReviewProps) {
  const supabase = getSupabaseBrowser();
  const { isSimulation } = useDemoMode();
  const { tenant, error: brandError, ready: brandReady } = useBrand();
  const [totals, setTotals] = useState<QuarterlyTotals | null>(null);
  const [viewRow, setViewRow] = useState<View941QuarterlySummary | null>(null);
  const [viewNote, setViewNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [eftpsView, setEftpsView] = useState<Awaited<ReturnType<typeof buildEftpsDepositView>> | null>(null);
  const [successFlash, setSuccessFlash] = useState(false);
  const eftpsPaidRef = useRef<boolean | null>(null);

  const yq = useCallback(() => {
    if (yearProp != null && quarterProp != null) return { year: yearProp, quarter: quarterProp, due: getForm941DueDate(yearProp, quarterProp) };
    const s = suggestedReportQuarter(new Date());
    return { year: s.year, quarter: s.quarter, due: s.dueDate };
  }, [yearProp, quarterProp]);

  const load = useCallback(async () => {
    if (!supabase || !tenant?.id) {
      setLoading(false);
      if (brandReady) setError(brandError ?? "Tenant not loaded; check branding / Supabase.");
      return;
    }
    setLoading(true);
    setError(null);
    setViewNote(null);
    const { year, quarter } = yq();
    try {
      const t = await getQuarterlyTotals(supabase, tenant.id, year, quarter, { persist: true });
      setTotals(t);

      const { data: v, error: vErr } = await supabase
        .schema("parable_ledger")
        .from("view_941_quarterly_summary")
        .select("*")
        .eq("tenant_id", tenant.id)
        .eq("tax_year", year)
        .eq("quarter", quarter)
        .maybeSingle();

      if (vErr) {
        setViewRow(null);
        setViewNote("view_941_quarterly_summary unavailable — run latest Supabase migration; using live totals only.");
      } else {
        setViewRow((v as View941QuarterlySummary) ?? null);
        setViewNote("Synced with view_941_quarterly_summary (Supabase).");
      }

      const { data: row } = await supabase
        .schema("parable_ledger")
        .from("quarterly_tax_reports")
        .select("is_generated")
        .eq("tenant_id", tenant.id)
        .eq("tax_year", year)
        .eq("quarter", quarter)
        .maybeSingle();
      setIsVerified(!!(row as { is_generated?: boolean } | null)?.is_generated);

      const liab = quarterLiabilityFromTotals(t);
      const eft = await buildEftpsDepositView(
        supabase,
        tenant.id,
        year,
        quarter,
        liab,
        (msg) => {
          if (process.env.NODE_ENV === "development") console.warn("PARABLE lookback:", msg);
        },
      );
      setEftpsView(eft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load 941 data.");
      setEftpsView(null);
    } finally {
      setLoading(false);
    }
  }, [supabase, tenant, brandReady, brandError, yq]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    const now = eftpsView?.status.isFullyPaid ?? false;
    if (eftpsPaidRef.current === null) {
      eftpsPaidRef.current = now;
      return;
    }
    if (!eftpsPaidRef.current && now) {
      setSuccessFlash(true);
      const t = window.setTimeout(() => setSuccessFlash(false), 1000);
      eftpsPaidRef.current = now;
      return () => window.clearTimeout(t);
    }
    eftpsPaidRef.current = now;
  }, [eftpsView?.status.isFullyPaid]);

  const { year, quarter, due: dueD } = yq();
  const dueLabel = dueD.toLocaleDateString(undefined, { dateStyle: "long" });

  useEffect(() => {
    eftpsPaidRef.current = null;
  }, [year, quarter]);

  const employerFica = totals?.employerFicaMatch ?? 0;
  const employeeFica = employerFica;
  const ficaTotal = round2(employerFica + employeeFica);
  const totalLiability = round2((totals?.line3 ?? 0) + ficaTotal);
  const ministerWages = totals?.subtotals.ministerSalary ?? 0;

  const unfundedLiability =
    !!totals &&
    !!eftpsView &&
    !eftpsView.status.isFullyPaid &&
    (totals.line3 > 0.005 || ficaTotal > 0.005) &&
    eftpsView.eftps.totalDetected + 0.01 < totalLiability;

  const onGenerate941Pdf = () => {
    if (!totals || !supabase || !tenant?.id) return;
    setPdfBusy(true);
    const liab = quarterLiabilityFromTotals(totals);
    const html = buildForm941WorkpaperHtml({
      orgName: tenant.display_name ?? "PARABLE",
      legalName: tenant.legal_name ?? tenant.display_name ?? "Organization",
      ein: tenant.tax_id_ein ?? null,
      year: totals.year,
      quarter: totals.quarter as 1 | 2 | 3 | 4,
      totals,
      unfundedLiabilityWarning: unfundedLiability,
      eftpsDetectedInQuarter: eftpsView?.eftps.totalDetected ?? 0,
      modeledLiability: liab,
    });
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
    }
    void (async () => {
      try {
        await getQuarterlyTotals(supabase, tenant.id, totals.year, totals.quarter as 1 | 2 | 3 | 4, { persist: true });
        await markQuarterly941Generated(supabase, tenant.id, totals.year, totals.quarter as 1 | 2 | 3 | 4);
        setIsVerified(true);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      } finally {
        setPdfBusy(false);
      }
    })();
  };

  if (loading && !totals) {
    return (
      <div className="min-h-screen bg-[var(--brand-surface)] p-8 text-sm text-white/50">Loading 941 workpaper…</div>
    );
  }

  const vL2 = viewRow ? n(viewRow.line2_wages_tips_other_compensation) : null;
  const vL3 = viewRow ? n(viewRow.line3_federal_income_tax_withheld) : null;
  const v5a = viewRow ? n(viewRow.line5a_social_security_wages) : null;
  const vMin = viewRow ? n(viewRow.subtotal_minister_wages_excluded_from_ss_medicare) : null;

  return (
    <div
      className="relative min-h-screen bg-[var(--brand-surface)] p-6 text-white sm:p-10"
      style={{ fontFamily: "var(--font-parable, system-ui)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[100] mix-blend-screen transition-opacity duration-200 ease-out"
        style={{
          opacity: successFlash ? 0.5 : 0,
          background:
            "radial-gradient(ellipse at center, color-mix(in srgb, var(--brand-cyber) 50%, transparent) 0%, transparent 65%)",
        }}
      />
      {error ? <div className="mb-6 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{error}</div> : null}

      {unfundedLiability && (
        <div
          className="mb-6 rounded-xl border-2 border-amber-500/60 px-4 py-3 text-center text-sm font-bold uppercase leading-relaxed tracking-wide text-amber-100"
          style={{
            textShadow: "0 0 20px rgba(250, 204, 21, 0.25)",
            boxShadow: "0 0 24px rgba(234, 179, 8, 0.12), inset 0 0 0 1px rgba(251, 191, 36, 0.2)",
          }}
          role="alert"
        >
          UNFUNDED LIABILITY DETECTED — DEPOSIT REQUIRED. Withholding and/or payroll taxes are modeled in the ledger, but
          EFTPS-tagged payments for this quarter are below the modeled deposit. Reconcile before filing.
        </div>
      )}

      {eftpsView ? (
        <div className="mb-8 max-w-4xl">
          <EFTPSPulse status={eftpsView.status} depositor={eftpsView.depositor} simulation={isSimulation} />
          <p className="mt-2 pl-0.5 text-[10px] text-white/35">
            Matched {eftpsView.eftps.matchCount} row(s) · EFTPS total ${eftpsView.eftps.totalDetected.toLocaleString(undefined, { maximumFractionDigits: 2 })} (source / memo
            text or metadata <code className="font-mono text-white/50">irs_eftps</code>).
          </p>
        </div>
      ) : null}
      {isVerified ? (
        <p
          className="mb-6 border border-[color:rgb(var(--brand-glow-rgb)/0.3)] bg-[color:rgb(var(--brand-glow-rgb)/0.08)] px-4 py-2 text-center text-xs font-bold uppercase tracking-[0.2em] text-[color:rgb(var(--brand-glow-rgb))]"
          role="status"
        >
          Verified — Form 941 workpaper generated for {year} Q{quarter}
        </p>
      ) : null}
      <header className="mb-10 flex flex-col justify-between gap-6 border-b border-white/10 pb-8 sm:mb-16 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter sm:text-4xl">Quarterly review</h1>
          <p
            className="mt-2 text-xs font-bold uppercase tracking-[0.35em] text-[color:rgb(var(--brand-glow-rgb)/0.9)]"
            style={{ textShadow: "0 0 20px color-mix(in srgb, var(--brand-glow) 35%, transparent)" }}
          >
            IRS Form 941 · compliance sync
          </p>
          <p className="mt-1 text-xs text-white/40">
            Period {year} Q{quarter} · {totals?.rowCount ?? 0} payroll line(s) · {viewNote ?? ""}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Typical filing due</p>
          <p
            className="font-mono text-xl"
            style={{
              color: "rgb(248 113 113)",
              textShadow: "0 0 18px color-mix(in srgb, rgb(248 113 113) 35%, transparent)",
            }}
          >
            {dueLabel}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md sm:p-8 lg:col-span-2">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-white/60">Tax liability breakdown</h2>
          <p className="text-[10px] leading-relaxed text-white/40">
            Ministerial compensation is excluded from Social Security and Medicare <strong className="text-white/50">wage base</strong> (line
            5a). Non-minister lines: <strong className="text-white/50">housing allowance</strong> in metadata (
            <code className="font-mono">housing_allowance_usd</code> / <code className="font-mono">parsonage_exclusion</code>) is subtracted
            from the FICA base. Federal withholding (line 3) is unchanged. Not legal or payroll advice.
          </p>
          <div className="space-y-4">
            <div className="flex justify-between border-b border-white/5 pb-4">
              <span className="text-white/80">Line 2 — wages, tips, and other compensation (incl. ministers)</span>
              <span className="font-mono text-lg text-white/95">${(totals?.line2 ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            {viewRow && vL2 != null && (
              <p className="text-[9px] text-cyan-200/60">view_941_quarterly_summary.line2: ${vL2.toFixed(2)} (should match after persist)</p>
            )}
            <div className="flex justify-between border-b border-white/5 pb-4">
              <span className="text-white/80">Line 3 — federal income tax withheld</span>
              <span className="font-mono text-lg">${(totals?.line3 ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-4">
              <span className="text-white/80">Line 5a — taxable Social Security wages (FICA base; excl. ministers + housing excl.)</span>
              <span className="font-mono text-lg text-[color:rgb(var(--brand-glow-rgb)/0.95)]">${(totals?.line5a ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            {viewRow && v5a != null && (
              <p className="text-[9px] text-cyan-200/60">view line5a_social_security_wages: ${v5a.toFixed(2)}</p>
            )}
            <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-2 text-[10px] text-white/45">
              <span className="text-amber-200/80">Minister wages (excluded from SS/Med):</span> ${ministerWages.toFixed(2)}
              {viewRow && vMin != null ? <span className="ml-2 text-cyan-200/50">(view: ${vMin.toFixed(2)})</span> : null}
            </div>
            <div className="flex justify-between border-b border-white/5 pb-4">
              <span className="text-[color:rgb(var(--brand-glow-rgb)/0.95)]">FICA (EE + ER on 7.65% + 7.65% of line 5a base)</span>
              <span className="font-mono text-lg text-[color:rgb(var(--brand-glow-rgb))]">${ficaTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            <p className="text-[10px] leading-relaxed text-white/35">Employee + employer FICA, each 7.65% of the line 5a base — not legal advice.</p>
          </div>
          <div
            className="mt-8 flex flex-col justify-between gap-2 rounded-2xl border p-6 sm:flex-row sm:items-center"
            style={{
              borderColor: "color-mix(in srgb, var(--brand-glow) 20%, transparent)",
              background: "color-mix(in srgb, var(--brand-glow) 8%, rgba(0,0,0,0.2))",
            }}
          >
            <span className="text-lg font-bold italic sm:text-xl">Total deposit (modeled)</span>
            <span
              className="text-3xl font-black sm:text-4xl"
              style={{ color: "var(--brand-glow)", textShadow: "0 0 32px color-mix(in srgb, var(--brand-glow) 30%, transparent)" }}
            >
              ${totalLiability.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
        <div className="space-y-4">
          <button
            type="button"
            onClick={onGenerate941Pdf}
            disabled={pdfBusy || !totals}
            className="w-full cursor-pointer rounded-2xl border border-[color:rgb(var(--brand-cyber-rgb)/0.2)] py-5 text-xs font-black uppercase tracking-widest text-black transition hover:scale-[1.02] sm:py-6 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: "var(--brand-cyber)",
              boxShadow: "0 0 30px color-mix(in srgb, var(--brand-cyber) 35%, transparent)",
            }}
          >
            {pdfBusy ? "Saving…" : "Generate form 941 PDF (workpaper)"}
          </button>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-xs leading-relaxed text-white/50">
            <p className="mb-2 font-bold italic text-white/90 underline">Gate 4 — tax pillar</p>
            <p>
              The CFO annual integrity certificate stays blocked from &quot;all green&quot; until 941 workpapers and deposits line up with your
              policy. Use EFTPS-tagged bank lines to close the loop.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
