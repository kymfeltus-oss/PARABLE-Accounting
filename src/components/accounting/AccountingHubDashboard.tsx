"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import FoundryNavIcon from "@/components/FoundryNavIcon";
import { ACCOUNTING_HUB_LINKS } from "@/lib/accountingHubNav";
import type { FoundrySubMenu } from "@/lib/sidebarFoundryNav";

function isActive(pathname: string, item: FoundrySubMenu) {
  const href = item.path;
  if (href === "/accounting/coa" && pathname === "/chart-of-accounts") return true;
  if (href === "/accounting/audit" && pathname === "/compliance") return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function HubTile({ item, active }: { item: FoundrySubMenu; active: boolean }) {
  return (
    <Link
      href={item.path}
      className={[
        "group flex flex-col gap-3 rounded-2xl border p-5 transition",
        active
          ? "border-[rgb(var(--brand-cyber-rgb)/0.45)] bg-white/[0.08] text-[var(--brand-cyber)] shadow-[0_0_32px_rgb(var(--brand-cyber-rgb)/0.12)]"
          : "border-white/10 bg-black/35 text-white/90 hover:border-[rgb(var(--brand-cyber-rgb)/0.3)] hover:shadow-[0_0_28px_rgb(var(--brand-cyber-rgb)/0.08)]",
      ].join(" ")}
      title={item.function}
    >
      <div className="flex items-start justify-between gap-2">
        <FoundryNavIcon name={item.icon} size={22} />
        {active ? (
          <span className="text-[8px] font-bold uppercase tracking-widest text-[var(--brand-cyber)]/90">Active</span>
        ) : (
          <span className="text-[8px] font-bold uppercase tracking-widest text-white/25 group-hover:text-[var(--brand-cyber)]/70">
            Open
          </span>
        )}
      </div>
      <div>
        <p className="text-sm font-bold leading-snug tracking-tight">{item.name}</p>
        {item.function ? <p className="mt-1.5 text-xs leading-relaxed text-white/45 group-hover:text-white/55">{item.function}</p> : null}
      </div>
    </Link>
  );
}

/**
 * In-center drill-down: sub-areas are not in the left rail; they live here.
 */
export default function AccountingHubDashboard() {
  const pathname = usePathname() ?? "";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col items-center">
      <header className="mb-10 w-full text-center">
        <p
          className="text-[10px] font-bold uppercase tracking-[0.35em]"
          style={{ color: "rgb(var(--brand-cyber-rgb) / 0.9)" }}
        >
          Module hub
        </p>
        <h1 className="parable-header mt-2 text-2xl sm:text-3xl">Accounting</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-white/50">
          High-governance financial suite: daily operations (AP/AR) and institutional safeguards (controls, AI close) —
          open a tile below. This menu is intentionally centered here, not in the left navigation rail.
        </p>
      </header>

      <ul className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
        {ACCOUNTING_HUB_LINKS.map((item) => (
          <li key={item.path} className="min-w-0">
            <HubTile item={item} active={isActive(pathname, item)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
