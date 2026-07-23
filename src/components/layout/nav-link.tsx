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
        "relative flex items-center gap-3 rounded-md border border-transparent px-3 py-2 text-sm font-medium transition-all outline-none select-none",
        "hover:border-sidebar-border hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        isActive
          ? "border-primary/25 bg-primary/12 text-[color:var(--brand-cyan)] shadow-[inset_2px_0_0_var(--brand-electric),0_0_24px_rgba(22,119,255,0.07)]"
          : "text-muted-foreground",
        compact && "gap-2 px-2 py-2",
      )}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
}
