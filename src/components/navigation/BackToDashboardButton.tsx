"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuditMode } from "@/context/AuditModeContext";

type Props = {
  /** Default: home command center at `/` */
  href?: string;
  className?: string;
};

/**
 * Shown in the app shell on every screen except the dashboard home. Returns to the main command center.
 */
export default function BackToDashboardButton({ href = "/", className = "" }: Props) {
  const pathname = usePathname() ?? "";
  const { auditMode } = useAuditMode();

  if (pathname === "/" || pathname === href) {
    return null;
  }

  const base = auditMode
    ? "inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-neutral-800 transition hover:bg-neutral-100"
    : "group inline-flex items-center gap-2 rounded-lg border border-white/12 bg-black/30 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-white/70 transition hover:border-[rgb(var(--brand-cyber-rgb)/0.35)] hover:text-[var(--brand-cyber)] hover:shadow-[0_0_20px_rgb(var(--brand-cyber-rgb)/0.1)]";

  return (
    <div className={`mb-4 md:mb-5 ${className}`}>
      <Link href={href} className={base}>
        <span className="text-base leading-none transition group-hover:-translate-x-0.5" aria-hidden>
          ←
        </span>
        Dashboard
      </Link>
    </div>
  );
}
