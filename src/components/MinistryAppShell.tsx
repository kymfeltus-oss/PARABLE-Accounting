"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import AuditModeToggle from "@/components/AuditModeToggle";
import { useBrand } from "@/components/branding/BrandProvider";
import ComplianceEoqAlert from "@/components/compliance/ComplianceEoqAlert";
import SimulationModeBar from "@/components/SimulationModeBar";
import { useAuditMode } from "@/context/AuditModeContext";
import { useDemoMode } from "@/context/DemoModeContext";
import { DEMO_SAFETY_COPY } from "@/lib/demoGuard";
import { getSupabaseBrowser } from "@/lib/supabase/browser-client";
import {
  buildCertifiedLedgerCsv,
  buildGeneralLedgerCsvPlaceholder,
  downloadTextFile,
} from "@/lib/exportLedgerCsv";
import { seedDemoTenant } from "../../seedDemoData.js";
import Sidebar from "@/components/Sidebar";
import BackToDashboardButton from "@/components/navigation/BackToDashboardButton";

function playTermBeep() {
  if (typeof window === "undefined") return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = 880;
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.value = 0.04;
    o.start();
    o.stop(ctx.currentTime + 0.055);
  } catch {
    // no-op
  }
}

export default function MinistryAppShell({ children }: { children: React.ReactNode }) {
  const { auditMode } = useAuditMode();
  const { tenant } = useBrand();
  const supabase = getSupabaseBrowser();
  const { isSimulation, setIsSimulation, simulationReady } = useDemoMode();
  const [simGlitch, setSimGlitch] = useState(0);
  const [seedBusy, setSeedBusy] = useState(false);
  const [seedNote, setSeedNote] = useState<string | null>(null);
  const displayName = tenant?.display_name ?? "PARABLE";

  const onSimToggle = useCallback(
    async (next: boolean) => {
      if (!simulationReady) return;
      playTermBeep();
      setSimGlitch((g) => g + 1);

      if (next) {
        if (!supabase || !tenant?.id) {
          setSeedNote("Configure Supabase and tenant slug to run the Genesis seed.");
          return;
        }
        setSeedBusy(true);
        setSeedNote(null);
        try {
          const res = (await seedDemoTenant(supabase, tenant.id)) as { summary?: { skipped?: boolean; message?: string } };
          if (res?.summary?.skipped) setSeedNote(res.summary.message ?? "Demo already on file for this tenant.");
          else setSeedNote("Stream + payroll + EFTPS-tagged remittances and board resolutions (demo).");
          setIsSimulation(true);
        } catch (e) {
          setSeedNote(e instanceof Error ? e.message : "Could not seed demo data.");
        } finally {
          setSeedBusy(false);
        }
        return;
      }
      setSeedNote(null);
      setIsSimulation(false);
    },
    [simulationReady, supabase, tenant, setIsSimulation],
  );

  const simBarProps = {
    isSimulation,
    onToggle: onSimToggle,
    busy: seedBusy,
    note: seedNote,
  } as const;

  const onGlCsv = () => {
    const y = new Date().getFullYear();
    downloadTextFile(`parable-ledger-gl-${y}.csv`, buildGeneralLedgerCsvPlaceholder());
  };

  const onCertifiedCsv = () => {
    const y = new Date().getFullYear();
    downloadTextFile(`certified-ledger-${y}.csv`, buildCertifiedLedgerCsv());
  };

  const onCertifiedPdf = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const body = `
      <main style="font-family:Georgia,serif;padding:2rem;color:#111;max-width:720px;margin:0 auto">
        <h1 style="font-size:1.25rem;margin:0 0 1rem">Certified ledger — print to PDF</h1>
        <p style="font-size:0.85rem;color:#444">Use your browser <strong>Print → Save as PDF</strong> for a board packet.</p>
        <pre style="white-space:pre-wrap;font-size:11px;background:#f5f5f5;padding:1rem;border:1px solid #ccc;margin-top:1rem">${buildCertifiedLedgerCsv().replace(/</g, "&lt;")}</pre>
      </main>`;
    w.document.write(`<!DOCTYPE html><html><head><title>Certified ledger</title></head><body>${body}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="relative min-h-screen">
      {isSimulation ? (
        <div
          className="pointer-events-none fixed inset-0 z-[1]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0, 242, 255, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 242, 255, 0.03) 1px, transparent 1px)
            `,
            backgroundSize: "20px 20px",
            mixBlendMode: "soft-light",
          }}
          aria-hidden
        />
      ) : null}
      {isSimulation ? (
        <div className="pointer-events-none fixed bottom-0 left-0 z-[1] w-full" aria-hidden>
          <p
            className="border-t border-amber-400/25 bg-amber-500/10 px-3 py-1 text-center text-[9px] font-bold uppercase tracking-widest text-amber-200/90"
            title={DEMO_SAFETY_COPY}
          >
            Mock environment — no IRS / bank
          </p>
        </div>
      ) : null}

      <div className="relative z-[2] flex min-h-screen">
        <aside className="parable-live-surface hidden w-60 shrink-0 flex-col border-r border-white/10 md:flex">
        <div className="border-b border-white/10 px-4 py-5">
          <Link href="/" className="block">
            {tenant?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- tenant logos are arbitrary remote URLs
              <img
                src={tenant.logo_url}
                alt=""
                data-brand-logo
                className="h-6 max-w-[160px] object-contain object-left"
              />
            ) : (
              <Image
                src="/logo.svg"
                alt=""
                data-brand-logo
                width={132}
                height={18}
                priority
                className="h-5 w-auto"
              />
            )}
          </Link>
          <p className="parable-sublabel mt-3 pl-0.5">{displayName} · Ledger</p>
          <motion.div
            key={simGlitch}
            className="mt-5"
            initial={{ x: 0, opacity: 0.9 }}
            animate={{ x: [0, -2, 1, 0], opacity: 1 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            <SimulationModeBar {...simBarProps} />
          </motion.div>
        </div>
        <Sidebar auditMode={auditMode} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="px-3 py-2 md:hidden">
          <SimulationModeBar {...simBarProps} />
        </div>
        <ComplianceEoqAlert />
        <header className="parable-live-surface flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3 md:hidden">
            {tenant?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- tenant logos are arbitrary remote URLs
              <img
                src={tenant.logo_url}
                alt=""
                data-brand-logo
                className="h-5 max-w-[140px] object-contain object-left"
              />
            ) : (
              <Image
                src="/logo.svg"
                alt=""
                data-brand-logo
                width={112}
                height={16}
                priority
                className="h-4 w-auto"
              />
            )}
          </div>
          <div className="hidden min-w-0 md:block">
            <h1 className="parable-header text-lg md:text-xl">{auditMode ? "Audit mode" : "Operations"}</h1>
            <p className="mt-0.5 text-xs text-white/45">
              {auditMode
                ? "IRS-facing view — mandates, filings, and ledger export."
                : "Fund accounting, giving, and ministry spend in one place."}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <AuditModeToggle />
            {auditMode ? (
              <>
                <button
                  type="button"
                  onClick={onGlCsv}
                  className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-neutral-800 shadow-sm hover:bg-neutral-50"
                >
                  GL CSV
                </button>
                <button
                  type="button"
                  onClick={onCertifiedCsv}
                  className="rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white hover:bg-neutral-800"
                >
                  Certified CSV
                </button>
                <button
                  type="button"
                  onClick={onCertifiedPdf}
                  className="rounded-full border border-neutral-800 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-neutral-900 hover:bg-neutral-100"
                >
                  Certified PDF
                </button>
              </>
            ) : null}
            <span className="hidden rounded-full border border-[color:rgb(var(--brand-cyber-rgb)/0.3)] bg-[color:rgb(var(--brand-cyber-rgb)/0.08)] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--brand-cyber)] sm:inline">
              {displayName}
            </span>
          </div>
        </header>

        <main className="ministry-scroll min-h-0 flex-1 overflow-y-auto p-4 md:p-8">
          <BackToDashboardButton />
          {children}
        </main>
      </div>
      </div>
    </div>
  );
}
