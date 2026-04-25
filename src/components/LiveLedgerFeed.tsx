"use client";

import { useMemo } from "react";
import type { LiveLedgerFeedRow } from "@/types/accounting";

type Props = {
  items: LiveLedgerFeedRow[];
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

/**
 * Scrolling real-time style ticker for `view_live_ledger_feed` (slate header, cyan live pulse).
 */
export default function LiveLedgerFeed({ items }: Props) {
  const longLine = useMemo(() => {
    if (!items.length) return "";
    return items
      .map(
        (r) =>
          `${formatTime(r.created_at)}  ${r.account_code}  ${r.account_name ? r.account_name : "—"}  Dr ${formatMoney(
            Number(r.debit),
          )} / Cr ${formatMoney(Number(r.credit))}  ${r.narrative ? String(r.narrative) : ""}`.trim(),
      )
      .join("   ·   ");
  }, [items]);

  if (!items.length) {
    return (
      <div className="mb-6 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/90 shadow-inner">
        <div className="border-b border-slate-800 bg-slate-900 px-4 py-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">Live ledger feed</span>
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-500/20" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-500" />
            </span>
          </div>
        </div>
        <p className="px-4 py-4 text-sm text-slate-500">No general ledger lines for this organization in the current window.</p>
      </div>
    );
  }

  return (
    <div className="mb-6 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/90 shadow-lg shadow-black/40">
      <div className="border-b border-slate-800 bg-slate-900 px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">Live ledger feed</span>
            <p className="text-[9px] text-slate-600">general_ledger with chart of accounts (account_code)</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-cyan-500/90">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
            </span>
            Live
          </div>
        </div>
      </div>
      <div className="relative h-10 overflow-hidden bg-slate-950/80 [mask-image:linear-gradient(90deg,transparent,black_4%,black_96%,transparent)]">
        <div className="flex h-full items-center">
          <div className="ledger-ticker-anim gap-20 px-1 text-sm text-slate-200/90">
            <span className="inline-block whitespace-nowrap pl-1 text-xs tracking-tight sm:text-sm">{longLine}</span>
            <span className="inline-block whitespace-nowrap pl-1 text-xs tracking-tight sm:text-sm" aria-hidden>
              {longLine}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
