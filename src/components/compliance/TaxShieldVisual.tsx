"use client";

import { motion, useReducedMotion } from "framer-motion";
import { calculateTaxShield } from "@/lib/taxShieldCalculator";

export type TaxShieldVisualProps = {
  annualSalary: number;
  housingAllowance: number;
  className?: string;
};

/**
 * Cinematic “Tax Shield” — vertical compensation bar with neon-cyan glass shield over housing share.
 */
export default function TaxShieldVisual({ annualSalary, housingAllowance, className = "" }: TaxShieldVisualProps) {
  const reduceMotion = useReducedMotion();
  const { totalComp, shieldPercentage, taxableBasis, secaBasis } = calculateTaxShield(annualSalary, housingAllowance);

  const rawHousingPct = totalComp > 0 ? (housingAllowance / totalComp) * 100 : 0;
  const rawSalaryPct = totalComp > 0 ? (annualSalary / totalComp) * 100 : 0;
  const sum = rawHousingPct + rawSalaryPct;
  const housingPct = sum > 0 ? (rawHousingPct / sum) * 100 : 0;
  const salaryPct = sum > 0 ? (rawSalaryPct / sum) * 100 : 0;

  const tooltip =
    "Your Housing Allowance shields this portion of your income from Federal Income Tax. Note: 15.3% SECA still applies to the full amount.";

  return (
    <div
      className={`rounded-2xl border border-white/10 bg-[var(--brand-surface)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${className}`}
      title={tooltip}
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="brand-text-glow-muted text-[10px] font-semibold uppercase tracking-[0.35em]">Tax shield</p>
          <p className="brand-text-glow mt-1 text-4xl font-black italic tracking-tight md:text-5xl">{shieldPercentage}%</p>
          <p className="parable-sublabel mt-2 !tracking-[0.25em]">Sovereignty share</p>
        </div>
        <p className="max-w-sm text-xs leading-relaxed text-white/45">{tooltip}</p>
      </div>

      <div className="mt-8 flex items-stretch justify-center gap-8">
        <div className="relative h-64 w-14 overflow-hidden rounded-full bg-black/70 ring-1 ring-white/10 md:h-72 md:w-16">
          {/* Salary — top, tax-exposed */}
          <div
            className="absolute left-0 right-0 top-0 bg-gradient-to-b from-[#ef4444]/55 to-[#ef4444]/15"
            style={{ height: `${salaryPct}%` }}
          />
          {/* Housing — bottom, shielded */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[rgb(var(--brand-glow-rgb)/0.5)] to-[rgb(var(--brand-glow-rgb)/0.12)]"
            initial={reduceMotion ? false : { height: "0%" }}
            animate={{ height: `${housingPct}%` }}
            transition={{ duration: reduceMotion ? 0 : 1.05, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              className="pointer-events-none absolute inset-0"
              style={{
                background: "radial-gradient(ellipse at bottom, rgb(var(--brand-glow-rgb) / 0.55) 0%, transparent 65%)",
              }}
              initial={reduceMotion ? { opacity: 0.5 } : { opacity: 0 }}
              animate={{ opacity: [0.4, 1, 0.55] }}
              transition={{ duration: reduceMotion ? 0 : 2.2, repeat: reduceMotion ? 0 : Infinity, ease: "easeInOut" }}
            />
          </motion.div>
          {/* Glass shield at the boundary */}
          <motion.div
            className="pointer-events-none absolute left-[-20%] right-[-20%] flex h-[22%] items-center justify-center rounded-xl border border-[rgb(var(--brand-glow-rgb)/0.55)] bg-[rgb(var(--brand-glow-rgb)/0.15)] shadow-[0_0_32px_rgb(var(--brand-glow-rgb)/0.5)] backdrop-blur-md"
            style={{ bottom: `calc(${housingPct}% - 11%)` }}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: reduceMotion ? 0 : 0.4, duration: reduceMotion ? 0 : 0.5, ease: "easeOut" }}
          >
            <span className="select-none text-[8px] font-black uppercase tracking-widest text-[rgb(var(--brand-glow-rgb)/0.95)]">
              Shield
            </span>
          </motion.div>
        </div>

        <dl className="flex flex-col justify-center gap-3 text-xs text-white/55">
          <div className="flex justify-between gap-8 border-b border-white/5 pb-2">
            <dt>Total compensation</dt>
            <dd className="font-mono text-white/90">${totalComp.toLocaleString()}</dd>
          </div>
          <div className="flex justify-between gap-8 border-b border-white/5 pb-2">
            <dt className="text-red-300/90">Federal income tax lens (illustrative)</dt>
            <dd className="font-mono text-red-200/90">${taxableBasis.toLocaleString()}</dd>
          </div>
          <div className="flex justify-between gap-8">
            <dt>SECA base (full cash)</dt>
            <dd className="font-mono text-white/90">${secaBasis.toLocaleString()}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
