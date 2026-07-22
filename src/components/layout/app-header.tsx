"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { getNavItemByPathname } from "@/config/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type AppHeaderProps = {
  onOpenMobileNav: () => void;
};

export function AppHeader({ onOpenMobileNav }: AppHeaderProps) {
  const pathname = usePathname();
  const currentItem = getNavItemByPathname(pathname);
  const pageTitle = currentItem?.title ?? "Parable Accounting";

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 md:px-6">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Open navigation"
        onClick={onOpenMobileNav}
      >
        <Menu aria-hidden="true" />
      </Button>

      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-foreground">
        {pageTitle}
      </h1>

      <Badge variant="secondary">Development Workspace</Badge>

      <div
        aria-label="Header actions"
        className="flex shrink-0 items-center"
        data-slot="header-actions"
      >
        <SignOutButton />
      </div>
    </header>
  );
}

export type { AppHeaderProps };
