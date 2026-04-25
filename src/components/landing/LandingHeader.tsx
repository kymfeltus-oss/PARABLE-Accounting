"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";

type MenuId = "products" | "topFeatures" | "businessTypes" | "resources" | null;

function NavChevron({ open }: { open: boolean }) {
  return (
    <ChevronDown
      className={`h-3.5 w-3.5 shrink-0 opacity-80 transition-transform ${open ? "rotate-180" : ""}`}
      aria-hidden
    />
  );
}

export default function LandingHeader() {
  const [openId, setOpenId] = useState<MenuId>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpenId(null);
    setMobileOpen(false);
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [close]);

  const toggle = (id: Exclude<MenuId, null>) => {
    setOpenId((cur) => (cur === id ? null : id));
  };

  const panel =
    "absolute left-0 top-full z-50 mt-1 min-w-[220px] rounded-md border border-slate-700 bg-slate-900 py-2 text-sm shadow-xl";

  const item = "block px-4 py-2 text-slate-200 transition hover:bg-slate-800 hover:text-white";

  return (
    <header
      ref={wrapRef}
      className="sticky top-0 z-[100] bg-[#4169E1] text-white shadow-[0_6px_18px_rgba(0,0,0,0.25)]"
    >
      {/* Brand row: Cyan background, black text/logo, navy promo accent */}
      <div className="bg-[var(--brand-cyber)] border-b border-black/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-1.5 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-2 md:px-8 md:py-3">
          <Link
            href="/"
            className="flex w-fit shrink-0 items-center gap-2.5 no-underline"
          >
            <img
              src="/logo.svg"
              alt="Parable"
              className="h-8 w-auto sm:h-9 brightness-0" 
            />
            <span className="text-sm font-bold tracking-tight text-[#4169E1] sm:text-base">Accounting</span>
          </Link>
          <p className="min-w-0 pl-0 text-left text-xs font-semibold text-black/80 sm:border-l sm:border-black/20 sm:pl-3 sm:text-sm md:pl-4">
            Get <span className="font-extrabold text-[#4169E1]">50% OFF</span> Accounting for 3 months
            <span className="ml-0.5 text-black/40">*</span>
          </p>
        </div>
      </div>

      {/* Main nav bar — Midnight Navy */}
      <div>
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 md:gap-3 md:px-8 md:py-2.5">
          <nav className="hidden flex-1 min-w-0 items-center gap-0.5 md:flex" aria-label="Primary">
            <div className="relative">
              <button
                type="button"
                className="flex items-center gap-1 whitespace-nowrap rounded px-2 py-2 text-[13px] font-medium text-white/95 transition hover:bg-white/10"
                aria-expanded={openId === "products"}
                aria-haspopup="menu"
                onClick={() => toggle("products")}
              >
                Products &amp; Services
                <NavChevron open={openId === "products"} />
              </button>
              {openId === "products" && (
                <div className={panel} role="menu">
                  <Link href="/#plans" className={item} role="menuitem" onClick={close}>
                    Plans overview
                  </Link>
                  <Link href="/giving" className={item} role="menuitem" onClick={close}>
                    Giving &amp; member tools
                  </Link>
                  <Link href="/accounting" className={item} role="menuitem" onClick={close}>
                    Accounting workspace
                  </Link>
                  <Link href="/command-center" className={item} role="menuitem" onClick={close}>
                    Command center
                  </Link>
                </div>
              )}
            </div>

            <Link
              href="/#plans"
              className="whitespace-nowrap rounded px-2 py-2 text-[13px] font-medium text-white/95 transition hover:bg-white/10"
            >
              Plans &amp; Pricing
            </Link>

            <div className="relative">
              <button
                type="button"
                className="flex items-center gap-1 whitespace-nowrap rounded px-2 py-2 text-[13px] font-medium text-white/95 transition hover:bg-white/10"
                aria-expanded={openId === "topFeatures"}
                aria-haspopup="menu"
                onClick={() => toggle("topFeatures")}
              >
                Top features
                <NavChevron open={openId === "topFeatures"} />
              </button>
              {openId === "topFeatures" && (
                <div className={panel} role="menu">
                  <Link href="/#plans" className={item} role="menuitem" onClick={close}>
                    Connected intelligence
                  </Link>
                  <Link href="/reporting" className={item} role="menuitem" onClick={close}>
                    Reporting &amp; dashboards
                  </Link>
                  <Link href="/compliance" className={item} role="menuitem" onClick={close}>
                    Compliance &amp; audit trails
                  </Link>
                  <Link href="/import-export" className={item} role="menuitem" onClick={close}>
                    Import / export
                  </Link>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                className="flex items-center gap-1 whitespace-nowrap rounded px-2 py-2 text-[13px] font-medium text-white/95 transition hover:bg-white/10"
                aria-expanded={openId === "businessTypes"}
                aria-haspopup="menu"
                onClick={() => toggle("businessTypes")}
              >
                Business types
                <NavChevron open={openId === "businessTypes"} />
              </button>
              {openId === "businessTypes" && (
                <div className={panel} role="menu">
                  <Link href="/#plans" className={item} role="menuitem" onClick={close}>
                    Small ministry
                  </Link>
                  <Link href="/#plans" className={item} role="menuitem" onClick={close}>
                    Mid-size ministry
                  </Link>
                  <Link href="/member-portal" className={item} role="menuitem" onClick={close}>
                    Ministries &amp; churches
                  </Link>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                className="flex items-center gap-1 whitespace-nowrap rounded px-2 py-2 text-[13px] font-medium text-white/95 transition hover:bg-white/10"
                aria-expanded={openId === "resources"}
                aria-haspopup="menu"
                onClick={() => toggle("resources")}
              >
                Resources
                <NavChevron open={openId === "resources"} />
              </button>
              {openId === "resources" && (
                <div className={panel} role="menu">
                  <Link href="/intro" className={item} role="menuitem" onClick={close}>
                    Product tour
                  </Link>
                  <Link href="/onboarding" className={item} role="menuitem" onClick={close}>
                    Onboarding
                  </Link>
                  <Link href="/staff-onboarding" className={item} role="menuitem" onClick={close}>
                    Staff onboarding
                  </Link>
                  <Link href="/register" className={item} role="menuitem" onClick={close}>
                    Get started
                  </Link>
                </div>
              )}
            </div>
          </nav>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              className="flex items-center justify-center rounded p-2 text-white md:hidden"
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileOpen((o) => !o)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <Link
              href="/login"
              className="inline-flex shrink-0 items-center justify-center rounded-none border-2 border-white bg-transparent px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-white/10 max-[479px]:hidden"
            >
              Sign in
            </Link>

            <Link
              href="/#plans"
              className="inline-flex shrink-0 items-center justify-center rounded-md border-2 border-[var(--brand-cyber)] bg-[var(--brand-cyber)] px-3 py-2 text-xs font-bold uppercase tracking-wide text-black transition hover:brightness-105 sm:ml-2"
            >
              Buy now
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
