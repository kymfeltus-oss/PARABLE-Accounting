/**
 * Build a human-readable "Migration Report" for board / file — print to PDF from browser.
 */

import { pickAccountNameColumn } from "@/lib/migrationEngineFromRoot.js";
import { MIGRATION_STATUS } from "@/lib/migrationEngineFromRoot.js";

type Row = {
  [k: string]: unknown;
  status?: string;
  parable_code?: number | null;
  AccountName?: string;
  "Account Name"?: string;
  accountName?: string;
};

/**
 * @param rows Output of mapQuickBooksToParable
 * @param meta e.g. source file name, run id
 */
export function buildMigrationReportText(rows: Row[], meta: { sourceLabel: string; runId?: string }) {
  const run = meta.runId || new Date().toISOString();
  const lines: string[] = [
    "PARABLE — MIGRATION REPORT (SOVEREIGN LEDGER CONVERSION)",
    "========================================================",
    `Run (UTC): ${run}`,
    `Source: ${meta.sourceLabel}`,
    "",
    "The following table documents how QuickBooks (or other) account labels were matched to the Institutional UCOA.",
    "Unmatched lines are never auto-posted; they are queued for human mapping in product policy.",
    "",
  ];
  for (const r of rows) {
    const name = pickAccountNameColumn(r as any) || "(no account name column)";
    const st = (r as { status?: string }).status;
    const code = (r as { parable_code?: number | null }).parable_code;
    if (st === MIGRATION_STATUS.READY) {
      lines.push(`- Account: "${name}" → matched to PARABLE COA line ${String(code)}`);
    } else {
      lines.push(
        `- Account: "${name}" → MAPPING_REVIEW (no UCOA assignment — not guessed; see import queue)`,
      );
    }
  }
  lines.push("", "End of report. Attach source file hash + vault receipt in the Sovereign close packet.");
  return lines.join("\n");
}

/**
 * Open print dialog; user saves as PDF. Includes minimal styling.
 */
export function openMigrationReportPrintWindow(rows: Row[], meta: { sourceLabel: string }) {
  if (typeof window === "undefined") return;
  const text = buildMigrationReportText(rows, meta);
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(
    `<!DOCTYPE html><html><head><title>Parable migration report</title>
    <style>body{font-family:ui-sans-serif,system-ui;background:#0a0a0a;color:#e4e4e7;max-width:48rem;margin:2rem auto;padding:1.5rem;}
    p{margin:0.2rem 0; font-size:11pt;} h1{font-size:1rem; color:#22d3ee;}</style></head>
    <body><h1>Parable — Migration report</h1><pre style="white-space:pre-wrap;">${text.replace(/</g, "&lt;")}</pre>
    <script>window.onload=function(){window.print();}</script>
    </body></html>`,
  );
  w.document.close();
}

export function downloadMigrationReportTxt(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
