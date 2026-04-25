import Link from "next/link";
import LandingHeader from "@/components/landing/LandingHeader";
import PlanSection from "@/components/landing/PlanSection";

export default function HomePage() {
  return (
    <main className="min-h-screen scroll-smooth bg-[#0f1b2e]">
      <LandingHeader />

      <section className="relative overflow-hidden bg-[#0f1b2e] text-white">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 px-4 py-12 sm:gap-10 sm:py-16 md:px-8 lg:min-h-[min(100dvh,56rem)] lg:grid-cols-2 lg:items-center lg:gap-12 lg:py-10 xl:py-14">
          <div>
            <p
              className="text-lg font-semibold tracking-wide sm:text-2xl"
              style={{ color: "var(--brand-cyber)" }}
            >
              Automation where it counts.
            </p>
            <h1 className="mt-2 text-4xl font-bold leading-tight text-white md:text-6xl">
              Human where it matters.
            </h1>
            <p className="mt-5 max-w-xl text-base text-slate-300 md:text-lg">
              Accounting unifies operations, member giving, and compliance workflows in one
              institutional control plane built for high-confidence reporting.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/#plans"
                className="inline-flex items-center justify-center rounded-md border-2 border-cyan-500/30 px-5 py-3 text-sm font-bold uppercase tracking-wide text-slate-950 transition hover:brightness-105"
                style={{ backgroundColor: "var(--brand-cyber)" }}
              >
                Buy now and save
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-md border-2 border-[var(--brand-cyber)] bg-black px-5 py-3 text-sm font-bold tracking-wide text-[var(--brand-cyber)] transition hover:bg-white/5"
              >
                Try it free for 30 days
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg lg:ml-auto lg:max-w-xl xl:max-w-2xl">
            <div
              className="relative w-full overflow-hidden rounded-lg border-2 border-slate-600/90 bg-black shadow-xl
                h-[min(48svh,380px)] sm:h-[min(52svh,420px)] md:h-[min(54svh,440px)]
                lg:h-[min(72svh,640px)] xl:h-[min(76svh,700px)]"
            >
              <img
                src="/videos/church%20photo.jpg"
                alt="Church community"
                className="h-full w-full object-cover object-[center_22%] sm:object-center"
              />
            </div>
          </div>
        </div>
      </section>

      <PlanSection />
    </main>
  );
}