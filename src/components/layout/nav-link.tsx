"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isNavItemActive, type NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils";

type NavLinkProps = {
  item: NavItem;
  onNavigate?: () => void;
  compact?: boolean;
};

export function NavLink({ item, onNavigate, compact = false }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = isNavItemActive(pathname, item);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      data-active={isActive ? "true" : "false"}
      onClick={() => onNavigate?.()}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-sm font-medium transition-colors outline-none select-none",
        "hover:bg-muted hover:text-foreground",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        isActive
          ? "bg-muted text-foreground"
          : "text-muted-foreground",
        compact && "gap-2 px-2 py-2",
      )}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
}
