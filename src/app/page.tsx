import Link from "next/link";
import LandingHeader from "@/components/landing/LandingHeader";
import PlanSection from "@/components/landing/PlanSection";

export default function HomePage() {
  return (
    <main className="min-h-screen scroll-smooth bg-white">
      <LandingHeader />

      {/* Hero Section — Ombre Background starting with #000028 */}
      <section 
        className="relative w-full overflow-x-hidden text-white"
        style={{ background: "linear-gradient(to bottom, #000028 0%, #050a18 100%)" }}
      >
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 px-4 pt-12 pb-6 sm:gap-10 sm:pt-16 sm:pb-8 md:px-8 lg:min-h-[min(80dvh,45rem)] lg:grid-cols-2 lg:items-center lg:gap-12">
          <div className="z-10">
            <div className="mb-6 inline-flex items-center gap-3">
              <img src="/logo.svg" alt="Parable" className="h-10 w-auto sm:h-12" />
              <span className="text-xl font-bold tracking-tight text-white sm:text-2xl">Accounting</span>
            </div>
            <p className="text-lg font-semibold text-[#4169E1] sm:text-2xl" style={{ textShadow: "0 0 10px rgba(65, 105, 225, 0.35)" }}>
              Automation where it counts.
            </p>
            
            <h1 className="mt-2 text-4xl font-bold leading-tight text-white md:text-6xl" style={{ textShadow: "0 0 25px rgba(0, 255, 255, 0.2)" }}>
              Human where it matters.
            </h1>
            
            <p className="mt-5 max-w-xl text-base text-slate-300 md:text-lg">
              Accounting unifies operations, member giving, and compliance workflows in one institutional control plane.
            </p>
            
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#plans"
                className="inline-flex items-center justify-center rounded-md bg-[#4169E1] px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#3557c7] hover:shadow-[0_0_20px_rgba(65,105,225,0.45)]"
              >
                Buy now and save
              </a>
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-md border-2 border-[#4169E1] bg-transparent px-6 py-3 text-sm font-bold tracking-wide text-[#4169E1] transition hover:bg-[#4169E1]/10"
              >
                Try it free for 30 days
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg lg:ml-auto lg:max-w-xl xl:max-w-2xl">
            <div className="relative w-full overflow-hidden rounded-lg border-2 border-[#4169E1]/50 bg-black shadow-[0_0_50px_rgba(65,105,225,0.28)] h-[min(48svh,380px)] sm:h-[min(52svh,420px)] lg:h-[min(72svh,640px)]">
              <img src="/videos/church%20photo.jpg" alt="Community" className="h-full w-full object-cover" />
            </div>
          </div>
        </div>
      </section>

      <PlanSection />
    </main>
  );
}