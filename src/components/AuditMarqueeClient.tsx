"use client";

import type { AccountingAlertRow } from "@/types/accounting";

type Props = {
  alerts: AccountingAlertRow[];
};

/**
 * Horizontal marquee for high-severity accounting alerts.
 */
export default function AuditMarqueeClient({ alerts }: Props) {
  if (alerts.length === 0) return null;
  const doubled = [...alerts, ...alerts];

  return (
    <div
      className="relative overflow-hidden border-b border-red-500/30 bg-gradient-to-b from-red-950/50 to-slate-950/80"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-16 bg-gradient-to-r from-slate-950 to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-16 bg-gradient-to-l from-slate-950 to-transparent" />
      <div className="mx-auto max-w-7xl py-2">
        <p className="mb-1.5 text-center text-[9px] font-bold uppercase tracking-[0.3em] text-red-300/80">
          Abnormal balance — action required
        </p>
        <div className="flex w-full overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_5%,black_95%,transparent)]">
          <div className="accounting-audit-marquee flex min-w-0 flex-none gap-12">
            {doubled.map((alert, i) => (
              <div
                key={`${String(alert.account_code)}-${i}`}
                className="inline-flex max-w-md shrink-0 items-start gap-2 text-left"
              >
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-red-500" aria-hidden />
                <span className="text-sm text-red-100/90">
                  <span className="font-mono font-bold text-red-200">{String(alert.account_code)}</span>{" "}
                  <span className="text-white/90">{alert.account_name}</span>
                  <span className="text-red-200/80"> — {String(alert.health_status)}</span>
                  {alert.normal_balance ? (
                    <span className="text-red-200/50">
                      {" "}
                      (expected {String(alert.normal_balance).toUpperCase()})
                    </span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
