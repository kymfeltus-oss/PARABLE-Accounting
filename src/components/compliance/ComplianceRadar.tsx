export type StatementViolation = {
  severity: "CRITICAL" | "HIGH" | string;
  term: string;
  reason: string;
  action: string;
  /** Optional: prohibited vs contextual risk (from statementMonitor) */
  layer?: "prohibited" | "high_risk";
};

type Props = {
  /** Results from `scanPublicStatements` / `scanStreamMetadata` */
  violations: StatementViolation[];
  /** e.g. Pub. 1828 */
  subheading?: string;
  className?: string;
};

/**
 * Compliance “radar” card: matte shell, red pulse, per Pub 1828 intervention heuristics.
 * Use inside the IRS Guardian dashboard for public / streaming text review.
 */
export default function ComplianceRadar({ violations, subheading = "Pub. 1828 (political campaign intervention)", className = "" }: Props) {
  return (
    <div
      className={[
        "rounded-3xl border border-white/5 bg-[#050505] p-8 shadow-2xl",
        "ring-1 ring-cyan-500/10",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="mb-10 flex items-center gap-4">
        <div className="h-4 w-4 shrink-0 animate-pulse rounded-full bg-red-500 shadow-[0_0_15px_#ef4444]" />
        <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white">IRS Guardian // Public statement monitor</h2>
      </div>
      <p className="mb-6 text-[9px] font-bold uppercase tracking-[0.3em] text-cyan-400/70">Compliance radar // {subheading}</p>

      <div className="space-y-4">
        {violations.map((v, i) => (
          <div
            key={`${v.term}-${i}`}
            className="rounded-r-xl border-l-4 border-red-500 bg-white/5 p-6 backdrop-blur-md"
            role="article"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <span className="rounded bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white uppercase">{v.severity}</span>
              <span className="text-[10px] text-white/40 font-mono italic">Pub. 1828 · {v.layer ?? "scan"}</span>
            </div>
            <h3 className="mb-1 font-bold text-white">Detected: &ldquo;{v.term}&rdquo;</h3>
            <p className="mb-4 text-sm leading-relaxed text-white/60">{v.reason}</p>
            <div className="rounded-lg border border-white/5 bg-black/40 p-4">
              <p className="mb-1 text-[10px] font-bold tracking-widest text-cyan-400 uppercase">Correction protocol</p>
              <p className="text-xs text-white/80 italic">{v.action}</p>
            </div>
          </div>
        ))}

        {violations.length === 0 && (
          <div className="py-20 text-center opacity-20">
            <p className="text-xs tracking-[0.5em] uppercase">Sovereign shield active // No policy hits in this text</p>
            <p className="mt-3 text-[9px] tracking-wider text-zinc-500">
              This scan is heuristic. Leadership review still required before major releases.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
