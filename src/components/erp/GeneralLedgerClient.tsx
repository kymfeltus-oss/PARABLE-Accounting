"use client";

import { useCallback } from "react";
import { buildGeneralLedgerCsvPlaceholder, downloadTextFile } from "@/lib/exportLedgerCsv";

/**
 * GL export entry — placeholder CSV matches shell “Certified / GL” tools until journal API ships.
 */
export default function GeneralLedgerClient() {
  const onExport = useCallback(() => {
    const y = new Date().getFullYear();
    downloadTextFile(`parable-ledger-gl-${y}.csv`, buildGeneralLedgerCsvPlaceholder());
  }, []);

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onExport}
        className="cursor-pointer rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white/90 shadow-[0_0_20px_rgb(var(--brand-cyber-rgb)/0.1)] transition hover:border-[rgb(var(--brand-cyber-rgb)/0.35)] hover:text-[var(--brand-cyber)]"
      >
        Export GL placeholder (CSV)
      </button>
    </div>
  );
}
