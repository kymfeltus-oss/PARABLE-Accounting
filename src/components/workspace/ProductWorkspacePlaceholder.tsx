import LandingHeader from "@/components/landing/LandingHeader";

type Props = {
  /** Page H1 — matches nav label for verification. */
  title: string;
  /** Short route / product blurb under the title. */
  slug: string;
};

/**
 * Marketing workspace shell: global landing header (cyan banner + nav) + tech-noir body placeholder.
 */
export default function ProductWorkspacePlaceholder({ title, slug }: Props) {
  return (
    <main className="min-h-screen scroll-smooth bg-[#030712] text-slate-100">
      <LandingHeader />
      <section
        className="relative border-b border-cyan-500/10"
        style={{
          background: "linear-gradient(180deg, #000018 0%, #050a14 55%, #030712 100%)",
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,255,255,0.08),transparent)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:py-14 md:px-8 md:py-16">
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-400/90 sm:text-xs">PARABLE · workspace</p>
          <p className="mt-2 font-mono text-[10px] text-slate-500 sm:text-xs">{slug}</p>
          <h1 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
            Placeholder surface — route is active. Full product modules will mount here next.
          </p>
          <div className="mt-10 rounded-xl border border-cyan-500/20 bg-slate-950/60 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-8 md:p-10">
            <div className="mx-auto max-w-md text-center">
              <div className="mx-auto mb-4 h-1 w-16 rounded-full bg-[var(--brand-cyber)] shadow-[0_0_20px_rgba(0,255,255,0.35)]" />
              <p className="text-xs font-semibold uppercase tracking-widest text-cyan-200/80">Tech-noir preview</p>
              <p className="mt-3 text-sm text-slate-500">
                Dark canvas, electric cyan accents, and responsive spacing align with the PARABLE marketing shell.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
