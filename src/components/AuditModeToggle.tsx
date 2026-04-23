"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useAuditMode } from "@/context/AuditModeContext";

/**
 * Global Audit Mode control — scanning lens transition + institutional theme (see globals.css html.audit-mode).
 */
export default function AuditModeToggle() {
  const { auditMode, setAuditMode } = useAuditMode();
  const [scanning, setScanning] = useState(false);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const runToggle = () => {
    const next = !auditMode;
    setScanning(true);
    window.setTimeout(() => {
      setAuditMode(next);
      setScanning(false);
    }, 820);
  };

  const overlay =
    mounted &&
    scanning &&
    typeof document !== "undefined" &&
    createPortal(
      <AnimatePresence>
        <motion.div
          key="scan"
          className="pointer-events-none fixed inset-0 z-[240] flex items-start justify-center bg-black/55"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="h-[3px] w-full max-w-3xl rounded-full bg-[rgb(var(--brand-glow-rgb))] shadow-[0_0_40px_rgb(var(--brand-glow-rgb)/0.9)]"
            initial={{ y: "5vh", opacity: 0.3 }}
            animate={{ y: ["5vh", "92vh"], opacity: [0.9, 1, 0.85] }}
            transition={{ duration: 0.78, ease: "easeInOut" }}
          />
          <p className="absolute bottom-16 left-0 right-0 text-center text-[10px] font-bold uppercase tracking-[0.4em] text-[rgb(var(--brand-glow-rgb)/0.9)]">
            Verifying institutional view…
          </p>
        </motion.div>
      </AnimatePresence>,
      document.body,
    );

  return (
    <>
      <motion.button
        type="button"
        onClick={runToggle}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className={[
          "rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wide transition",
          auditMode
            ? "border-neutral-700 bg-white text-neutral-900 shadow-sm"
            : "border-white/15 bg-black/40 text-white/55 hover:border-white/25",
        ].join(" ")}
        aria-pressed={auditMode}
      >
        Audit mode
      </motion.button>
      {overlay}
    </>
  );
}
