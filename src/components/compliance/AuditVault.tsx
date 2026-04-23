export type AuditVaultRow = {
  id: string;
  source: string;
  amountLabel: string;
  lane: "mission_exempt" | "990-T_UBI";
  verified: boolean;
};

type AuditVaultProps = {
  title?: string;
  rows: AuditVaultRow[];
};

/**
 * Glass “audit vault” strip — neon verified glow when matched to bank / reconciliation state.
 */
export default function AuditVault({ title = "Audit vault", rows }: AuditVaultProps) {
  return (
    <section className="rounded-2xl border border-white/[0.12] bg-[rgba(11,13,16,0.85)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md md:p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="parable-sublabel">Reconciliation</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">{title}</h2>
        </div>
        <span className="rounded-full border border-[#00f2ff]/25 bg-[#00f2ff]/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#00f2ff]">
          Live
        </span>
      </div>

      <ul className="mt-6 space-y-3">
        {rows.map((row) => (
          <li
            key={row.id}
            className={[
              "flex items-center justify-between gap-4 rounded-xl border px-4 py-3 transition",
              row.verified
                ? "border-[#00f2ff]/45 bg-[#00f2ff]/10 shadow-[0_0_28px_rgba(0,242,255,0.18)]"
                : "border-white/10 bg-black/30",
            ].join(" ")}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{row.source}</p>
              <p className="text-xs uppercase tracking-wider text-white/40">
                {row.lane === "990-T_UBI" ? "990-T lane" : "Mission lane"}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-sm font-semibold tabular-nums text-white">{row.amountLabel}</span>
              <span
                className={[
                  "text-[10px] font-black uppercase tracking-wide",
                  row.verified ? "text-[#00f2ff]" : "text-amber-400/90",
                ].join(" ")}
              >
                {row.verified ? "Verified" : "Flagged"}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
