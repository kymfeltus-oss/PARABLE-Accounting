"use client";

import { navGroups } from "@/config/navigation";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { NavSection } from "./nav-section";

type MobileNavProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MobileNav({ open, onOpenChange }: MobileNavProps) {
  const handleNavigate = () => {
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="flex h-full w-[min(100%,20rem)] flex-col gap-0 p-0"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Parable Accounting navigation</SheetTitle>
          <SheetDescription>
            Mobile navigation menu for Parable Accounting workspace sections.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3 border-b border-border px-4 py-5">
          <div className="space-y-1">
            <p className="text-sm font-semibold tracking-[0.2em] text-foreground">
              PARABLE
            </p>
            <p className="text-lg font-semibold text-foreground">Accounting</p>
          </div>
          <Badge variant="secondary">Development Workspace</Badge>
        </div>

        <ScrollArea className="flex-1">
          <nav aria-label="Primary navigation" className="px-2 py-4">
            {navGroups.map((group) => (
              <div key={group.id}>
                {group.id === "system" ? <Separator className="my-4" /> : null}
                <NavSection group={group} onNavigate={handleNavigate} />
              </div>
            ))}
          </nav>
        </ScrollArea>

        <div className="border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">Phase 1A</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export type { MobileNavProps };
