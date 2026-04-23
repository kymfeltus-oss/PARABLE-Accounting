"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { parseQbExportCsvString } from "@/lib/migrationEngineFromRoot.js";
import {
  getExpectedHeaderList,
  type ImportKind,
  validateHeaderRow,
  fieldErrorsForMemberRow,
  fieldErrorsForJournalRow,
  fieldErrorsForVendorRow,
} from "@/lib/parableImportSchemas";

type CellError = { row: number; field: string; message: string };

type Props = {
  defaultKind?: ImportKind;
  /** Fires when user clicks Commit with zero blocking errors. */
  onCommit?: (args: { kind: ImportKind; rows: Record<string, string>[] }) => void;
};

/**
 * Import guardrails: header schema, de-dupe, in-browser grid cleanse (amber = fix before commit).
 */
export default function DataValidator({ defaultKind = "members", onCommit }: Props) {
  const [kind, setKind] = useState<ImportKind>(defaultKind);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<CellError[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const revalidate = useCallback(
    (rws: Record<string, string>[], k: ImportKind) => {
      const list: CellError[] = [];
      const se = new Set<string>();
      const stx = new Set<string>();
      const svi = new Set<string>();
      rws.forEach((row, i) => {
        const idx = i + 1;
        if (k === "members") list.push(...fieldErrorsForMemberRow(row, idx, se));
        if (k === "journal") list.push(...fieldErrorsForJournalRow(row, idx, stx));
        if (k === "vendors") list.push(...fieldErrorsForVendorRow(row, idx, svi));
      });
      setRowErrors(list);
    },
    [],
  );

  useEffect(() => {
    if (headers.length === 0) return;
    const v = validateHeaderRow(headers, kind);
    if (!v.ok) {
      setHeaderError(
        `Header schema mismatch. Missing: ${v.missing.join(", ")}. Parable template headers required.`,
      );
    } else {
      setHeaderError(null);
    }
    revalidate(rows, kind);
  }, [kind, headers, revalidate, rows]);

  const onFile = useCallback(
    async (f: File) => {
      setErr(null);
      setHeaderError(null);
      const t = await f.text();
      const tab = t.includes("\t");
      const parsed = parseQbExportCsvString(t, { delimiter: tab ? "\t" : "," });
      if (parsed.length === 0) {
        setErr("No data rows after parse.");
        setHeaders([]);
        setRows([]);
        return;
      }
      const hdrs = Object.keys(parsed[0] ?? {});
      setHeaders(hdrs);
      const v = validateHeaderRow(hdrs, kind);
      if (!v.ok) {
        setHeaderError(
          `Header schema mismatch. Missing: ${v.missing.join(", ")}. Parable template headers required.`,
        );
      } else {
        setHeaderError(null);
      }
      const clean = parsed.map((row) => {
        const o: Record<string, string> = {};
        for (const [a, b] of Object.entries(row)) {
          o[a] = b == null ? "" : String(b);
        }
        return o;
      });
      setRows(clean);
      revalidate(clean, kind);
    },
    [kind, revalidate],
  );

  const updateCell = useCallback(
    (r: number, k: string, v: string) => {
      setRows((prev) => {
        const n = prev.map((row, i) => (i === r ? { ...row, [k]: v } : row));
        revalidate(n, kind);
        return n;
      });
    },
    [kind, revalidate],
  );

  const canCommit = headerError == null && rowErrors.length === 0 && rows.length > 0;

  const onCommitClick = useCallback(() => {
    if (!canCommit) return;
    onCommit?.({ kind, rows });
  }, [canCommit, onCommit, kind, rows]);

  const gridCols = useMemo(() => {
    if (headers.length) return headers;
    return getExpectedHeaderList(kind);
  }, [headers, kind]);

  return (
    <div
      className="rounded-3xl border border-white/10 p-4 text-white"
      style={{ background: "linear-gradient(180deg, #0a0f1a, #080808)" }}
    >
      <div className="mb-4 flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3
            className="text-sm font-black uppercase tracking-[0.2em] italic"
            style={{ color: "var(--brand-cyber, #22d3ee)" }}
          >
            Import guardrails
          </h3>
          <p className="text-[9px] uppercase tracking-widest text-zinc-500">Schema · de-dupe · cleanse before commit</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="text-[9px] font-bold text-zinc-500">
            Type
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as ImportKind);
                revalidate(rows, e.target.value as ImportKind);
              }}
              className="ml-2 rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-xs text-cyan-100/90"
            >
              <option value="members">Member import</option>
              <option value="journal">Journal entry</option>
              <option value="vendors">Vendors</option>
            </select>
          </label>
          <label className="block">
            <span className="cursor-pointer rounded-full border border-cyan-500/30 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-cyan-200/80 hover:border-cyan-400/50">
              Choose CSV
            </span>
            <input
              type="file"
              accept=".csv,.txt,.tsv,text/csv"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />
          </label>
        </div>
      </div>

      {err ? <p className="mb-2 text-sm text-amber-200/90">{err}</p> : null}
      {headerError ? (
        <p
          className="mb-3 rounded-xl border border-amber-500/50 px-3 py-2 text-xs text-amber-100/95 shadow-[0_0_20px_rgba(245,158,11,0.12)]"
          role="alert"
        >
          {headerError}
        </p>
      ) : null}
      {rowErrors.length > 0 && (
        <p
          className="mb-3 text-[10px] font-medium uppercase tracking-widest"
          style={{ color: "rgb(252 211 77)", textShadow: "0 0 12px rgba(250, 204, 21, 0.25)" }}
        >
          {rowErrors.length} field issue(s) — correct below or fix source file
        </p>
      )}

      <div className="max-h-[min(50vh,420px)] overflow-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[640px] border-collapse text-left text-xs">
          <thead className="sticky top-0 z-[1] bg-zinc-950/95 text-[8px] uppercase tracking-widest text-zinc-500">
            <tr>
              <th className="border-b border-white/5 px-1 py-2 pl-2">#</th>
              {gridCols.map((c) => (
                <th key={c} className="border-b border-white/5 px-1 py-2">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={gridCols.length + 1} className="p-6 text-center text-zinc-500">
                  Drop a Parable template CSV, or add columns to match the selected import type.
                </td>
              </tr>
            ) : (
              rows.map((row, ri) => (
                <tr key={ri} className="hover:bg-white/[0.02]">
                  <td className="border-b border-white/5 px-1 py-0.5 pl-2 text-zinc-500">{ri + 1}</td>
                  {gridCols.map((col) => {
                    const e = rowErrors.find((x) => x.row === ri + 1 && x.field === col);
                    return (
                      <td
                        key={col}
                        className={`border-b border-white/5 p-0 ${e ? "bg-amber-500/[0.08] shadow-[inset_0_0_0_1px_rgba(245,158,11,0.4)]" : ""}`}
                        title={e ? e.message : undefined}
                      >
                        <input
                          value={row[col] ?? ""}
                          onChange={(ev) => updateCell(ri, col, ev.target.value)}
                          className="w-full min-w-[4rem] bg-transparent px-1.5 py-1 font-mono text-cyan-100/90 outline-none focus:bg-white/[0.04]"
                          style={
                            e
                              ? {
                                  boxShadow: "inset 0 0 0 1px rgba(250, 204, 21, 0.45), 0 0 8px rgba(250, 204, 21, 0.08)",
                                }
                              : undefined
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] text-zinc-600">Final commit would POST to your API; this UI stops at validate + cleanse.</p>
        <button
          type="button"
          disabled={!canCommit}
          onClick={onCommitClick}
          className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-cyan-200 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Commit validated data
        </button>
      </div>
    </div>
  );
}
