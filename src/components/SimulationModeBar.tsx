"use client";

import { useCallback } from "react";

export type SimulationModeBarProps = {
  isSimulation: boolean;
  onToggle: (nextSim: boolean) => void | Promise<void>;
  busy?: boolean;
  note?: string | null;
  className?: string;
};

/**
 * Live vs simulation segmented control (dumb; parent owns I/O and seeding).
 * Label: LIVE // SIMULATION (terminal aesthetic).
 */
export default function SimulationModeBar({
  isSimulation,
  onToggle,
  busy = false,
  note = null,
  className = "",
}: SimulationModeBarProps) {
  const onChoose = useCallback(
    (nextSim: boolean) => {
      if (busy) return;
      void onToggle(nextSim);
    },
    [busy, onToggle],
  );

  return (
    <div className={className}>
      <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">Live // simulation</p>
      <div className="inline-flex w-full max-w-full rounded-xl border border-[color:rgb(var(--brand-cyber-rgb)/0.35)] bg-black/30 p-0.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => onChoose(false)}
          className={[
            "flex-1 cursor-pointer rounded-lg py-1.5 text-center text-[10px] font-black uppercase tracking-widest transition",
            !isSimulation
              ? "text-black shadow-[0_0_18px_color-mix(in_srgb,var(--brand-cyber)_30%,transparent)]"
              : "text-white/45 hover:text-white/70",
          ].join(" ")}
          style={!isSimulation ? { background: "var(--brand-cyber)" } : { background: "transparent" }}
        >
          Live
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onChoose(true)}
          className={[
            "flex-1 cursor-pointer rounded-lg py-1.5 text-center text-[10px] font-black uppercase tracking-widest transition",
            isSimulation
              ? "text-black shadow-[0_0_18px_color-mix(in_srgb,var(--brand-cyber)_30%,transparent)]"
              : "text-white/45 hover:text-white/70",
          ].join(" ")}
          style={isSimulation ? { background: "var(--brand-cyber)" } : { background: "transparent" }}
        >
          Simulation
        </button>
      </div>
      {busy ? <p className="mt-1 text-[9px] text-white/50">Seeding…</p> : null}
      {note && !busy ? <p className="mt-1 text-[9px] leading-snug text-white/45">{note}</p> : null}
    </div>
  );
}
