"use client";

import { Activity } from "lucide-react";
import { useMemo } from "react";
import type { LiveLedgerFeedRow } from "@/types/accounting";

type Props = {
  items: LiveLedgerFeedRow[];
  className?: string;
};

function formatMoney(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function line(r: LiveLedgerFeedRow) {
  return `${formatTime(r.created_at)}  ${r.account_code}  ${r.account_name ?? "—"}  Dr ${formatMoney(
    Number(r.debit),
  )}  Cr ${formatMoney(Number(r.credit))}  ${r.narrative != null && String(r.narrative) ? String(r.narrative) : "—"}`;
}

function cx(...parts: (string | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/**
 * High-density view for `view_live_ledger_feed`: marquees plus a scannable line list. Pass rows from a server parent.
 */
export default function LiveLedgerFeed({ items, className }: Props) {
  const { ticker, dense } = useMemo(() => {
    if (!items.length) {
      return { ticker: "", dense: [] as typeof items };
    }
    const t = items
      .map((r) => line(r))
      .join("   ·   ");
    return { ticker: t, dense: items.slice(0, 32) };
  }, [items]);

  if (!items.length) {
    return (
      <div
        className={cx(
          "overflow-hidden rounded-xl border border-slate-800/90 bg-slate-950/95",
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2.5">
          <div className="flex items-center gap-2.5 text-cyan-400">
            <span className="relative flex h-4 w-4 text-cyan-400">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400/30" />
              <Activity className="relative h-4 w-4" strokeWidth={2.2} />
            </span>
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-400/90">Live stream</span>
          </div>
        </div>
        <p className="p-4 font-mono text-xs text-slate-500">No general ledger lines in the current view.</p>
      </div>
    );
  }

  return (
    <div
      className={cx("overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/95", className)}
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative flex h-5 w-5 shrink-0 text-cyan-400">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-md bg-cyan-400/35" />
            <Activity className="relative h-5 w-5" strokeWidth={2.2} />
          </span>
          <div>
            <p className="font-mono text-[9px] font-bold uppercase leading-none tracking-[0.22em] text-cyan-400">
              Live stream
            </p>
          </div>
        </div>
        <div className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-cyan-400/80">LIVE</div>
      </div>

      <div className="space-y-0 border-b border-slate-800/60 bg-slate-950/80">
        <div className="relative h-9 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_5%,black_95%,transparent)]">
          <div className="flex h-full items-center">
            <div className="ledger-ticker-anim gap-16 pl-1 text-[10px] font-mono leading-none tracking-tight text-slate-200/90 sm:text-[11px]">
              <span className="inline-block whitespace-nowrap pl-0.5">{ticker}</span>
              <span className="inline-block whitespace-nowrap pl-0.5" aria-hidden>
                {ticker}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-h-[14rem] overflow-y-auto">
        {dense.map((r) => (
          <div
            key={r.id}
            className="grid grid-cols-[auto_1fr_auto] gap-2 border-b border-slate-800/50 px-3 py-1.5 font-mono text-[9px] leading-tight text-slate-300/90 hover:bg-cyan-400/[0.04] sm:px-4 sm:text-[10px]"
          >
            <time className="w-[76px] shrink-0 text-slate-500" dateTime={r.created_at}>
              {formatTime(r.created_at)}
            </time>
            <div className="min-w-0">
              <span className="font-bold text-cyan-400">{r.account_code}</span>
              <span className="ml-1 text-slate-200/80">{r.account_name ?? "—"}</span>
            </div>
            <div className="w-[8.5rem] shrink-0 text-right text-[9px] sm:text-[10px] text-slate-500">
              D {formatMoney(Number(r.debit))} <span className="text-slate-600">/</span> C {formatMoney(Number(r.credit))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
