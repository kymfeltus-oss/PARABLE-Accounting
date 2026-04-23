/**
 * PARABLE Ledger — Sovereignty & compliance dashboard (cinematic / glass UI).
 */

"use client";

import { useBrand } from "@/components/branding/BrandProvider";

export type SovereigntyDashboardProps = {
  /** Mission-exempt lane (tithes, documented gifts, program-aligned streaming support) */
  exemptRevenue: number;
  /** UBI-class lane (ads, sponsorships, pay-to-play, etc.) — 990-T prep */
  ubiRevenue: number;
  /** When true, strips full-bleed shell so the card nests inside MinistryAppShell */
  embedded?: boolean;
};

export default function SovereigntyDashboard({
  exemptRevenue,
  ubiRevenue,
  embedded = false,
}: SovereigntyDashboardProps) {
  const { tenant } = useBrand();
  const displayName = tenant?.display_name ?? "PARABLE";

  const total = exemptRevenue + ubiRevenue;
  const ubiPercentage = total > 0 ? (ubiRevenue / total) * 100 : 0;
  const exemptScore = total > 0 ? 100 - ubiPercentage : 100;
  const thresholdReached = ubiRevenue >= 1000;

  const outer = embedded
    ? "text-white"
    : "min-h-screen bg-[var(--brand-surface)] p-6 text-white sm:p-8 md:p-10";

  return (
    <div className={`font-sans antialiased ${outer}`}>
      <div className={embedded ? "" : "brand-border-glow mb-10 border-l-4 pl-5 md:mb-12 md:pl-6"}>
        {!embedded ? (
          <>
            <h1 className="text-3xl font-bold uppercase tracking-tighter text-white md:text-4xl">
              {`${displayName} // Ledger`}
            </h1>
            <p className="brand-text-glow-muted mt-1 text-xs font-medium uppercase tracking-[0.35em] md:text-sm">
              Sovereignty & compliance engine
            </p>
          </>
        ) : null}

        <div className={`grid grid-cols-1 gap-6 md:gap-8 ${embedded ? "" : "mt-10"} lg:grid-cols-2`}>
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl md:p-8">
            <div className="absolute right-0 top-0 p-4">
              <div
                className={`h-3 w-3 rounded-full animate-pulse ${
                  thresholdReached ? "bg-red-500 shadow-[0_0_12px_#ef4444]" : "bg-[rgb(var(--brand-glow-rgb))]"
                }`}
                style={
                  thresholdReached ? undefined : { boxShadow: "0 0 12px rgb(var(--brand-glow-rgb) / 0.85)" }
                }
                title={thresholdReached ? "UBI-class gross at or above common $1k review band" : "Below common $1k indicator"}
              />
            </div>

            <h2 className="mb-5 text-lg font-medium text-white/85 md:mb-6 md:text-xl">Sovereignty score</h2>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black italic tracking-tight text-white md:text-6xl">
                {exemptScore.toFixed(1)}%
              </span>
              <span className="brand-text-glow text-xs font-bold uppercase tracking-widest md:text-sm">Exempt</span>
            </div>

            <div className="mt-8 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-gradient-to-r from-blue-600 via-[rgb(var(--brand-glow-rgb))] to-[rgb(var(--brand-glow-rgb)/0.65)] shadow-[0_0_20px_rgb(var(--brand-glow-rgb)/0.35)] transition-[width] duration-1000 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, exemptScore))}%` }}
              />
            </div>
            <p className="mt-4 text-[10px] uppercase tracking-tight text-white/45 md:text-xs">
              System status:{" "}
              {thresholdReached ? "Review 990-T threshold (typically $1k gross UBI-class)" : "Audit-ready / under common threshold"}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl md:p-8">
            <h2 className="mb-5 text-lg font-medium text-white/85 md:mb-6 md:text-xl">Transaction flow</h2>
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <span className="text-xs uppercase tracking-widest text-white/55 md:text-sm">Streaming gifts</span>
                <span className="font-mono text-xl tabular-nums text-white md:text-2xl">
                  ${exemptRevenue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <span className="text-xs uppercase tracking-widest text-red-400/90 md:text-sm">Taxable commerce (UBI)</span>
                <span className="font-mono text-xl tabular-nums text-red-400 md:text-2xl">
                  ${ubiRevenue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
