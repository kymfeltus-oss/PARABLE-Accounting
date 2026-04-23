"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useBrand } from "@/components/branding/BrandProvider";
import { useAuditMode } from "@/context/AuditModeContext";
import { getEoqComplianceWindow } from "@/lib/quarterFilingCalendar";
import { getSupabaseBrowser } from "@/lib/supabase/browser-client";

/**
 * Shown in the main shell when the calendar is within 15 days of a quarter end
 * and 941 is not yet marked generated for that quarter in Supabase.
 */
export default function ComplianceEoqAlert() {
  const { auditMode } = useAuditMode();
  const { tenant, ready: brandReady } = useBrand();
  const [reportDone, setReportDone] = useState<boolean | null>(null);
  const supabase = getSupabaseBrowser();
  const eoq = useMemo(() => getEoqComplianceWindow(new Date(), 15), []);

  const skip = auditMode || !eoq.active || !brandReady || !tenant?.id;

  useEffect(() => {
    if (skip) {
      return;
    }
    if (!supabase) {
      queueMicrotask(() => {
        setReportDone(false);
      });
      return;
    }
    let cancel = false;
    void (async () => {
      const { data, error } = await supabase
        .schema("parable_ledger")
        .from("quarterly_tax_reports")
        .select("is_generated")
        .eq("tenant_id", tenant.id)
        .eq("tax_year", eoq.year)
        .eq("quarter", eoq.quarter)
        .maybeSingle();
      if (cancel) return;
      if (error) {
        setReportDone(false);
        return;
      }
      setReportDone(!!(data as { is_generated?: boolean } | null)?.is_generated);
    })();
    return () => {
      cancel = true;
    };
  }, [skip, supabase, tenant?.id, eoq.active, eoq.quarter, eoq.year, auditMode, brandReady]);

  if (skip) {
    return null;
  }
  if (reportDone === true) {
    return null;
  }
  if (reportDone === null) {
    return <div className="min-h-0 border-b border-white/5" aria-hidden="true" />;
  }

  return (
    <div
      className="border-b border-[color:rgb(var(--brand-glow-rgb)/0.35)] bg-[color:rgb(var(--brand-glow-rgb)/0.08)] px-3 py-2 sm:px-4"
      role="status"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 text-center sm:justify-between sm:text-left">
        <p className="text-[10px] font-bold uppercase leading-snug tracking-[0.2em] text-white/80 sm:tracking-[0.28em]">
          <span className="text-[color:rgb(var(--brand-glow-rgb))]">EOQ</span> compliance window — quarter{" "}
          {eoq.quarter} end approaching. Reconcile 941 data.
        </p>
        <Link
          href="/quarterly-review"
          className="shrink-0 rounded-full border border-[color:rgb(var(--brand-glow-rgb)/0.45)] bg-[color:rgb(var(--brand-glow-rgb)/0.1)] px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[color:rgb(var(--brand-glow-rgb))] transition hover:bg-[color:rgb(var(--brand-glow-rgb)/0.18)]"
        >
          Open status room
        </Link>
      </div>
    </div>
  );
}
