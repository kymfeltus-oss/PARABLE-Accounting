"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

export default function IntroFlashClient() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#030304] px-4 py-12">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,211,238,0.15),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 left-1/2 h-[40vh] w-[120vw] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.06),transparent_70%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.4)_100%)]"
        aria-hidden
      />

      <motion.div
        className="relative z-10 flex w-full max-w-lg flex-col items-center text-center"
        initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="w-full rounded-2xl border border-white/[0.08] bg-white p-8 shadow-[0_0_0_1px_rgba(34,211,238,0.15),0_25px_80px_-20px_rgba(0,0,0,0.6),0_0_120px_-30px_rgba(34,211,238,0.25)]">
          <Image
            src="/branding/parable-accounting-logo.png"
            alt="PARABLE Accounting — fund accounting and ledger operations"
            width={640}
            height={360}
            className="h-auto w-full max-w-md select-none"
            priority
            sizes="(max-width: 640px) 100vw, 28rem"
          />
        </div>

        <motion.p
          className="mt-8 max-w-md text-sm leading-relaxed text-white/45"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.5 }}
        >
          Sovereign ledger, fund accounting, and member giving — built for churches and ministries that
          need audit-grade clarity.
        </motion.p>

        <motion.div
          className="mt-10 flex w-full flex-col gap-3 sm:flex-row sm:justify-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.45 }}
        >
          <Link
            href="/member-portal"
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-cyan-500 px-8 text-sm font-bold uppercase tracking-widest text-[#030304] shadow-[0_0_32px_rgba(34,211,238,0.35)] transition hover:bg-cyan-400"
          >
            Enter app
          </Link>
          <Link
            href="/command-center"
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-8 text-sm font-bold uppercase tracking-widest text-white/80 transition hover:border-cyan-500/40 hover:text-cyan-200"
          >
            Staff hub
          </Link>
        </motion.div>
      </motion.div>

      <p className="absolute bottom-6 z-10 text-[10px] font-medium uppercase tracking-[0.35em] text-white/25">
        Parable · ERP
      </p>
    </div>
  );
}
