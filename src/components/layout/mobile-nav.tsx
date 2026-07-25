"use client";

import { navGroups } from "@/config/navigation";
import { BrandLogoMark } from "@/components/brand/brand-logo-mark";
import { BrandWordmark } from "@/components/brand/brand-wordmark";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import type { WorkspaceShellIdentity } from "./app-sidebar";
import { NavSection } from "./nav-section";

type MobileNavProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  identity: WorkspaceShellIdentity;
};

export function MobileNav({ open, onOpenChange, identity }: MobileNavProps) {
  const handleNavigate = () => {
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="flex h-full w-[min(100%,20rem)] max-w-[min(100%,20rem)] flex-col gap-0 overflow-hidden border-sidebar-border bg-sidebar p-0 sm:max-w-[min(100%,20rem)]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Parable Accounting navigation</SheetTitle>
          <SheetDescription>
            Mobile navigation menu for Parable Accounting workspace sections.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 border-b border-sidebar-border px-5 py-6">
          <div className="flex min-h-14 items-center gap-3.5">
            <span className="grid h-14 w-12 shrink-0 place-items-center overflow-visible">
              <BrandLogoMark />
            </span>
            <BrandWordmark compact />
          </div>
          <p className="truncate text-sm font-medium text-[#F7FAFF]">
            {identity.organizationName}
          </p>
        </div>

        <ScrollArea className="flex-1">
          <nav aria-label="Primary navigation" className="px-2.5 py-4">
            {navGroups.map((group) => (
              <div key={group.id}>
                {group.id === "system" ? <Separator className="my-4" /> : null}
                <NavSection group={group} onNavigate={handleNavigate} />
              </div>
            ))}
          </nav>
        </ScrollArea>

        <div className="border-t border-sidebar-border px-4 py-4">
          <div className="brand-surface rounded-md px-3 py-2.5">
            <p className="truncate text-sm font-medium text-foreground">
              {identity.userDisplayName}
            </p>
            {identity.userEmail ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {identity.userEmail}
              </p>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export type { MobileNavProps };
