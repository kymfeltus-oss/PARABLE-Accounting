"use client";

import React, { useEffect, useMemo, useState } from "react";
import { matchBankDescriptionToCoa } from "../../../autonomousEngineCore.js";
import { interventionFrictionFlags, validateAutonomousAction } from "../../../thresholdBouncer.js";
import type { AutonomousConfig } from "./AutonomousSettings";

type QueueRow = {
  id: string;
  description: string;
  amount: number;
  /** 0-1 */
  aiCertainty: number;
  suggestedCode: string;
  suggestedLabel: string;
  /** why bouncer sent it here */
  bouncerReason: string;
  overDollar: boolean;
  lowConfidence: boolean;
  confirmed: boolean;
};

export type InterventionCoaRow = { account_code: number; account_name?: string };

const DEFAULT_COA: InterventionCoaRow[] = [
  { account_code: 4020, account_name: "Digital / streaming" },
  { account_code: 6050, account_name: "Utilities" },
  { account_code: 7100, account_name: "Guest / honoraria" },
  { account_code: 4010, account_name: "Donations" },
  { account_code: 5010, account_name: "General" },
];

/** Demo bank lines that may fail thresholds — replace with API / import in production */
const SEED_IMPORT = [
  { id: "imp-1", description: "Payout Twitch Interactive", amount: 1200, aiCertainty: 0.98 },
  { id: "imp-2", description: "Wire — capital campaign transfer", amount: 14_200, aiCertainty: 0.97 },
  { id: "imp-3", description: "POS 8821 mystery vendor", amount: 33.2, aiCertainty: 0.78 },
  { id: "imp-4", description: "Duke Energy — electric", amount: 412, aiCertainty: 0.99 },
];

type Props = {
  settings: AutonomousConfig;
  onPendingChange: (pending: number) => void;
  coaList?: InterventionCoaRow[];
};

function buildQueue(settings: AutonomousConfig, coa: InterventionCoaRow[]): QueueRow[] {
  const out: QueueRow[] = [];
  for (const line of SEED_IMPORT) {
    const m = matchBankDescriptionToCoa(line.description, coa);
    const cert = m.confidence > 0 ? m.confidence : line.aiCertainty;
    const v = validateAutonomousAction({ amount: line.amount }, cert, settings);
    if (v.action === "REQUIRE_HUMAN_REVIEW") {
      const f = interventionFrictionFlags({ amount: line.amount }, cert, settings);
      const code = m.accountCode != null ? String(m.accountCode) : "—";
      out.push({
        id: line.id,
        description: line.description,
        amount: line.amount,
        aiCertainty: cert,
        suggestedCode: code,
        suggestedLabel: m.label || "Unmatched",
        bouncerReason: v.reason ?? "Review",
        overDollar: f.overDollar,
        lowConfidence: f.lowConfidence,
        confirmed: false,
      });
    }
  }
  return out;
}

const InterventionQueue: React.FC<Props> = ({ settings, onPendingChange, coaList }) => {
  const coa = coaList ?? DEFAULT_COA;
  const [rows, setRows] = useState<QueueRow[]>([]);

  const refreshed = useMemo(() => buildQueue(settings, coa), [settings, coa]);

  // When policy changes, the engine re-filters; confirmations reset to avoid false “clears.”
  useEffect(() => {
    setRows(refreshed);
  }, [refreshed]);

  useEffect(() => {
    const pending = rows.filter((r) => !r.confirmed).length;
    onPendingChange(pending);
  }, [rows, onPendingChange]);

  const onConfirm = (id: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, confirmed: true } : r)));
  };

  return (
    <div className="space-y-3">
      <style>{`
        @keyframes interventionGlitch {
          0% { transform: translate(0,0); filter: none; }
          20% { transform: translate(-1px, 0.5px); }
          40% { transform: translate(0.5px, -0.5px); }
          60% { transform: translate(-0.5px, 0); }
          80% { transform: translate(1px, 0.5px); }
          100% { transform: translate(0,0); }
        }
        .intervention-glitch { animation: interventionGlitch 0.35s ease-in-out infinite; }
      `}</style>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-amber-100/90">Human intervention · Gate 2</h3>
        <span className="text-[9px] font-mono text-zinc-500">
          {rows.filter((r) => !r.confirmed).length} pending
        </span>
      </div>
      <p className="text-[10px] text-zinc-500">
        Lines the autonomous engine could not auto-book under your thresholds. Confirm each to clear the queue; you cannot leave Gate 2 until the queue is empty.
      </p>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-3 text-xs text-emerald-200/90">No items in review — all import lines pass your current thresholds.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const amber = r.overDollar;
            const glitch = r.lowConfidence;
            return (
              <li
                key={r.id}
                className={[
                  "rounded-xl border p-3 transition",
                  r.confirmed
                    ? "border-zinc-800/80 bg-zinc-900/30 opacity-60"
                    : amber
                      ? "border-amber-500/50 bg-amber-950/25"
                      : "border-zinc-800 bg-zinc-950/50",
                ].join(" ")}
                style={
                  amber && !r.confirmed
                    ? { boxShadow: "0 0 24px color-mix(in srgb, #f59e0b 0.12, transparent), inset 0 0 0 1px rgba(245, 158, 11, 0.15)" }
                    : undefined
                }
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className={["min-w-0 flex-1", glitch && !r.confirmed ? "intervention-glitch" : ""].join(" ")}>
                    <p className="truncate font-mono text-[10px] text-zinc-300">{r.description}</p>
                    <p className="mt-1 text-[9px] text-zinc-500">
                      Suggested: <span className="text-cyan-200/80">{r.suggestedLabel}</span> · UCOA{" "}
                      <span className="font-mono text-cyan-200/80">{r.suggestedCode}</span> · cert {(r.aiCertainty * 100).toFixed(1)}%
                    </p>
                    <p className="text-[9px] text-amber-200/70">Hold: {r.bouncerReason}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-white">${r.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    {r.confirmed ? (
                      <span className="text-[9px] font-bold uppercase text-emerald-400/90">Verified</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onConfirm(r.id)}
                        className="rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-amber-100"
                      >
                        Confirm
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default InterventionQueue;
