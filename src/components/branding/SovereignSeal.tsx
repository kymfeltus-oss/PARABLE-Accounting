"use client";

import { motion } from "framer-motion";

export type SealTier = "platinum" | "pending" | "suspended";

type Props = {
  /** From `getComplianceStatus` or manual: platinum = live seal, pending = grace, suspended = critical */
  tier: SealTier;
  /** Optional: override label */
  labelVerified?: string;
  labelOther?: string;
  /** White-label primary (hex) */
  primaryColor?: string;
  className?: string;
  /** Compact for footer embed */
  compact?: boolean;
};

/**
 * Embeddable smart badge: stays “lit” only when `tier` is platinum.
 * Use on streaming pages, footers, or give GET url `/verify/{slug}` for donors.
 */
export default function SovereignSeal({
  tier,
  labelVerified = "Financially verified",
  labelOther = "Compliance pending",
  primaryColor = "#22d3ee",
  className = "",
  compact = false,
}: Props) {
  const isPlatinum = tier === "platinum";
  const isSuspended = tier === "suspended";
  const stroke = isPlatinum ? primaryColor : isSuspended ? "#f87171" : "rgba(255,255,255,0.45)";

  return (
    <div
      className={[
        "flex flex-col items-center gap-2 rounded-xl border p-4 transition-all duration-700",
        isPlatinum
          ? "border-cyan-400/80 bg-cyan-400/5 shadow-[0_0_20px_rgba(34,211,238,0.25)]"
          : isSuspended
            ? "border-red-500/60 bg-red-950/30 shadow-[0_0_18px_rgba(248,113,113,0.2)]"
            : "border-white/10 bg-white/[0.02] opacity-60 grayscale",
        compact ? "p-3" : "p-4",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="relative">
        <motion.svg
          width={compact ? 32 : 40}
          height={compact ? 32 : 40}
          viewBox="0 0 24 24"
          fill="none"
          initial={isPlatinum ? { scale: 0.9, opacity: 0.6 } : { scale: 1, opacity: 1 }}
          animate={isPlatinum ? { scale: 1, opacity: 1 } : { scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 18 }}
        >
          <title>Sovereign Seal</title>
          <path
            d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
            stroke={stroke}
            strokeWidth="1.8"
            className="transition-colors duration-700"
          />
          {isPlatinum && (
            <motion.path
              d="M9 12l2 2 4-4"
              stroke={primaryColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
            />
          )}
          {isSuspended && (
            <path d="M9.5 9.5l5 5M14.5 9.5l-5 5" stroke="#fca5a5" strokeWidth="1.5" strokeLinecap="round" />
          )}
        </motion.svg>
        {isPlatinum && (
          <span
            className="pointer-events-none absolute inset-0 -z-10 blur-xl"
            style={{ background: `radial-gradient(ellipse at 50% 30%, ${primaryColor}40, transparent 60%)` }}
            aria-hidden
          />
        )}
      </div>

      <div className="text-center">
        <p
          className={[
            "text-[8px] font-bold uppercase tracking-[0.3em]",
            isPlatinum ? "text-cyan-400" : isSuspended ? "text-red-300" : "text-zinc-400",
          ].join(" ")}
        >
          {isPlatinum ? labelVerified : isSuspended ? "Review required" : labelOther}
        </p>
        <p className="text-[10px] font-black tracking-tighter text-white uppercase italic">Parable // Integrity 2026</p>
      </div>
    </div>
  );
}
