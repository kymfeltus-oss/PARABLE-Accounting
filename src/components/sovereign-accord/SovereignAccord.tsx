"use client";

import { AnimatePresence, motion } from "framer-motion";
import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { useBrand } from "@/components/branding/BrandProvider";
import TaxShieldVisual from "@/components/compliance/TaxShieldVisual";
import { buildBoardResolutionText } from "@/lib/boardResolutionTemplate";
import { getSupabaseBrowser } from "@/lib/supabase/browser-client";
import { downloadTextFile, buildGeneralLedgerCsvPlaceholder } from "@/lib/exportLedgerCsv";

export type MandateType = "HOUSING_ALLOWANCE" | "SECA_STATUS" | "ACCOUNTABLE_PLAN" | "BOARD_MINUTES";

export type ComplianceMandateRow = {
  id: string;
  tenant_id?: string;
  fiscal_year: number;
  mandate_type: MandateType;
  status: string;
  document_url: string | null;
  document_hash?: string | null;
  approved_by_user_id: string | null;
  board_approval_timestamp: string | null;
  metadata: Record<string, unknown>;
};

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function formatApprovedAt(iso: string | null | undefined, fiscalYear: number): string {
  if (!iso) {
    return `No board approval timestamp on file — link resolution timing to before ${fiscalYear} tax year when locking.`;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: "full",
    timeStyle: "short",
  });
}

const MANDATE_LABELS: Record<MandateType, { title: string; subtitle: string }> = {
  HOUSING_ALLOWANCE: { title: "Housing allowance", subtitle: "Designation & board resolution" },
  SECA_STATUS: { title: "SECA / self-employment", subtitle: "Withholding elections & Form 941 alignment" },
  ACCOUNTABLE_PLAN: { title: "Accountable plan", subtitle: "Business expense reimbursements" },
  BOARD_MINUTES: { title: "Board minutes", subtitle: "Evidence of authorization" },
};

function statusTone(status: string, hasDoc: boolean, locked: boolean): "safe" | "warn" | "bad" {
  if (status === "active" && hasDoc && locked) return "safe";
  if (status === "expired" || (!hasDoc && status !== "archived")) return "bad";
  return "warn";
}

export default function SovereignAccord() {
  const supabase = getSupabaseBrowser();
  const { tenant, error: brandError, ready: brandReady } = useBrand();
  const fiscalYear = new Date().getFullYear();
  const [rows, setRows] = useState<ComplianceMandateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [salary, setSalary] = useState(60_000);
  const [housing, setHousing] = useState(30_000);
  const [pdfModal, setPdfModal] = useState<{
    url: string;
    title: string;
    approvedAt: string | null;
  } | null>(null);

  useEffect(() => {
    if (!pdfModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPdfModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pdfModal]);

  const load = useCallback(async () => {
    if (!supabase) {
      startTransition(() => {
        setLoading(false);
        setError("Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local to sync mandates.");
      });
      return;
    }
    if (!tenant?.id) {
      startTransition(() => {
        if (!brandReady) {
          setLoading(true);
          setError(null);
          setRows([]);
        } else {
          setLoading(false);
          setRows([]);
          setError(
            brandError ?? "Tenant not resolved — run white_label_schema.sql and set NEXT_PUBLIC_TENANT_SLUG.",
          );
        }
      });
      return;
    }
    startTransition(() => {
      setLoading(true);
      setError(null);
    });
    const { data, error: qErr } = await supabase
      .schema("parable_ledger")
      .from("compliance_mandates")
      .select("*")
      .eq("tenant_id", tenant.id)
      .eq("fiscal_year", fiscalYear)
      .order("mandate_type");
    startTransition(() => {
      if (qErr) {
        setError(qErr.message);
        setRows([]);
      } else {
        setRows((data ?? []) as ComplianceMandateRow[]);
      }
      setLoading(false);
    });
  }, [supabase, fiscalYear, tenant, brandReady, brandError]);

  useEffect(() => {
    void load();
  }, [load]);

  const housingRow = useMemo(
    () => rows.find((r) => r.mandate_type === "HOUSING_ALLOWANCE"),
    [rows],
  );

  const housingRisk =
    !housingRow ||
    housingRow.status !== "active" ||
    !housingRow.document_url ||
    !housingRow.board_approval_timestamp;

  const onLock = async (id: string) => {
    if (!supabase || !tenant?.id) return;
    const { error: uErr } = await supabase
      .schema("parable_ledger")
      .from("compliance_mandates")
      .update({
        board_approval_timestamp: new Date().toISOString(),
        status: "active",
      })
      .eq("id", id)
      .eq("tenant_id", tenant.id);
    if (uErr) setError(uErr.message);
    else void load();
  };

  const onUpload = async (id: string, file: File | null) => {
    if (!supabase || !file || !tenant?.id) return;
    const path = `${tenant.id}/${fiscalYear}/${id}/${file.name}`;
    const bucket = "mandate-documents";
    const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (upErr) {
      setError(
        `${upErr.message} — create Storage bucket "${bucket}" (private) in Supabase, or paste a document URL via SQL for now.`,
      );
      return;
    }
    const { data: signed, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 365);
    if (signErr) {
      setError(signErr.message);
      return;
    }
    const url = signed?.signedUrl;
    const { error: uErr } = await supabase
      .schema("parable_ledger")
      .from("compliance_mandates")
      .update({ document_url: url })
      .eq("id", id)
      .eq("tenant_id", tenant.id);
    if (uErr) setError(uErr.message);
    else void load();
  };

  const mandateByType = useMemo(() => {
    const m = new Map<MandateType, ComplianceMandateRow>();
    for (const r of rows) m.set(r.mandate_type, r);
    return m;
  }, [rows]);

  return (
    <div className="mx-auto max-w-4xl space-y-10 text-white">
      {brandError ? (
        <div
          role="status"
          className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
        >
          {brandError}
        </div>
      ) : null}
      <AnimatePresence>
        {pdfModal ? (
          <motion.div
            key="pdf-backdrop"
            role="presentation"
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setPdfModal(null)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="sovereign-pdf-title"
              className="brand-shadow-modal relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/20 bg-white/[0.07] backdrop-blur-xl"
              initial={{ scale: 0.96, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 12 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
                <div>
                  <h2 id="sovereign-pdf-title" className="brand-text-glow-muted text-sm font-bold uppercase tracking-wide">
                    {pdfModal.title}
                  </h2>
                  <p className="mt-1 text-xs text-white/55">
                    <span className="font-semibold text-white/70">Approved at (audit):</span>{" "}
                    {formatApprovedAt(pdfModal.approvedAt, fiscalYear)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPdfModal(null)}
                  className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-[rgb(var(--brand-glow-rgb)/0.4)] hover:text-[rgb(var(--brand-glow-rgb)/0.95)]"
                >
                  Close
                </button>
              </div>
              <iframe
                title={pdfModal.title}
                src={pdfModal.url}
                className="min-h-[60vh] w-full flex-1 border-0 bg-black/40"
              />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <header className="border-l-4 border-[var(--brand-glow)] pl-5">
        <p className="brand-text-glow-muted text-[10px] font-semibold uppercase tracking-[0.4em]">Sovereign Accord</p>
        <h1 className="brand-text-glow mt-1 text-3xl font-black uppercase italic tracking-tighter md:text-4xl">
          Compliance Mandates
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/50">
          Annual board artifacts for housing, SECA, and accountable plans — timestamped locks for audit readiness.
        </p>
      </header>

      {housingRisk ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 shadow-[0_0_24px_rgba(245,158,11,0.2)]"
        >
          <strong className="font-semibold">High priority:</strong> No active Housing Allowance designation found for{" "}
          {fiscalYear}. <span className="text-amber-200/90">Audit risk: high.</span> Upload board documentation and
          record the lock below.
        </div>
      ) : null}

      <TaxShieldVisual annualSalary={salary} housingAllowance={housing} />

      <div className="grid gap-4 rounded-2xl border border-white/10 bg-[var(--brand-surface)] p-4 md:grid-cols-2 md:p-6">
        <label className="block text-xs uppercase tracking-widest text-white/45">
          Reported cash salary (illustrative)
          <input
            type="number"
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 font-mono text-sm text-white"
            value={salary}
            onChange={(e) => setSalary(Number(e.target.value))}
          />
        </label>
        <label className="block text-xs uppercase tracking-widest text-white/45">
          Designated housing amount
          <input
            type="number"
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 font-mono text-sm text-white"
            value={housing}
            onChange={(e) => setHousing(Number(e.target.value))}
          />
        </label>
      </div>

      <section>
        <h2 className="parable-header text-xl">Accord timeline — {fiscalYear}</h2>
        <p className="mt-1 text-xs text-white/45">
          {loading ? "Loading mandates…" : error ?? `${rows.length} record(s) loaded.`}
        </p>

        <ol className="relative mt-8 border-l border-[rgb(var(--brand-glow-rgb)/0.25)] pl-8">
          {(Object.keys(MANDATE_LABELS) as MandateType[]).map((type, idx) => {
            const row = mandateByType.get(type);
            const hasDoc = Boolean(row?.document_url);
            const locked = Boolean(row?.board_approval_timestamp);
            const tone = row ? statusTone(row.status, hasDoc, locked) : "bad";
            const glow =
              tone === "safe"
                ? "border-[rgb(var(--brand-glow-rgb)/0.4)] shadow-[0_0_28px_rgb(var(--brand-glow-rgb)/0.25)]"
                : tone === "bad"
                  ? "border-red-500/35 shadow-[0_0_20px_rgba(239,68,68,0.18)]"
                  : "border-amber-400/35 shadow-[0_0_18px_rgba(245,158,11,0.15)]";

            return (
              <li key={type} className="mb-10 last:mb-0">
                <span className="absolute -left-[9px] mt-1.5 h-4 w-4 rounded-full bg-[var(--brand-surface)] ring-2 ring-[rgb(var(--brand-glow-rgb)/0.6)]" />
                <motion.article
                  whileHover={{ scale: 1.01 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  className={`rounded-2xl border bg-[rgba(11,13,16,0.92)] p-5 backdrop-blur-md ${glow}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/40">Step {idx + 1}</p>
                      <h3 className="mt-1 text-lg font-semibold text-white">{MANDATE_LABELS[type].title}</h3>
                      <p className="text-sm text-white/50">{MANDATE_LABELS[type].subtitle}</p>
                      <p className="brand-text-glow-muted mt-2 text-xs font-mono">
                        {row ? `Status: ${row.status}` : "No row yet — create via SQL or app insert"}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-center text-[10px] font-black uppercase tracking-wide ${
                          tone === "safe"
                            ? "bg-[rgb(var(--brand-glow-rgb)/0.15)] text-[rgb(var(--brand-glow-rgb)/0.95)]"
                            : tone === "bad"
                              ? "bg-red-500/15 text-red-300"
                              : "bg-amber-500/15 text-amber-200"
                        }`}
                      >
                        {tone === "safe" ? "Active" : tone === "bad" ? "Missing / expired" : "Review"}
                      </span>
                      <button
                        type="button"
                        disabled={!row?.document_url}
                        onClick={() => {
                          if (!row?.document_url) return;
                          setPdfModal({
                            url: row.document_url,
                            title: `${MANDATE_LABELS[type].title} — resolution`,
                            approvedAt: row.board_approval_timestamp,
                          });
                        }}
                        className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-center text-[10px] font-black uppercase tracking-wide transition ${
                          row?.document_url
                            ? "brand-btn-glow"
                            : "cursor-not-allowed border-white/10 bg-white/[0.03] text-white/35 opacity-50 grayscale"
                        }`}
                      >
                        {row?.document_url ? (
                          <>
                            <EyeIcon className="text-[rgb(var(--brand-glow-rgb)/0.9)]" />
                            View Resolution
                          </>
                        ) : (
                          <>Missing Document</>
                        )}
                      </button>
                      {row ? (
                        <>
                          <label className="cursor-pointer rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-white/70 transition hover:border-[rgb(var(--brand-glow-rgb)/0.4)] hover:text-[rgb(var(--brand-glow-rgb)/0.95)]">
                            Upload PDF
                            <input
                              type="file"
                              accept="application/pdf"
                              className="hidden"
                              onChange={(e) => void onUpload(row.id, e.target.files?.[0] ?? null)}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => void onLock(row.id)}
                            className="rounded-lg border border-[rgb(var(--brand-glow-rgb)/0.4)] bg-[rgb(var(--brand-glow-rgb)/0.1)] px-3 py-2 text-[10px] font-black uppercase tracking-wide text-[rgb(var(--brand-glow-rgb)/0.95)] transition hover:bg-[rgb(var(--brand-glow-rgb)/0.2)]"
                          >
                            Lock board approval
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] text-white/35">Insert mandate row in Supabase to enable actions.</span>
                      )}
                    </div>
                  </div>
                </motion.article>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() =>
            downloadTextFile(
              `board-resolution-housing-${fiscalYear}.txt`,
              buildBoardResolutionText(tenant, {
                fiscalYear,
                assemblyDate: new Date().toLocaleDateString(undefined, { dateStyle: "long" }),
              }),
              "text/plain;charset=utf-8",
            )
          }
          className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-[rgb(var(--brand-glow-rgb)/0.4)] hover:text-[rgb(var(--brand-glow-rgb)/0.95)]"
        >
          Board resolution template
        </button>
        <button
          type="button"
          onClick={() => downloadTextFile(`gl-export-${fiscalYear}.csv`, buildGeneralLedgerCsvPlaceholder())}
          className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-[rgb(var(--brand-glow-rgb)/0.4)] hover:text-[rgb(var(--brand-glow-rgb)/0.95)]"
        >
          Download GL CSV (placeholder)
        </button>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full border border-[rgb(var(--brand-glow-rgb)/0.3)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--brand-glow-rgb)/0.95)] transition hover:bg-[rgb(var(--brand-glow-rgb)/0.08)]"
        >
          Refresh mandates
        </button>
      </div>
    </div>
  );
}
