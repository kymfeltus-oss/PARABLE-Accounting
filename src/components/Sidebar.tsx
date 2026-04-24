"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import FoundryNavIcon from "@/components/FoundryNavIcon";
import { sidebarAuditModule, sidebarNavigation, type FoundryModule } from "@/lib/sidebarFoundryNav";

function moduleTopIcon(icon: string): Parameters<typeof FoundryNavIcon>[0]["name"] {
  switch (icon) {
    case "CalculatorIcon":
      return "calculator";
    case "ChartBarIcon":
      return "chartbar";
    case "UsersIcon":
      return "users";
    case "OfficeBuildingIcon":
      return "building";
    case "FolderIcon":
      return "folder";
    case "GiftIcon":
      return "gift";
    default:
      return "calculator";
  }
}

/**
 * True when the nav item should read as "you are in this module".
 * Accounting covers /accounting and all /accounting/* drill-downs ( hub is in-center, not in rail ).
 */
function isModulePathActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/accounting") return pathname === "/accounting" || pathname.startsWith("/accounting/");
  if (href === "/giving") return pathname === "/giving" || pathname.startsWith("/giving/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

type Props = { auditMode: boolean };

/**
 * Foundry left rail: **flat** module list only. No nested sub-menus — e.g. Accounting
 * sub-areas are on the centered /accounting dashboard.
 */
export default function Sidebar({ auditMode }: Props) {
  const nav = useMemo(() => (auditMode ? sidebarAuditModule : sidebarNavigation), [auditMode]);
  const pathname = usePathname() ?? "";

  const rowBase = auditMode
    ? "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition text-neutral-700 hover:bg-neutral-200"
    : "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition text-white/65 hover:bg-white/[0.06] hover:text-[var(--brand-cyber)]";

  return (
    <nav className="sovereign-sidebar-rail ministry-scroll flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-4">
      <p
        className={[
          "px-2 pb-1 text-[9px] font-semibold uppercase tracking-[0.28em]",
          auditMode ? "text-neutral-500" : "text-white/35",
        ].join(" ")}
      >
        Sovereign modules
      </p>
      {nav.map((mod) => {
        if (!mod.path) return null;
        return (
          <SidebarLink key={mod.name} mod={mod} pathname={pathname} rowBase={rowBase} auditMode={auditMode} />
        );
      })}
    </nav>
  );
}

function SidebarLink({
  mod,
  pathname,
  rowBase,
  auditMode,
}: {
  mod: FoundryModule;
  pathname: string;
  rowBase: string;
  auditMode: boolean;
}) {
  const active = isModulePathActive(pathname, mod.path);
  const leafClass = [
    rowBase,
    active && !auditMode ? "text-[var(--brand-cyber)] bg-white/[0.06]" : "",
    active && auditMode ? "bg-neutral-200 font-semibold text-neutral-900 ring-1 ring-neutral-400" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <Link href={mod.path} className={leafClass}>
        <FoundryNavIcon name={moduleTopIcon(mod.icon)} size={16} />
        <span className="min-w-0 flex-1 font-semibold tracking-tight">{mod.name}</span>
      </Link>
    </div>
  );
}
