"use client";

import { useCallback, useMemo, useState } from "react";
import { buildCertifiedLedgerCsv, downloadTextFile } from "@/lib/exportLedgerCsv";
import { getParableBulkTemplateCsv, parseQbExportCsvString, MIGRATION_STATUS, pickAccountNameColumn } from "@/lib/migrationEngineFromRoot.js";
import {
  buildPostImportDiscrepancyReport,
  fetchQbChartOfAccounts,
  fetchQbJournalEntriesLast12Months,
  getQboBaseApiUrl,
  runSovereignMigrationInProgress,
  getBrowserQuickBooksConnectUrlFromEnv,
} from "@/lib/quickBooksSyncFromRoot.js";

export type MigratedRow = Record<string, unknown> & {
  parable_code: number | null;
  status: string;
  mapping_note?: string;
};

type ImportExportHubProps = {
  /** Fires when a file import or QBO demo mapping finishes, for migration report / audit log. */
  onMigrationComplete?: (rows: MigratedRow[], sourceLabel: string) => void;
  sectionId?: string;
};

export default function ImportExportHub({ onMigrationComplete, sectionId = "qbo-workspace" }: ImportExportHubProps) {
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [migrated, setMigrated] = useState<MigratedRow[] | null>(null);
  const [reviewOnly, setReviewOnly] = useState<MigratedRow[]>([]);
  const [readyCount, setReadyCount] = useState(0);
  const [discrepancies, setDiscrepancies] = useState<Record<string, unknown>[] | null>(null);

  const onDropFile = useCallback(
    async (file: File) => {
      setErr(null);
      setMigrated(null);
      setReviewOnly([]);
      setDiscrepancies(null);
      const isCsv = /\.(csv|txt|tsv)$/i.test(file.name) || file.type === "text/csv";
      const isXlsx = /\.xlsx$/i.test(file.name);
      if (isXlsx) {
        setErr("Excel detected — for now export from QuickBooks as .csv, then re-drop. (XLSX parser is not bundled yet.)");
        return;
      }
      if (!isCsv) {
        setErr("Use a .csv or .txt (tab) export, or a Parable template.");
        return;
      }
      const text = await file.text();
      const tab = file.name.toLowerCase().endsWith(".tsv") || text.includes("\t");
      const rows = parseQbExportCsvString(text, { delimiter: tab ? "\t" : "," });
      if (rows.length === 0) {
        setErr("No rows to parse — check headers and delimiter.");
        return;
      }
      setProgress(0);
      const res = await runSovereignMigrationInProgress({
        qbRowBatch: rows,
        onProgress: (n, label) => {
          setProgress(n);
          if (label) setProgressLabel(label);
        },
        options: {},
      });
      setMigrated((res.mapped as MigratedRow[]) || []);
      setReadyCount(res.readyCount);
      setReviewOnly(
        (res.mapped as MigratedRow[]).filter((r) => r.status === MIGRATION_STATUS.MAPPING_REVIEW),
      );

      // Demo: mock QB / PARABLE balances to populate discrepancy list (replace with post-import fund totals)
      const demoQb: Record<string, number> = {};
      const demoP: Record<string, number> = {};
      for (const r of res.mapped) {
        const n = pickAccountNameColumn(/** @type {Record<string, unknown>} */(r) as never);
        if (r.status === MIGRATION_STATUS.READY && r.parable_code != null && n) {
          const amt = Math.random() * 0.1;
          demoQb[n] = (demoQb[n] ?? 0) + 1000 + amt;
          demoP[String(/** @type {number} */(r).parable_code)] =
            (demoP[String(/** @type {number} */(r).parable_code)] ?? 0) + 1000.01;
        }
      }
      if (Object.keys(demoQb).length) {
        setDiscrepancies(
          buildPostImportDiscrepancyReport({
            qbBalanceByAccountName: demoQb,
            parableBalanceByCode: demoP,
            mappedRows: res.mapped as MigratedRow[],
          }),
        );
      }
      onMigrationComplete?.(res.mapped as MigratedRow[], file.name);
    },
    [onMigrationComplete],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDrag(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) void onDropFile(f);
  };

  const connectQb = () => {
    if (typeof window === "undefined") return;
    const w = {
      QUICKBOOKS_CLIENT_ID: process.env.NEXT_PUBLIC_QUICKBOOKS_CLIENT_ID || "",
      QUICKBOOKS_REDIRECT_URI: process.env.NEXT_PUBLIC_QUICKBOOKS_REDIRECT_URI || `${window.location.origin}/import-export`,
    };
    const r = getBrowserQuickBooksConnectUrlFromEnv(/** @type {Record<string, string>} */(w));
    if (r.error || !r.url) {
      setErr(
        (r as { error?: string }).error ??
          "Set NEXT_PUBLIC_QUICKBOOKS_CLIENT_ID and (optional) NEXT_PUBLIC_QUICKBOOKS_REDIRECT_URI, then add this origin in the Intuit app as a redirect.",
      );
      return;
    }
    window.open(r.url, "qbo_oauth", "width=600,height=720,noopener");
  };

  const runDemoQbApi = useCallback(async () => {
    setErr(null);
    setProgress(0.05);
    setProgressLabel("Sovereign Migration in Progress (demo)…");
    const base = getQboBaseApiUrl({ useSandbox: true });
    const { accounts } = await fetchQbChartOfAccounts(base, "DEMO", "");
    setProgress(0.25);
    await fetchQbJournalEntriesLast12Months(base, "DEMO", "");
    setProgress(0.4);
    const asRows = accounts.map((a) => ({ "Account Name": a.name, AccountName: a.name, Balance: a.currentBalance ?? 0 }));
    const res = await runSovereignMigrationInProgress({
      qbRowBatch: asRows,
      onProgress: (n, l) => {
        setProgress(n);
        if (l) setProgressLabel(l);
      },
    });
    setMigrated((res.mapped as MigratedRow[]) || []);
    setReadyCount(res.readyCount);
    setReviewOnly(
      (res.mapped as MigratedRow[]).filter((r) => r.status === MIGRATION_STATUS.MAPPING_REVIEW),
    );
    if (asRows.length) {
      const nameBal = asRows.reduce(
        (m, a) => {
          const n = pickAccountNameColumn(/** @type {Record<string, unknown>} */(a) as never) || a["Account Name"] || a.AccountName;
          if (n) m[String(n)] = (m[String(n)] ?? 0) + 1;
          return m;
        },
        {} as Record<string, number>,
      );
      setDiscrepancies(
        buildPostImportDiscrepancyReport({
          qbBalanceByAccountName: nameBal,
          parableBalanceByCode: { "9999": 0 },
          mappedRows: res.mapped as MigratedRow[],
        }),
      );
    }
    setProgress(1);
    onMigrationComplete?.(res.mapped as MigratedRow[], "QuickBooks API (demo chart)");
  }, [onMigrationComplete]);

  const auditPdfHint = useMemo(
    () => "Board packet PDF: merge certified CSV + your vault exports in a future release, or use Print → Save as PDF from review tables.",
    [],
  );

  return (
    <div
      id={sectionId}
      className="rounded-[40px] border border-white/10 bg-[#050505] p-6 text-white sm:p-10"
      style={{ background: "linear-gradient(180deg, #0a0f1a, #040404)" }}
    >
      <div className="mb-8 flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end">
        <div>
          <h2
            className="text-2xl font-black uppercase italic tracking-tighter sm:text-3xl"
            style={{ color: "var(--brand-cyber, #22d3ee)" }}
          >
            Data sovereignty hub
          </h2>
          <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.4em] text-cyan-400/90">Migrate // backup // restore</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={connectQb}
            className="rounded-full border border-amber-400/40 bg-amber-500/5 px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-amber-200/90 hover:border-amber-300/60"
          >
            Connect to QuickBooks
          </button>
          <button
            type="button"
            onClick={() => void runDemoQbApi()}
            className="rounded-full border border-white/20 px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-zinc-300/90 hover:border-cyan-400/40"
          >
            Run demo QBO + map
          </button>
        </div>
      </div>

      {err ? <p className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{err}</p> : null}

      {progress > 0 && (
        <div
          className="mb-8 space-y-2"
          style={{ boxShadow: "0 0 32px color-mix(in srgb, #22d3ee 0.12, transparent)" }}
        >
          <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-cyan-400/80">Sovereign migration in progress</p>
          <div className="h-2.5 w-full overflow-hidden rounded-full border border-cyan-400/20 bg-white/5">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.round(progress * 100)}%`,
                background: "linear-gradient(90deg, #0e2133, #22d3ee)",
                boxShadow: "0 0 20px color-mix(in srgb, #22d3ee 0.45, transparent)",
              }}
            />
          </div>
          {progressLabel ? <p className="text-center text-[10px] text-cyan-200/70">{progressLabel}</p> : null}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <label
          htmlFor="file-sovereign-import"
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          className={[
            "group block cursor-pointer rounded-[30px] border-2 border-dashed p-8 text-center transition sm:p-10",
            drag
              ? "border-cyan-400/80 bg-cyan-500/5"
              : "border-white/10 bg-white/[0.02] hover:border-cyan-400/50 hover:bg-cyan-500/[0.03]",
          ].join(" ")}
        >
          <input
            id="file-sovereign-import"
            type="file"
            className="sr-only"
            accept=".csv,.txt,.tsv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onDropFile(f);
            }}
          />
          <div
            className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-b from-cyan-500/10 to-transparent"
            aria-hidden
          >
            <svg className="h-8 w-8 text-cyan-400/90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M4 16v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1M12 4v9m-4-4l4-4 4 4" strokeLinecap="round" />
            </svg>
          </div>
          <h3 className="text-lg font-bold uppercase tracking-tight">Smart import</h3>
          <p className="mb-4 mt-1 text-[9px] uppercase tracking-widest text-zinc-500">Seamless migration · translation map</p>
          <p className="px-2 text-xs leading-relaxed text-zinc-400/90 sm:px-6">
            Drop QuickBooks, Xero, or a Parable CSV. Account names are mapped to institutional UCOA; unmapped items go to the
            mapping review queue.
          </p>
          <span
            className="mt-5 inline-block rounded-full bg-white px-8 py-2.5 text-[10px] font-black uppercase tracking-widest text-black transition group-hover:shadow-[0_0_24px_rgba(34,211,238,0.2)]"
            role="presentation"
          >
            Select file
          </span>
        </label>

        <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-8 text-center sm:p-10">
          <div
            className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10"
            aria-hidden
          >
            <svg className="h-8 w-8 text-cyan-300/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M4 4h16v4H4V4Z" />
              <path d="M4 9h6v6H4V9Z" />
              <path d="M4 16h6v4H4v-4Z" />
              <path d="M11 9h9M11 12h5M11 16h5" />
            </svg>
          </div>
          <h3 className="text-lg font-bold uppercase tracking-tight">Institutional export</h3>
          <p className="mb-2 mt-1 text-xs text-zinc-500">Parable template, certified ledger, audit bundle</p>
          <p className="mb-6 text-xs leading-relaxed text-zinc-500/90">
            One-click data sovereignty: take members, vendors, and journals with you, or hand a clean packet to your board.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => downloadTextFile("parable-bulk-journal-template.csv", getParableBulkTemplateCsv({ kind: "transactions" }))}
              className="border border-white/20 px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-zinc-200 hover:border-cyan-400/40"
            >
              Parable template
            </button>
            <button
              type="button"
              onClick={() => downloadTextFile("parable-bulk-vendors.csv", getParableBulkTemplateCsv({ kind: "vendors" }))}
              className="border border-white/20 px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-zinc-200 hover:border-cyan-400/40"
            >
              Vendors
            </button>
            <button
              type="button"
              onClick={() => downloadTextFile("certified-ledger-audit.csv", buildCertifiedLedgerCsv())}
              className="border border-white/20 px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-zinc-200 hover:border-cyan-400/40"
            >
              CSV audit
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window === "undefined") return;
                window.print();
              }}
              className="border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-cyan-200"
              title={auditPdfHint}
            >
              Print / save PDF
            </button>
          </div>
          <p className="mt-3 text-[9px] text-zinc-600">{auditPdfHint}</p>
        </div>
      </div>

      {migrated && migrated.length > 0 && (
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-center text-xs text-zinc-500">
            Mapped <span className="text-emerald-200/80">{readyCount} ready</span>
            {reviewOnly.length > 0 ? (
              <span>
                {" "}
                — <span className="text-amber-200/80">{reviewOnly.length} in mapping review</span>
              </span>
            ) : null}
          </p>
        </div>
      )}

      {reviewOnly.length > 0 && (
        <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-500/5 p-4">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-200/80">Mapping review</h4>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-amber-100/80">
            {reviewOnly.map((r, i) => {
              const name = pickAccountNameColumn(/** @type {Record<string, unknown>} */(r) as never) || "—";
              return (
                <li
                  key={`${name}-${i}`}
                  className="flex flex-wrap items-baseline justify-between gap-1 border-b border-amber-400/10 py-1"
                >
                  <span className="text-zinc-200">{name}</span>
                  <span className="text-[9px] text-amber-200/60">needs human map — not guessed</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {discrepancies && discrepancies.length > 0 && (
        <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.04] p-4">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-200/80">Discrepancy report (post-import)</h4>
          <p className="mt-1 text-[9px] text-cyan-200/50">Comparing QB name balances vs PARABLE fund/COA lines. Demo uses sample totals.</p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-[10px] text-cyan-100/70">
            {discrepancies.map((d) => (
              <li key={String((d as { key: string }).key)} className="font-mono">
                {(d as { accountName?: string }).accountName || (d as { key: string }).key} — {String((d as { note?: string }).note ?? (d as { delta?: string }).delta)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
