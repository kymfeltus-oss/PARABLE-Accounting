"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
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

const PRODUCTS_CHILDREN: { href: string; label: string }[] = [
  { href: "/#plans", label: "Plans overview" },
  { href: "/giving-member-tools", label: "Giving & member tools" },
  { href: "/accounting-workspace", label: "Accounting workspace" },
  { href: "/command-center", label: "Command center" },
];

function isProductChildActive(pathname: string, href: string) {
  if (href === "/#plans") return pathname === "/";
  return pathname === href;
}

export default function LandingHeader() {
  const pathname = usePathname() ?? "";
  const [openId, setOpenId] = useState<MenuId>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileProductsOpen, setMobileProductsOpen] = useState(true);
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

  const productItemBase = "block border-l-2 border-transparent px-4 py-2 text-slate-200 transition hover:bg-slate-800 hover:text-white";
  const productItemActive =
    "block border-l-2 border-[var(--brand-cyber)] bg-slate-800/90 px-4 py-2 font-medium text-cyan-100 transition hover:bg-slate-800 hover:text-white";

  const desktopProductClass = (href: string) =>
    isProductChildActive(pathname, href) ? productItemActive : productItemBase;

  const mobileRowBase =
    "inline-flex min-h-11 w-full items-center rounded-r-md py-2 pr-3 text-sm font-medium text-white/95 transition hover:bg-white/10";
  const mobileRowActive =
    "inline-flex min-h-11 w-full items-center rounded-r-md border-l-2 border-[var(--brand-cyber)] bg-white/15 py-2 pr-3 text-sm font-semibold text-white transition";
  const mobileProductClass = (href: string) =>
    `${isProductChildActive(pathname, href) ? mobileRowActive : mobileRowBase} pl-6`;

  return (
    <header
      ref={wrapRef}
      className="sticky top-0 z-[100] bg-[#4169E1] text-white shadow-[0_6px_18px_rgba(0,0,0,0.25)]"
    >
      {/* Brand row: Cyan background, black text/logo, navy promo accent */}
      <div className="bg-[var(--brand-cyber)] border-b border-black/10">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-1 px-4 py-0 sm:grid-cols-3 sm:items-center md:px-8 md:py-0.5">
          <div className="hidden sm:block" aria-hidden />
          <Link
            href="/"
            className="mx-auto flex w-fit shrink-0 items-center no-underline sm:justify-self-center"
          >
            <img
              src="/logo.svg"
              alt="Parable"
              className="h-5 w-auto sm:h-6 brightness-0"
            />
          </Link>
          <p className="min-w-0 text-right text-xs font-semibold text-black/80 sm:justify-self-end sm:text-sm">
            Get <span className="font-extrabold text-[#4169E1]">50% OFF</span> Accounting for 3 months
            <span className="ml-0.5 text-black/40">*</span>
          </p>
        </div>
      </div>

      {/* Main nav bar — Midnight Navy */}
      <div>
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-1 md:gap-3 md:px-8 md:py-1.5">
          <nav className="hidden flex-1 min-w-0 items-center gap-0.5 md:flex" aria-label="Primary">
            <div className="relative">
              <button
                type="button"
                className="flex items-center gap-1 whitespace-nowrap rounded px-2 py-1.5 text-[13px] font-medium text-white/95 transition hover:bg-white/10"
                aria-expanded={openId === "products"}
                aria-haspopup="menu"
                onClick={() => toggle("products")}
              >
                Products &amp; Services
                <NavChevron open={openId === "products"} />
              </button>
              {openId === "products" && (
                <div className={panel} role="menu">
                  {PRODUCTS_CHILDREN.map(({ href, label }) => (
                    <Link
                      key={href + label}
                      href={href}
                      className={desktopProductClass(href)}
                      role="menuitem"
                      onClick={close}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link
              href="/#plans"
              className="whitespace-nowrap rounded px-2 py-1.5 text-[13px] font-medium text-white/95 transition hover:bg-white/10"
            >
              Plans &amp; Pricing
            </Link>

            <div className="relative">
              <button
                type="button"
                className="flex items-center gap-1 whitespace-nowrap rounded px-2 py-1.5 text-[13px] font-medium text-white/95 transition hover:bg-white/10"
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
                className="flex items-center gap-1 whitespace-nowrap rounded px-2 py-1.5 text-[13px] font-medium text-white/95 transition hover:bg-white/10"
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
                className="flex items-center gap-1 whitespace-nowrap rounded px-2 py-1.5 text-[13px] font-medium text-white/95 transition hover:bg-white/10"
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
              className="flex min-h-10 min-w-10 items-center justify-center rounded p-1.5 text-white md:hidden"
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileOpen((o) => !o)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <Link
              href="/login"
              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-none border-2 border-white bg-transparent px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-white/10 max-[479px]:hidden"
            >
              Sign in
            </Link>

            <Link
              href="/#plans"
              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-md border-2 border-[var(--brand-cyber)] bg-[var(--brand-cyber)] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-black transition hover:brightness-105 sm:ml-2"
            >
              Buy now
            </Link>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-white/10 bg-[#4169E1] md:hidden">
            <nav className="mx-auto flex max-w-7xl flex-col px-2 py-2" aria-label="Mobile Primary">
              <button
                type="button"
                className="inline-flex min-h-11 w-full items-center justify-between rounded px-2 py-2 text-left text-sm font-semibold text-white/95 hover:bg-white/10"
                aria-expanded={mobileProductsOpen}
                onClick={() => setMobileProductsOpen((o) => !o)}
              >
                Products &amp; Services
                <NavChevron open={mobileProductsOpen} />
              </button>
              {mobileProductsOpen && (
                <div className="flex flex-col border-l border-white/10 pb-1 pl-1">
                  {PRODUCTS_CHILDREN.map(({ href, label }) => (
                    <Link
                      key={href + label}
                      href={href}
                      onClick={close}
                      className={mobileProductClass(href)}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              )}

              {[
                { href: "/#plans", label: "Plans & Pricing" },
                { href: "/reporting", label: "Top features · Reporting" },
                { href: "/compliance", label: "Top features · Compliance" },
                { href: "/member-portal", label: "Business types · Ministries" },
                { href: "/intro", label: "Resources · Product tour" },
                { href: "/register", label: "Resources · Get started" },
                { href: "/contact", label: "Talk to Sales" },
              ].map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={close}
                  className="inline-flex min-h-11 items-center rounded px-2 py-2 text-sm font-medium text-white/95 hover:bg-white/10"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
