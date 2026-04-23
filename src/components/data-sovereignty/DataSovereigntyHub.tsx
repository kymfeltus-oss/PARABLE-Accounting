"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ImportExportHub, { type MigratedRow } from "./ImportExportHub";
import DataValidator from "./DataValidator";
import { buildMigrationReportText, openMigrationReportPrintWindow, downloadMigrationReportTxt } from "@/lib/migrationReportBuilder";
import {
  archiveLegacyFileClient,
  downloadLegacyDecryptedFile,
  listLegacyArchivesClient,
  type LegacyEntryMeta,
} from "@/lib/legacyArchiveClient";
import { getBrowserQuickBooksConnectUrlFromEnv } from "@/lib/quickBooksSyncFromRoot.js";
import {
  downloadCfoExitZipBundle,
  downloadTextFile,
  buildTrialBalanceCsvPlaceholder,
  buildIncomeStatementCsvPlaceholder,
  buildMemberCrmExportPlaceholder,
  buildCertifiedLedgerCsv,
} from "@/lib/cfoPackageExport";
/**
 * Data sovereignty: migration with documented mapping, legacy vault archive, CFO exit exports, and bulk import guardrails.
 */
export default function DataSovereigntyHub() {
  const [archives, setArchives] = useState<LegacyEntryMeta[]>([]);
  const [lastMap, setLastMap] = useState<MigratedRow[] | null>(null);
  const [lastSource, setLastSource] = useState<string>("");
  const [sealBusy, setSealBusy] = useState(false);
  const [vMsg, setVMsg] = useState<string | null>(null);

  const connectionReady = useMemo(
    () => (typeof process !== "undefined" && !!process.env.NEXT_PUBLIC_QUICKBOOKS_CLIENT_ID) || false,
    [],
  );

  const refresh = useCallback(() => {
    if (typeof indexedDB === "undefined") return;
    void listLegacyArchivesClient().then(setArchives);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onMigrationComplete = useCallback((rows: MigratedRow[], source: string) => {
    setLastMap(rows);
    setLastSource(source);
  }, []);

  const onSealLegacy = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;
      setSealBusy(true);
      setVMsg(null);
      void (async () => {
        try {
          await archiveLegacyFileClient(f);
          refresh();
          setVMsg(`Sealed in Legacy Archive: ${f.name} (documented in vault pillar).`);
        } catch (err) {
          setVMsg(err instanceof Error ? err.message : "Could not archive file");
        } finally {
          setSealBusy(false);
          e.target.value = "";
        }
      })();
    },
    [refresh],
  );

  const goConnect = () => {
    if (typeof window === "undefined") return;
    const w = {
      QUICKBOOKS_CLIENT_ID: process.env.NEXT_PUBLIC_QUICKBOOKS_CLIENT_ID || "",
      QUICKBOOKS_REDIRECT_URI: process.env.NEXT_PUBLIC_QUICKBOOKS_REDIRECT_URI || `${window.location.origin}/import-export`,
    };
    const r = getBrowserQuickBooksConnectUrlFromEnv(w);
    if (!r.url) {
      const el = document.getElementById("qbo-workspace");
      el?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    window.open(r.url, "qbo_oauth", "width=600,height=720,noopener");
  };

  return (
    <div className="space-y-10 p-2 sm:p-0">
      <div
        className="overflow-hidden rounded-[40px] border border-white/10 p-6 text-white sm:p-10"
        style={{ background: "linear-gradient(180deg, #0a0f1a, #040404)" }}
      >
        <div className="mb-8 flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center">
          <h2
            className="text-2xl font-black uppercase italic leading-tight tracking-tighter sm:text-3xl"
            style={{ color: "var(--brand-cyber, #22d3ee)" }}
          >
            Data sovereignty hub
          </h2>
          <div
            className={`w-fit rounded-full px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest ${
              connectionReady
                ? "bg-cyan-400 text-black shadow-[0_0_20px_rgba(34,211,238,0.35)]"
                : "bg-white/10 text-zinc-300"
            } ${connectionReady ? "animate-pulse" : ""}`}
          >
            {connectionReady ? "Connection ready" : "File upload + manual connection"}
          </div>
        </div>
        <p className="mb-6 max-w-2xl text-xs leading-relaxed text-zinc-400/95">
          We do not just move your data — we document the move. Each QuickBooks (or other) import produces a
          <span className="text-cyan-200/80"> migration report </span> for your board, and a sealed copy in the
          <span className="text-violet-300/90"> legacy archive</span> pillar. Returning users can run massive CSV updates
          with guardrails; CFO exit packs bundle ledger, people, and vault in one pass.
        </p>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-[30px] border border-white/5 bg-white/[0.04] p-6 transition-all hover:border-cyan-500/30">
            <h3 className="mb-2 text-lg font-bold uppercase tracking-tight">QuickBooks migration</h3>
            <p className="mb-4 text-xs leading-relaxed text-zinc-500">
              API or file upload, institutional UCOA map, and a printable migration report: e.g. “Account: Utilities →
              6010”.
            </p>
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={goConnect}
                className="w-full rounded-2xl bg-white py-3.5 text-center text-xs font-black uppercase tracking-widest text-black transition hover:bg-cyan-400 sm:w-auto sm:px-5"
              >
                Connect QuickBooks
              </button>
              <button
                type="button"
                onClick={() => document.getElementById("qbo-workspace")?.scrollIntoView({ behavior: "smooth" })}
                className="w-full rounded-2xl border border-white/15 py-2.5 text-center text-[9px] font-bold uppercase tracking-widest text-zinc-200 hover:border-cyan-400/40"
              >
                File import
              </button>
            </div>
            {lastMap && lastMap.length > 0 && (
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    if (!lastMap) return;
                    openMigrationReportPrintWindow(/** @type {any} */(lastMap), { sourceLabel: lastSource || "import" });
                  }}
                  className="rounded-lg border border-cyan-500/30 px-2 py-1.5 text-[8px] font-bold uppercase text-cyan-200/80"
                >
                  Migration report (PDF)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!lastMap) return;
                    const t = buildMigrationReportText(/** @type {any} */(lastMap), { sourceLabel: lastSource || "import" });
                    downloadMigrationReportTxt("parable-migration-report.txt", t);
                  }}
                  className="rounded-lg border border-white/20 px-2 py-1.5 text-[8px] font-bold uppercase text-zinc-300/90"
                >
                  Download .txt
                </button>
              </div>
            )}
          </div>

          <div className="rounded-[30px] border border-violet-500/15 bg-violet-950/10 p-6">
            <h3 className="mb-2 text-lg font-bold uppercase tracking-tight text-violet-300/95">Legacy archive (sovereign vault)</h3>
            <p className="mb-4 text-xs leading-relaxed text-zinc-500">
              Sealed, encrypted at rest in this browser (IndexedDB). In production, route to the Sovereign Vault with KMS
              and immutable log row.
            </p>
            <label className="mb-2 block text-[9px] font-bold uppercase tracking-widest text-violet-200/60">Seal .xlsx, .qbo, or source CSV</label>
            <input type="file" onChange={onSealLegacy} disabled={sealBusy} className="w-full text-[10px] file:mr-2 file:rounded file:border-0 file:bg-violet-500/20 file:px-2 file:py-1" />
            {vMsg ? <p className="mt-2 text-[10px] text-violet-200/80">{vMsg}</p> : null}
            <ul className="mt-4 space-y-0 border-t border-white/5 pt-3">
              {archives.length === 0 && <li className="text-[9px] uppercase text-zinc-600">No sealed files yet</li>}
              {archives.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between border-b border-white/5 py-2 text-[9px] uppercase text-zinc-300/80"
                >
                  <span className="max-w-[55%] truncate" title={a.filename}>
                    {a.filename}
                  </span>
                  <button
                    type="button"
                    onClick={() => void downloadLegacyDecryptedFile(a.id, a.filename)}
                    className="shrink-0 cursor-pointer text-cyan-400/90 hover:underline"
                  >
                    Download
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[8px] text-zinc-600">Map log PDF/txt appears after a migration run; download from the first pillar.</p>
          </div>
        </div>
      </div>

      <div
        className="rounded-3xl border border-white/10 p-4 sm:p-5"
        style={{ background: "linear-gradient(180deg, #080a10, #040404)" }}
      >
        <h3
          className="mb-2 text-sm font-black uppercase tracking-[0.2em] italic"
          style={{ color: "var(--brand-cyber, #22d3ee)" }}
        >
          CFO exit — full universe export
        </h3>
        <p className="mb-3 text-xs text-zinc-500">Ledger, trial balance, P&amp;L, people + giving, audit ZIP (vault index placeholder).</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadTextFile("trial-balance.csv", buildTrialBalanceCsvPlaceholder())}
            className="border border-white/20 px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-widest text-zinc-200"
          >
            Trial balance
          </button>
          <button
            type="button"
            onClick={() => downloadTextFile("income-statement.csv", buildIncomeStatementCsvPlaceholder())}
            className="border border-white/20 px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-widest text-zinc-200"
          >
            Income statement
          </button>
          <button
            type="button"
            onClick={() => downloadTextFile("certified-ledger.csv", buildCertifiedLedgerCsv())}
            className="border border-white/20 px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-widest text-zinc-200"
          >
            Ledger
          </button>
          <button
            type="button"
            onClick={() => downloadTextFile("members-crm.csv", buildMemberCrmExportPlaceholder())}
            className="border border-white/20 px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-widest text-zinc-200"
          >
            Member CRM
          </button>
          <button
            type="button"
            onClick={() => void downloadCfoExitZipBundle()}
            className="border border-cyan-400/50 bg-cyan-500/10 px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-widest text-cyan-200"
          >
            Audit package ZIP
          </button>
        </div>
      </div>

      <DataValidator
        onCommit={({ kind, rows }) => {
          // Replace with real API POST; client-only demo:
          if (typeof window !== "undefined") {
            // eslint-disable-next-line no-alert -- intentional product demo
            window.alert(
              `Validated ${rows.length} row(s) for kind "${kind}" — next step: POST to your ledger/CRM endpoint.`,
            );
          }
        }}
      />

      <div className="pt-2">
        <h3 className="mb-1 text-center text-[9px] font-bold uppercase tracking-[0.35em] text-zinc-500">Import / sync workspace</h3>
        <ImportExportHub onMigrationComplete={onMigrationComplete} />
      </div>
    </div>
  );
}
