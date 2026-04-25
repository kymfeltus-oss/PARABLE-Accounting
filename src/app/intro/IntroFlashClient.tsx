"use client";

import { useEffect, useRef, useState, type ReactNode, type MouseEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useSpring, useTransform, useReducedMotion } from "framer-motion";

const SPRING = { stiffness: 120, damping: 28, mass: 0.4 };

type Particle = { id: number; x: string; y: string; s: number; d: number };

const PARTICLES: Particle[] = Array.from({ length: 42 }, (_, i) => ({
  id: i,
  x: `${(i * 47 + 13) % 100}%`,
  y: `${(i * 23 + 31) % 100}%`,
  s: 0.5 + (i % 5) * 0.2,
  d: 3 + (i % 8) * 0.7,
}));

function usePointerParallax(reduce: boolean) {
  const raf = useRef(0);
  const [glow, setGlow] = useState({ x: 50, y: 35 });
  const mx = useSpring(0, SPRING);
  const my = useSpring(0, SPRING);
  const dx = useTransform(mx, (v) => (reduce ? 0 : v * 0.4));
  const dy = useTransform(my, (v) => (reduce ? 0 : v * 0.35));
  const lg = useTransform(mx, (v) => (reduce ? 0 : v * 0.8));
  const lgy = useTransform(my, (v) => (reduce ? 0 : v * 0.6));

  useEffect(() => {
    if (reduce) {
      setGlow({ x: 50, y: 35 });
      mx.set(0);
      my.set(0);
      return;
    }
    const onMove = (e: PointerEvent) => {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        const cx = (e.clientX / window.innerWidth) * 100;
        const cy = (e.clientY / window.innerHeight) * 100;
        setGlow({ x: cx, y: cy });
        const px = (e.clientX / window.innerWidth - 0.5) * 2;
        const py = (e.clientY / window.innerHeight - 0.5) * 2;
        mx.set(px);
        my.set(py);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [reduce, mx, my]);

  return { glow, dx, dy, lg, lgy };
}

export default function IntroFlashClient() {
  const reduce = useReducedMotion() ?? false;
  const { glow, dx, dy, lg, lgy } = usePointerParallax(reduce);

  const spotlight =
    `radial-gradient(50rem circle at ${glow.x}% ${glow.y}%, ` +
    `rgba(34,211,238,0.2) 0%, rgba(0,200,255,0.07) 38%, transparent 62%)`;

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#020203] px-4 py-16">
      {/* Base depth */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 80% at 50% -20%, rgba(0, 180, 200, 0.2), transparent 50%), linear-gradient(180deg, #030308 0%, #050508 45%, #000 100%)",
        }}
        aria-hidden
      />

      {/* Pointer-follow wash */}
      <div
        className="pointer-events-none absolute inset-0 z-[1] transition-opacity"
        style={
          reduce
            ? { background: "none" }
            : { background: spotlight, mixBlendMode: "screen", opacity: 0.88 }
        }
        aria-hidden
      />

      {!reduce && (
        <div className="pointer-events-none absolute inset-0 z-[1] mix-blend-screen" aria-hidden>
          <div
            className="absolute inset-0"
            style={{
              background: `conic-gradient(from 180deg at 50% 0%, rgba(0, 242, 255, 0) 0deg, rgba(0, 198, 255, 0.12) 120deg, rgba(0, 242, 255, 0) 300deg)`,
            }}
          />
        </div>
      )}

      <motion.div
        className="pointer-events-none absolute -left-32 top-1/4 z-[1] h-72 w-72 rounded-full bg-cyan-500/20 blur-[100px]"
        animate={reduce ? {} : { y: [0, -20, 0], scale: [1, 1.05, 1] }}
        transition={reduce ? {} : { duration: 10, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />
      <motion.div
        className="pointer-events-none absolute -right-20 bottom-1/4 z-[1] h-64 w-64 rounded-full bg-fuchsia-500/15 blur-[90px]"
        animate={reduce ? {} : { y: [0, 16, 0], scale: [1, 0.95, 1] }}
        transition={reduce ? {} : { duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
        aria-hidden
      />
      <motion.div
        className="pointer-events-none absolute left-1/2 top-0 z-[1] h-px w-full max-w-2xl -translate-x-1/2 bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent"
        animate={reduce ? {} : { opacity: [0.3, 0.75, 0.3] }}
        transition={reduce ? {} : { duration: 4, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />

      {!reduce && (
        <div className="pointer-events-none absolute inset-0 z-[2] overflow-hidden" aria-hidden>
          {PARTICLES.map((p) => (
            <motion.span
              key={p.id}
              className="absolute h-0.5 w-0.5 rounded-full bg-cyan-200/50 shadow-[0_0_6px_2px_rgba(34,211,238,0.4)]"
              style={{ left: p.x, top: p.y, transform: `scale(${p.s})` }}
              animate={{ opacity: [0.15, 0.7, 0.15], y: [0, -14, 0] }}
              transition={{ duration: p.d, repeat: Infinity, delay: p.id * 0.08, ease: "easeInOut" }}
            />
          ))}
        </div>
      )}

      <div
        className="pointer-events-none absolute inset-0 z-[2] bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.5)_100%)]"
        aria-hidden
      />

      <motion.div
        className="relative z-10 flex w-full max-w-lg flex-col items-center text-center"
        initial={reduce ? false : { opacity: 0, y: 28, filter: "blur(10px)" }}
        animate={reduce ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={reduce ? {} : { duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          className="group relative w-full"
          style={{ x: dx, y: dy }}
        >
          {/* Glow behind logo, no box */}
          <div
            className="absolute -inset-8 -z-10 rounded-[2rem] opacity-90 blur-2xl sm:-inset-10"
            style={{
              background:
                "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(0, 242, 255, 0.35) 0%, rgba(0, 120, 200, 0.12) 40%, transparent 70%)",
            }}
            aria-hidden
          />
          <motion.div
            className="absolute -inset-4 -z-10 rounded-3xl"
            style={{
              x: reduce ? 0 : lg,
              y: reduce ? 0 : lgy,
            }}
            aria-hidden
          >
            <div
              className="h-full w-full opacity-30 blur-sm"
              style={{
                background:
                  "conic-gradient(from 140deg, rgba(0,242,255,0.5), rgba(100,0,200,0.2), rgba(0,242,255,0.3))",
                maskImage: "radial-gradient(closest-side, black, transparent 85%)",
                WebkitMaskImage: "radial-gradient(closest-side, black, transparent 85%)",
              }}
            />
          </motion.div>

          <div className="relative px-2 sm:px-0">
            <div className="mx-auto w-full max-w-md drop-shadow-[0_0_40px_rgba(0,242,255,0.25)]">
              <Image
                src="/logo.svg"
                alt="PARABLE"
                width={640}
                height={84}
                className="h-auto w-full select-none transition-transform duration-300 [filter:drop-shadow(0_0_24px_rgba(0,242,255,0.4))] group-hover:scale-[1.02]"
                priority
                sizes="(max-width: 640px) 92vw, 28rem"
              />
            </div>
            <motion.p
              className="mt-2 font-[family-name:var(--font-inter)] text-[0.7rem] font-bold uppercase tracking-[0.5em] text-cyan-300/90 sm:text-xs"
              animate={reduce ? {} : { textShadow: ["0 0 8px rgba(0,242,255,0.2)", "0 0 18px rgba(0,242,255,0.5)", "0 0 8px rgba(0,242,255,0.2)"] }}
              transition={reduce ? {} : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            >
              Accounting
            </motion.p>
            <p className="mt-0.5 text-[9px] uppercase tracking-[0.35em] text-white/25 sm:text-[10px]">ERP</p>
          </div>
        </motion.div>

        <motion.p
          className="mt-10 max-w-md bg-gradient-to-b from-white/90 to-white/50 bg-clip-text text-sm leading-relaxed text-transparent sm:mt-12"
          initial={reduce ? false : { opacity: 0 }}
          animate={reduce ? undefined : { opacity: 1 }}
          transition={reduce ? {} : { delay: 0.35, duration: 0.55 }}
        >
          The first ERP System for churches that guarantees IRS compliance.
        </motion.p>

        <motion.div
          className="mt-10 flex w-full flex-col gap-3 sm:mt-12 sm:flex-row sm:justify-center"
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={reduce ? {} : { delay: 0.55, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <MagneticButton href="/member-portal" primary>
            Member portal
          </MagneticButton>
          <MagneticButton href="/command-center">Staff hub</MagneticButton>
        </motion.div>
      </motion.div>

      <motion.p
        className="absolute bottom-6 z-10 text-[10px] font-medium uppercase tracking-[0.35em] text-white/25"
        animate={reduce ? {} : { opacity: [0.2, 0.45, 0.2] }}
        transition={reduce ? {} : { duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      >
        Parable · ERP
      </motion.p>
    </div>
  );
}

function MagneticButton({ href, children, primary }: { href: string; children: ReactNode; primary?: boolean }) {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(0, { stiffness: 200, damping: 22, mass: 0.1 });
  const y = useSpring(0, { stiffness: 200, damping: 22, mass: 0.1 });

  const onMove = (e: MouseEvent) => {
    if (reduce || !ref.current) return;
    const b = ref.current.getBoundingClientRect();
    const px = (e.clientX - b.left - b.width / 2) * 0.12;
    const py = (e.clientY - b.top - b.height / 2) * 0.12;
    x.set(px);
    y.set(py);
  };
  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  const linkClass = primary
    ? "inline-flex min-h-[48px] w-full min-w-0 max-w-sm items-center justify-center rounded-2xl bg-gradient-to-b from-cyan-400 to-cyan-500 px-8 text-sm font-bold uppercase tracking-widest text-[#020203] shadow-[0_0_0_1px_rgba(34,211,238,0.3),0_0_32px_rgba(34,211,238,0.35),inset_0_1px_0_rgba(255,255,255,0.3)] sm:w-auto"
    : "inline-flex min-h-[48px] w-full min-w-0 max-w-sm items-center justify-center rounded-2xl border border-cyan-500/25 bg-white/[0.06] px-8 text-sm font-bold uppercase tracking-widest text-cyan-100/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-sm sm:w-auto";

  return (
    <motion.div
      ref={ref}
      className="w-full sm:w-auto"
      style={{ x, y }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      whileHover={reduce ? {} : { scale: 1.02 }}
      whileTap={reduce ? {} : { scale: 0.98 }}
    >
      <Link
        href={href}
        className={`${linkClass} block transition-colors hover:brightness-110`}
      >
        {children}
      </Link>
    </motion.div>
  );
}
