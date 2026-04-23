"use client";

import React, { useCallback, useState } from "react";

export type AutonomousConfig = { maxAmount: number; confidence: number };

type Props = {
  currentConfig: AutonomousConfig;
  onSave?: (c: AutonomousConfig) => void;
  onChange?: (c: AutonomousConfig) => void;
};

const AutonomousSettings: React.FC<Props> = ({ currentConfig, onSave, onChange }) => {
  const [local, setLocal] = useState(currentConfig);

  const sync = useCallback(
    (next: AutonomousConfig) => {
      setLocal(next);
      onChange?.(next);
    },
    [onChange]
  );

  React.useEffect(() => {
    setLocal((prev) => {
      if (prev.maxAmount === currentConfig.maxAmount && prev.confidence === currentConfig.confidence) return prev;
      return currentConfig;
    });
  }, [currentConfig]);

  return (
    <div className="rounded-3xl border border-white/10 bg-[#050505] p-6 text-white sm:p-10">
      <h2 className="mb-8 text-2xl font-black uppercase italic tracking-tighter">AI controller thresholds</h2>

      <div className="space-y-10">
        <div>
          <div className="mb-4 flex justify-between">
            <label className="text-xs uppercase tracking-widest opacity-50">Auto-reconcile max amount</label>
            <span className="font-mono text-sm font-bold" style={{ color: "var(--brand-cyber, #22d3ee)" }}>
              ${local.maxAmount.toLocaleString()}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={10_000}
            step={500}
            className="w-full accent-cyan-400"
            value={local.maxAmount}
            onChange={(e) => sync({ ...local, maxAmount: Number(e.target.value) })}
          />
          <p className="mt-2 text-[10px] italic text-white/40">0 = no cap by amount. Above the limit, Gate 2 review is required for that line.</p>
        </div>

        <div>
          <div className="mb-4 flex justify-between">
            <label className="text-xs uppercase tracking-widest opacity-50">AI confidence requirement</label>
            <span className="font-mono text-sm font-bold" style={{ color: "var(--brand-cyber, #22d3ee)" }}>{local.confidence}%</span>
          </div>
          <input
            type="range"
            min={70}
            max={100}
            step={1}
            className="w-full accent-cyan-400"
            value={local.confidence}
            onChange={(e) => sync({ ...local, confidence: Number(e.target.value) })}
          />
          <p className="mt-2 text-[10px] italic text-white/40">Categorization certainty must meet or exceed this; otherwise the line joins the human intervention queue.</p>
        </div>
      </div>

      {onSave && (
        <button
          type="button"
          onClick={() => onSave(local)}
          className="mt-8 w-full rounded-xl border border-cyan-500/30 py-3 text-[10px] font-bold uppercase tracking-widest"
          style={{ color: "var(--brand-cyber, #22d3ee)", boxShadow: "0 0 20px color-mix(in srgb, var(--brand-cyber) 0.1%, transparent)" }}
        >
          Save threshold profile
        </button>
      )}
    </div>
  );
};

export default AutonomousSettings;
