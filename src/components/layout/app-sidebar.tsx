import { navGroups } from "@/config/navigation";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import { NavSection } from "./nav-section";

export function AppSidebar() {
  return (
    <aside className="app-sidebar hidden h-svh w-60 shrink-0 border-r border-sidebar-border bg-sidebar md:sticky md:top-0 md:flex md:flex-col">
      <div className="flex flex-col gap-3 border-b border-sidebar-border px-5 py-6">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold tracking-[0.28em] text-sidebar-foreground">
            PARABLE
          </p>
          <p className="text-base font-medium tracking-[0.18em] text-sidebar-foreground uppercase">
            Accounting
          </p>
        </div>
        <Badge
          variant="secondary"
          className="w-fit border border-blue-500/20 bg-blue-500/8 text-[0.65rem] tracking-[0.08em] text-blue-400 uppercase"
        >
          Development Workspace
        </Badge>
      </div>

      <ScrollArea className="flex-1">
        <nav aria-label="Primary navigation" className="px-2.5 py-4">
          {navGroups.map((group) => (
            <div key={group.id}>
              {group.id === "system" ? <Separator className="my-4" /> : null}
              <NavSection group={group} />
            </div>
          ))}
        </nav>
      </ScrollArea>

      <div className="border-t border-sidebar-border px-4 py-4">
        <div className="rounded-md border border-sidebar-border bg-sidebar-accent/35 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">Phase 1A</p>
        </div>
      </div>
    </aside>
  );
}
