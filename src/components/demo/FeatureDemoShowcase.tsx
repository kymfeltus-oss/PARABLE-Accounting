import Link from "next/link";
import { Play } from "lucide-react";
import LandingHeader from "@/components/landing/LandingHeader";

const glass =
  "rounded-2xl border border-white/[0.08] bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_60px_rgba(0,255,255,0.04)] backdrop-blur-md";

export type FeatureDemoContent = {
  /** URL path for breadcrumb-style label */
  slug: string;
  heroKicker: string;
  heroTitle: string;
  heroSubtitle: string;
  bullets: string[];
  screenshotCaption: string;
  videoCaption: string;
};

/**
 * Public marketing / demo layout (no auth). Tech-noir: deep blacks, cyan accents, glass panels.
 * Served only from `/demo/*` — if you add session gates, allowlist these paths (see `src/proxy.ts` note).
 */
export default function FeatureDemoShowcase({
  slug,
  heroKicker,
  heroTitle,
  heroSubtitle,
  bullets,
  screenshotCaption,
  videoCaption,
}: FeatureDemoContent) {
  return (
    <main className="min-h-screen scroll-smooth bg-[#020617] text-slate-100">
      <LandingHeader />

      <section
        className="relative border-b border-cyan-500/10"
        style={{
          background: "linear-gradient(180deg, #000014 0%, #030a18 45%, #020617 100%)",
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-25%,rgba(0,255,255,0.12),transparent_55%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-10 sm:pb-20 sm:pt-14 md:px-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-400/90 sm:text-xs">{heroKicker}</p>
          <p className="mt-2 font-mono text-[10px] text-slate-500 sm:text-xs">{slug}</p>
          <h1 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
            {heroTitle}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">{heroSubtitle}</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 md:px-8 md:py-16">
        <div className="flex flex-col gap-10 lg:grid lg:grid-cols-2 lg:items-start lg:gap-12">
          <div className="flex min-w-0 flex-col gap-6 lg:order-2">
            <figure className={`${glass} overflow-hidden p-3 sm:p-4`}>
              <div
                className="flex aspect-video w-full items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 via-slate-950 to-black ring-1 ring-cyan-500/15"
                role="img"
                aria-label={screenshotCaption}
              >
                <span className="px-4 text-center text-xs font-medium uppercase tracking-widest text-cyan-200/70 sm:text-sm">
                  Screenshot preview
                </span>
              </div>
              <figcaption className="mt-3 text-center text-xs text-slate-500 sm:text-sm">{screenshotCaption}</figcaption>
            </figure>

            <figure className={`${glass} overflow-hidden p-3 sm:p-4`}>
              <div
                className="relative flex aspect-video w-full items-center justify-center rounded-xl bg-gradient-to-br from-slate-950 via-black to-slate-900 ring-1 ring-cyan-500/20"
                role="img"
                aria-label={videoCaption}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,255,255,0.08),transparent_65%)]" />
                <span className="relative flex h-16 w-16 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-400/10 text-cyan-200 shadow-[0_0_30px_rgba(0,255,255,0.2)]">
                  <Play className="ml-1 h-7 w-7" fill="currentColor" aria-hidden />
                </span>
              </div>
              <figcaption className="mt-3 text-center text-xs text-slate-500 sm:text-sm">{videoCaption}</figcaption>
            </figure>
          </div>

          <div className="min-w-0 lg:order-1">
            <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">Why ministries choose this</h2>
            <ul className="mt-5 space-y-3 text-sm leading-relaxed text-slate-300 sm:text-base">
              {bullets.map((b) => (
                <li key={b} className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-cyber)] shadow-[0_0_8px_rgba(0,255,255,0.6)]" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-center gap-4 border-t border-white/10 pt-12 text-center sm:mt-16 sm:pt-16">
          <p className="max-w-lg text-sm text-slate-400">
            Ready to see it with your ledger, funds, and people? Start on the house — full workspace access for 30 days.
          </p>
          <Link
            href="/register"
            className="inline-flex min-h-[3rem] w-full max-w-md items-center justify-center rounded-xl border border-cyan-400/30 bg-[var(--brand-cyber)] px-8 text-sm font-bold uppercase tracking-wide text-black shadow-[0_0_40px_rgba(0,255,255,0.25)] transition hover:brightness-110 sm:w-auto sm:min-w-[280px]"
          >
            Start your 30-day free trial
          </Link>
        </div>
      </section>
    </main>
  );
}
