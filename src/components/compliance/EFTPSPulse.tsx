"use client";

import type { DepositorFlags, DepositStatus } from "@/lib/eftpsReconciliation";

export type EFTPSPulseProps = {
  status: DepositStatus;
  depositor: DepositorFlags;
  /** Yellow mock state when app is in simulation */
  simulation?: boolean;
};

export default function EFTPSPulse({ status, depositor, simulation = false }: EFTPSPulseProps) {
  const { isFullyPaid, remainingBalance, color, schedule } = status;
  const scheduleLabel = depositor.isSemiWeekly
    ? "Semi-weekly (4Q lookback over $50k model)"
    : "Monthly (4Q lookback at or under $50k model)";

  const mock = simulation;
  const ringColor = mock ? "#facc15" : color;
  const pingColor = mock ? "rgba(250, 204, 21, 0.45)" : color === "var(--brand-glow)" ? "var(--brand-glow)" : color;

  return (
    <div
      className={[
        "flex items-center gap-4 rounded-2xl border p-5 sm:gap-6",
        mock ? "border-amber-400/30 bg-amber-500/5" : "border-white/10 bg-white/5",
      ].join(" ")}
      data-testid="eftps-pulse"
    >
      <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center sm:h-14 sm:w-14">
        <div
          className="absolute h-10 w-10 rounded-full opacity-20 animate-ping"
          style={{ backgroundColor: pingColor }}
        />
        <div
          className="h-7 w-7 rounded-full border-2 sm:h-8 sm:w-8"
          style={{
            borderColor: ringColor,
            backgroundColor: isFullyPaid && !mock && color === "var(--brand-glow)" ? "var(--brand-glow)" : "transparent",
            boxShadow: isFullyPaid && !mock ? "0 0 24px color-mix(in srgb, var(--brand-glow) 45%, transparent)" : mock ? "0 0 20px rgba(250, 204, 21, 0.25)" : undefined,
          }}
        />
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/50">Treasury · EFTPS deposit</h3>
        {mock ? (
          <p className="text-lg font-bold italic tracking-tight text-amber-300 sm:text-xl" style={{ textShadow: "0 0 18px rgba(250, 204, 21, 0.35)" }}>
            Mock environment
          </p>
        ) : null}
        <p className={`text-lg font-bold italic tracking-tight sm:text-xl ${mock ? "text-white/90" : ""}`}>
          {isFullyPaid ? "Deposits verified" : `Pending: $${remainingBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
        </p>
        <p
          className={["mt-0.5 text-[10px] text-white/40", mock ? "text-amber-200/60" : ""].join(" ")}
          title="IRS class from modeled 4-quarter lookback; confirm with your CPA."
        >
          Schedule: {schedule} · {scheduleLabel}
        </p>
      </div>

      {!isFullyPaid || mock ? (
        <a
          href={mock ? "#" : "https://www.eftps.gov"}
          target={mock ? undefined : "_blank"}
          rel="noreferrer"
          onClick={mock ? (e) => e.preventDefault() : undefined}
          className={[
            "flex-shrink-0 rounded border px-3 py-1.5 text-[10px] font-bold uppercase tracking-tighter transition",
            mock
              ? "border-amber-500/50 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25"
              : "border-red-500/50 bg-red-500/20 text-red-400 hover:border-red-400 hover:bg-red-500 hover:text-white",
          ].join(" ")}
        >
          {mock ? "MOCK" : "EFTPS"}
        </a>
      ) : null}
    </div>
  );
}
