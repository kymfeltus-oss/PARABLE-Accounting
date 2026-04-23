"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useBrand } from "@/components/branding/BrandProvider";
import { getSupabaseBrowser } from "@/lib/supabase/browser-client";
import { evaluatePillarStatus, generateIntegrityCertificate, PILLAR_KEYS } from "@/lib/integrityCertificateFromRoot.js";
import { compileAnnualReport, annualReportToPrintHtml } from "../../../annualReportGenerator.js";

const PILLAR_LABEL: Record<string, { title: string; short: string }> = {
  ledger: { title: "Ledger", short: "Chart of accounts & funds" },
  irs_1828: { title: "IRS / Pub 1828", short: "AI Guardian log" },
  stewardship: { title: "Stewardship", short: "Restricted vs cash" },
  tax: { title: "Housing & payroll", short: "Staff onboarding" },
  audit: { title: "1099 & vendors", short: "Contractor watchdog" },
};

type PillarState = { status: string; detail: string; fixHref?: string };

const SEAL_MS = 3000;

export type CfoComplianceViewProps = { year: number; cashOnHand?: number };

export default function CfoComplianceView({ year, cashOnHand }: CfoComplianceViewProps) {
  const supabase = getSupabaseBrowser();
  const { tenant, ready: brandReady } = useBrand();
  const [pillars, setPillars] = useState<Record<string, PillarState> | null>(null);
  const [compliant, setCompliant] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sealRun, setSealRun] = useState(false);
  const [sealId, setSealId] = useState<string | null>(null);
  const [certHash, setCertHash] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !tenant?.id) {
      setLoading(false);
      return;
    }
    setLoadErr(null);
    setLoading(true);
    try {
      const ev = await evaluatePillarStatus(supabase, tenant.id, year);
      setPillars(ev.pillars);
      setCompliant(ev.isCompliant);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Pillar check failed");
      setPillars(null);
    } finally {
      setLoading(false);
    }
  }, [supabase, tenant?.id, year]);

  useEffect(() => {
    if (brandReady) void load();
  }, [brandReady, load]);

  const onGenerateCertificate = async () => {
    if (!supabase || !tenant?.id) return;
    if (!compliant) return;
    setSealRun(true);
    setSealId(null);
    setCertHash(null);
    await new Promise((r) => setTimeout(r, SEAL_MS));
    try {
      const cert = await generateIntegrityCertificate(supabase, tenant.id, year, { orgLabel: tenant.display_name ?? "PARABLE" });
      if (cert.certified && cert.sealId && cert.certificateHash) {
        setSealId(cert.sealId);
        setCertHash(cert.certificateHash);
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(
            `parable_seal_${tenant.id}_${year}`,
            JSON.stringify({ sealId: cert.sealId, hash: cert.certificateHash, at: cert.generatedAt }),
          );
        }
      }
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Certificate failed");
    } finally {
      setSealRun(false);
    }
  };

  const onAnnualPdf = () => {
    if (typeof window === "undefined") return;
    const report = compileAnnualReport(
      {
        year,
        balanceSheet: { note: "Board packet should attach audited or reviewed statements when available." },
        restrictedOutflow: { note: "Tie to ministry_funds and designations (modeled in PARABLE)." },
        narrative: "High-impact ministry — institutional transparency builds trust and participation.",
      },
      sealId,
    );
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(annualReportToPrintHtml(report, { orgName: tenant?.display_name ?? "PARABLE" }));
    w.document.close();
    w.focus();
    w.print();
  };

  if (!brandReady) return null;

  return (
    <div className="space-y-6" data-integrity-surface>
      <div className="text-center sm:text-left">
        <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-amber-200/90">Integrity gatekeeper</p>
        <h2
          className="mt-1 text-xl font-black uppercase italic tracking-tight sm:text-2xl"
          style={{ textShadow: "0 0 24px color-mix(in srgb, rgb(250 204 21) 15%, transparent)" }}
        >
          Sovereign seal & proof of stewardship
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          The certificate hash is generated only if every pillar is CLEARED — not given by default. Advisory only; not an IRS
          or legal attestation.
        </p>
      </div>

      {loadErr ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{loadErr}</div>
      ) : null}

      {loading && !pillars ? <p className="text-sm text-zinc-500">Evaluating pillars…</p> : null}

      {pillars && (
        <div className="grid gap-3 sm:grid-cols-1">
          {PILLAR_KEYS.map((key) => {
            const p = pillars[key];
            const meta = PILLAR_LABEL[key] ?? { title: key, short: "" };
            const ok = p?.status === "CLEARED";
            return (
              <div
                key={key}
                className={[
                  "flex flex-col gap-1 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
                  ok ? "border-cyan-500/20 bg-cyan-500/[0.04]" : "border-amber-500/40 bg-amber-500/[0.07] shadow-[0_0_20px_rgba(245,158,11,0.08)]",
                ].join(" ")}
              >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: ok ? "var(--brand-cyber)" : "rgb(252 211 77)" }}>
                    {meta.title}
                  </p>
                  <p className="text-[9px] text-zinc-500">{meta.short}</p>
                  <p className="mt-1 text-xs text-zinc-200/90">{p?.detail}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className="text-[9px] font-mono font-bold uppercase"
                    style={{ color: ok ? "rgb(34 211 238)" : "rgb(250 204 21)" }}
                  >
                    {p?.status}
                  </span>
                  {p?.fixHref && !ok && (
                    <Link
                      href={p.fixHref}
                      className="rounded-lg border border-amber-500/50 px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-amber-200 hover:bg-amber-500/10"
                    >
                      Fix
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          disabled={!compliant || loading || sealRun}
          onClick={() => void onGenerateCertificate()}
          className="rounded-2xl border border-amber-400/40 bg-gradient-to-b from-amber-500/15 to-black/40 px-6 py-3 text-xs font-black uppercase tracking-[0.2em] text-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ boxShadow: compliant ? "0 0 32px rgba(250, 204, 21, 0.12)" : "none" }}
        >
          {sealRun ? "Sealing…" : "Generate certificate"}
        </button>
        <button
          type="button"
          disabled={!sealId}
          onClick={onAnnualPdf}
          className="rounded-2xl border border-white/15 px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest text-zinc-200 disabled:opacity-30"
        >
          CFO annual report (print / PDF)
        </button>
      </div>

      <AnimatePresence>
        {sealRun ? <WaxSealOverlay label={tenant?.display_name?.slice(0, 3) ?? "P"} /> : null}
      </AnimatePresence>

      {certHash && sealId && (
        <div className="border-t border-white/10 pt-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-cyan-500/80">Proof of stewardship</p>
          <p className="mt-1 break-all font-mono text-sm text-cyan-200/90" style={{ textShadow: "0 0 12px color-mix(in srgb, #22d3ee 0.25, transparent)" }}>
            {sealId}
          </p>
          <p className="mt-2 break-all font-mono text-[10px] leading-relaxed text-cyan-100/50" style={{ textShadow: "0 0 8px rgba(34,211,238,0.15)" }}>
            {certHash}
          </p>
          {cashOnHand != null && (
            <p className="mt-2 text-[9px] text-zinc-600">Fiscal {year} · cash on hand (report): ${cashOnHand.toLocaleString()}</p>
          )}
        </div>
      )}
    </div>
  );
}

function WaxSealOverlay({ label }: { label: string }) {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="relative flex h-40 w-40 items-center justify-center rounded-full"
        style={{
          background: "radial-gradient(circle at 35% 30%, #5c2a1e 0%, #2a0a0a 45%, #1a0505 100%)",
          boxShadow: "inset 0 0 24px rgba(0,0,0,0.5), 0 0 40px rgba(180, 80, 40, 0.35), 0 12px 40px rgba(0,0,0,0.6)",
          border: "3px solid rgba(220, 160, 60, 0.45)",
        }}
        initial={{ scale: 0.2, rotate: -18, y: 80, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, y: 0, opacity: 1 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          className="absolute inset-1 rounded-full border border-amber-200/20"
          animate={{ scale: [1, 1.04, 1, 1.02, 1] }}
          transition={{ duration: 2.2, ease: "easeInOut" }}
        />
        <div className="relative z-10 text-center">
          <p className="font-serif text-2xl font-bold tracking-tighter text-amber-100/95" style={{ textShadow: "0 1px 0 #000" }}>
            {label}
          </p>
          <p className="mt-1 text-[7px] font-bold uppercase tracking-[0.4em] text-amber-200/70">Parable</p>
        </div>
        <motion.div
          className="absolute -bottom-3 left-1/2 h-3 w-24 -translate-x-1/2 rounded-full bg-black/50 blur-md"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 0.6, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        />
      </motion.div>
      <p className="absolute bottom-16 text-center text-[9px] font-bold uppercase tracking-[0.5em] text-cyan-300/80">
        Sovereign integrity seal
      </p>
    </motion.div>
  );
}
