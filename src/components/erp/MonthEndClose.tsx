"use client";

import type { MonthEndCloseStatus } from "@/lib/monthEndCloseStatus";

type Props = {
  status: MonthEndCloseStatus | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  /** Fired when seal is allowed and user confirms (no-op by default) */
  onConfirmSeal?: () => void;
};

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </svg>
  );
}

/**
 * Month-end close seal — blocked when AP has unpaid bills or AR has open balances.
 * Paired with `ErpHub` and `loadSubledgerForMonthEnd`.
 */
export default function MonthEndClose({ status, loading, error, onRefresh, onConfirmSeal }: Props) {
  const can = status?.canSeal === true;
  const sealDisabled = !status || !can || loading;

  return (
    <section className="rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-[#080808] p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">Month-end close</h2>
          <p className="mt-1 text-sm text-white/55">The seal is withheld until payables and receivables are reconciled.</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="self-start text-[10px] font-bold uppercase tracking-wider text-[var(--brand-cyber)] hover:underline"
        >
          Refresh
        </button>
      </div>

      {error ? <p className="mt-4 text-sm text-amber-200/90">{error}</p> : null}
      {loading && !status ? <p className="mt-4 text-sm text-white/45">Loading sub-ledgers…</p> : null}

      {status && !can ? (
        <ul className="mt-4 space-y-1 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100/95">
          {status.unpaidBills > 0 ? (
            <li>
              <strong className="text-amber-50">Unpaid bills</strong> — {status.unpaidBills} open in Accounts Payable (not marked paid).
            </li>
          ) : null}
          {status.openPledges > 0 ? (
            <li>
              <strong className="text-amber-50">Unreconciled pledges / receivables</strong> — {status.openPledges} with balance; $
              {status.openArBalance.toLocaleString()} remaining.
            </li>
          ) : null}
        </ul>
      ) : null}

      {status && can ? (
        <p className="mt-4 rounded-xl border border-[color:rgb(var(--brand-glow-rgb)/0.25)] bg-[color:rgb(var(--brand-glow-rgb)/0.08)] p-3 text-sm text-white/80">
          No open AP and no open AR — you may post the month-end seal to your board pack (bookkeeper attestation in your process).
        </p>
      ) : null}

      <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div
          className={[
            "flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full border-2 p-2 text-center",
            can ? "border-[var(--brand-glow)] text-[var(--brand-glow)]" : "border-white/20 text-white/30",
          ].join(" ")}
          style={can ? { boxShadow: "0 0 32px color-mix(in srgb, var(--brand-glow) 30%, transparent)" } : undefined}
        >
          <div className="text-[8px] font-bold uppercase leading-tight tracking-wider">Month end</div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-white/50">Fiscal month seal</p>
          <p className="mt-1 text-sm text-white/70">Placeholder — wire to your approval / GL period lock when available.</p>
        </div>
        <button
          type="button"
          disabled={sealDisabled}
          onClick={() => {
            if (can) onConfirmSeal?.();
          }}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-xs font-black uppercase tracking-widest text-white/90 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ShieldIcon className="h-4 w-4" />
          Apply month-end seal
        </button>
      </div>
    </section>
  );
}
